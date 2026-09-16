import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  allocateProfileWeights,
  jobProfiles,
  JOB_PROFILE_CATALOG_VERSION,
} from '../lib/evaluation/job-profiles';
import { deriveCriteria, processDraft, parseProjects, revisionDraft } from '../lib/projects/domain';
import { demoDraft } from '../lib/projects/demo';
import { ServerKeywordEvaluator } from '../lib/evaluation/server-keyword-evaluator';
import type { ProjectActor } from '../lib/projects/types';

const actor: ProjectActor = {
  id: 'profile-test',
  name: '담당자',
  role: 'recruiter',
  provider: '데모',
};

test('all 12 profiles have distinct criteria, 100 points and extract their own detailed lists', () => {
  assert.equal(jobProfiles.length, 12);
  assert.equal(new Set(jobProfiles.map((p) => p.id)).size, 12);
  assert.equal(
    jobProfiles.reduce((n, p) => n + p.criteria.length, 0),
    86,
  );
  for (const profile of jobProfiles) {
    assert.equal(
      profile.criteria.reduce((n, c) => n + c.weight, 0),
      100,
      profile.name,
    );
    assert.equal(new Set(profile.criteria.map((c) => c.id)).size, profile.criteria.length);
    const jd = profile.criteria.flatMap((c) => c.keywords).join('\n');
    const extracted = deriveCriteria(jd, profile.id);
    assert.equal(extracted.length, profile.criteria.length, profile.name);
    assert.ok(extracted.every((c) => c.catalogCriterionId && c.weight && c.description));
  }
});

test('construction PM JD extracts seven PM criteria instead of developer tools', () => {
  const jd = readFileSync(new URL('./fixtures/lomin-pm-jd.txt', import.meta.url), 'utf8');
  const extracted = deriveCriteria(jd, 'project-pm');
  assert.deepEqual(
    extracted.map((c) => c.catalogCriterionId),
    ['lifecycle', 'scope', 'resources', 'stakeholders', 'regulated', 'presales', 'documents'],
  );
  assert.deepEqual(
    extracted.map((c) => c.weight),
    [20, 20, 15, 15, 15, 10, 5],
  );
  assert.equal(extracted.find((c) => c.catalogCriterionId === 'regulated')?.required, true);
  assert.equal(deriveCriteria('React TypeScript 웹 성능', 'project-pm').length, 0);
  assert.ok(deriveCriteria('React TypeScript 웹 성능', 'frontend').length >= 2);
});

test('partial JD criteria are reweighted to 100 with positive weights even after custom additions', () => {
  assert.deepEqual(
    allocateProfileWeights([20, 20, 15, 15, 15, 10, 5]),
    [20, 20, 15, 15, 15, 10, 5],
  );
  assert.deepEqual(allocateProfileWeights([20, 15]), [57, 43]);
  const weights = allocateProfileWeights([1, ...Array(49).fill(100)]);
  assert.equal(
    weights.reduce((n, w) => n + w, 0),
    100,
  );
  assert.ok(weights.every((w) => Number.isInteger(w) && w > 0));
});

test('profile scoring preserves evidence, points, profile selection and previous snapshots', async () => {
  const draft = demoDraft(actor);
  draft.jobProfile = 'project-pm';
  draft.profileCatalogVersion = JOB_PROFILE_CATALOG_VERSION;
  draft.jd.text = '일정 및 품질, 리소스와 주요 이슈를 관리합니다.';
  draft.criteria = deriveCriteria(draft.jd.text, draft.jobProfile);
  draft.criteria[0].core = true;
  draft.criteria[0].minimumRatio = 0.75;
  assert.equal(draft.criteria.length, 1);
  draft.people = draft.people.slice(0, 1);
  draft.documents = draft.documents.filter((d) => d.applicantId === draft.people[0].id).slice(0, 1);
  draft.documents[0].pages = [{ number: 2, text: '프로젝트에서 WBS 관리를 담당했습니다.' }];
  const evaluator = new ServerKeywordEvaluator(async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.jobProfile, 'project-pm');
    assert.equal(body.catalogVersion, JOB_PROFILE_CATALOG_VERSION);
    assert.equal(body.criteria[0].catalogCriterionId, 'resources');
    return Response.json({
      version: `experience-keywords-v3:${JOB_PROFILE_CATALOG_VERSION}`,
      results: [
        {
          criterionId: draft.criteria[0].id,
          related: true,
          evidenceLevel: 2,
          evidence: draft.documents[0].pages[0].text,
          matches: body.criteria[0].keywords.map((jdKeyword: string) => ({
            jdKeyword,
            relation: 'RELATED',
            matchedKeyword: 'WBS',
            evidence: draft.documents[0].pages[0].text,
          })),
        },
      ],
    });
  });
  const project = await processDraft(draft, actor, undefined, () => {}, evaluator);
  const result = project.revisions[0].analyses[0];
  assert.equal(result.score, 50);
  assert.equal(result.results[0].reading, 'O');
  assert.equal(result.results[0].status, 'review');
  assert.equal(result.results[0].evidenceLevel, 2);
  assert.equal(result.results[0].sources[0].page, 2);
  assert.deepEqual(
    parseProjects(JSON.stringify({ version: 1, actor, projects: [project] })).projects[0],
    project,
  );
  const next = await processDraft(revisionDraft(project), actor, project, () => {}, evaluator);
  assert.equal(next.criteria[0].core, true);
  assert.equal(next.criteria[0].minimumRatio, 0.75);
  assert.deepEqual(next.revisions[0], project.revisions[0]);
  await assert.rejects(
    () =>
      processDraft(
        { ...revisionDraft(project), jobProfile: 'product-pm' },
        actor,
        project,
        () => {},
        evaluator,
      ),
    /기존 직무/,
  );
});

test('old server without role support cannot silently supply generic scores', async () => {
  const draft = demoDraft(actor);
  draft.jobProfile = 'backend';
  draft.criteria = deriveCriteria(draft.jd.text, draft.jobProfile);
  const evaluator = new ServerKeywordEvaluator(async () =>
    Response.json({ version: 'experience-keywords-v2', results: [] }),
  );
  await assert.rejects(
    () => processDraft(draft, actor, undefined, () => {}, evaluator),
    /목록 버전/,
  );
});
