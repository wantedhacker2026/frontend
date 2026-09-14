import test from 'node:test';
import assert from 'node:assert/strict';
import { demoDraft } from '../lib/projects/demo';
import {
  ownedProjects,
  parseProjects,
  processDraft,
  projectRoute,
  revisionDraft,
  saveProject,
  validateDraft,
} from '../lib/projects/domain';
import type { ProjectActor, ProjectDB } from '../lib/projects/types';
import { MockCandidateEvaluator } from '../lib/evaluation/mock-evaluator';
const applicant: ProjectActor = {
  id: 'applicant',
  role: 'applicant',
  name: '테스트 지원자',
  provider: '데모',
};
const recruiter: ProjectActor = {
  id: 'recruiter',
  role: 'recruiter',
  name: '테스트 담당자',
  provider: '데모',
};
const noop = () => {};
test('role determines processing task and destination with staged progress', async () => {
  for (const actor of [applicant, recruiter]) {
    const stages: number[] = [];
    const p = await processDraft(demoDraft(actor), actor, undefined, (s) => stages.push(s));
    assert.equal(p.revisions[0].taskType, actor.role === 'applicant' ? 'analysis' : 'summary');
    assert.equal(p.revisions[0].analyses.length, actor.role === 'applicant' ? 1 : 20);
    assert.match(projectRoute(p), actor.role === 'applicant' ? /my-analysis$/ : /applicants$/);
    assert.deepEqual(stages, [0, 1, 2]);
  }
});
test('missing JD, malformed URL, missing documents and cross-person applicant input are rejected', () => {
  const draft = demoDraft(applicant);
  assert.throws(() =>
    validateDraft({ ...draft, jd: { mode: 'text', reference: '', text: '' } }, applicant),
  );
  assert.throws(() =>
    validateDraft({ ...draft, jd: { ...draft.jd, mode: 'url', reference: 'not-url' } }, applicant),
  );
  assert.throws(() => validateDraft({ ...draft, documents: [] }, applicant));
  assert.throws(() =>
    validateDraft(
      {
        ...draft,
        documents: [
          ...draft.documents,
          { ...draft.documents[0], id: 'other-doc', applicantId: 'other' },
        ],
        people: [...draft.people, { ...draft.people[0], id: 'other' }],
      },
      applicant,
    ),
  );
});
test('source excerpts retain exact filenames and real page numbers; missing evidence has no invented source', async () => {
  const draft = demoDraft(applicant);
  draft.documents[0].filename = '원문.pdf';
  draft.documents[0].pages = [
    { number: 3, text: 'Spring Boot로 API를 구현하고 성능을 30% 개선했습니다.' },
  ];
  const p = await processDraft(draft, applicant, undefined, noop);
  const spring = p.revisions[0].analyses[0].results.find(
    (r) => r.criterionId === draft.criteria.find((c) => c.name === 'Spring Framework')!.id,
  )!;
  assert.equal(spring.sources[0].page, 3);
  assert.equal(spring.sources[0].filename, '원문.pdf');
  assert.equal(spring.sources[0].excerpt, draft.documents[0].pages[0].text);
  const kafka = p.revisions[0].analyses[0].results.find(
    (r) => r.criterionId === draft.criteria.find((c) => c.name === 'Kafka')!.id,
  )!;
  assert.deepEqual(kafka.sources, []);
  assert.equal(kafka.status, 'missing');
});
test('failed files keep successful results and mark unavailable evidence as unreadable', async () => {
  const draft = demoDraft(applicant);
  draft.documents.push({
    ...draft.documents[0],
    id: 'failed',
    filename: '암호화.pdf',
    status: 'failed',
    pages: [],
    error: '암호화',
  });
  const p = await processDraft(draft, applicant, undefined, noop);
  assert.equal(p.revisions[0].status, 'partial');
  assert.ok(p.revisions[0].analyses[0].results.some((r) => r.status === 'confirmed'));
  assert.ok(p.revisions[0].analyses[0].results.some((r) => r.status === 'unreadable'));
  assert.equal(p.revisions[0].documents.length, 2);
});
test('reanalysis is append-only, keeps previous snapshots and rejects a foreign owner or stale save', async () => {
  const first = await processDraft(demoDraft(applicant), applicant, undefined, noop);
  const original = JSON.stringify(first);
  const draft = revisionDraft(first);
  draft.documents[0].pages[0].text +=
    '\nKafka 이벤트 시스템을 구현하고 부하 테스트를 진행했습니다.';
  const next = await processDraft(draft, applicant, first, noop);
  assert.equal(JSON.stringify(first), original);
  assert.deepEqual(next.revisions[0], first.revisions[0]);
  assert.equal(next.revisions.length, 2);
  assert.notEqual(next.revisions[1].id, next.revisions[0].id);
  await assert.rejects(() => processDraft(draft, recruiter, first, noop));
  const db: ProjectDB = { version: 1, actor: applicant, projects: [first] };
  assert.equal(saveProject(db, next, 1).projects[0].revisions.length, 2);
  assert.throws(() => saveProject(db, next, 0));
  assert.throws(() => saveProject({ ...db, actor: recruiter }, next, 1));
});
test('failed reanalysis leaves previous results untouched; local role/owner filtering and persistence round trip', async () => {
  const first = await processDraft(demoDraft(applicant), applicant, undefined, noop);
  const before = JSON.stringify(first);
  class Failure extends MockCandidateEvaluator {
    evaluate(): never {
      throw new Error('분석 실패');
    }
  }
  await assert.rejects(() =>
    processDraft(revisionDraft(first), applicant, first, noop, new Failure()),
  );
  assert.equal(JSON.stringify(first), before);
  assert.equal(ownedProjects([first], applicant).length, 1);
  assert.equal(ownedProjects([first], recruiter).length, 0);
  assert.equal(ownedProjects([first], null).length, 0);
  const db: ProjectDB = { version: 1, actor: applicant, projects: [first] };
  assert.deepEqual(parseProjects(JSON.stringify(db)), db);
});

test('unreadable PDF pages are distinguished from missing statements and summary favors performed work', async () => {
  const draft = demoDraft(applicant);
  draft.documents[0].unreadablePages = [2];
  const project = await processDraft(draft, applicant, undefined, noop);
  assert.equal(project.revisions[0].status, 'partial');
  const results = project.revisions[0].analyses[0].results;
  assert.ok(results.some((r) => r.status === 'unreadable'));
  const spring = results.find(
    (r) => r.criterionId === draft.criteria.find((c) => c.name === 'Spring Framework')!.id,
  )!;
  assert.match(spring.sources[0].excerpt, /프로젝트를 개발/);
  assert.ok(
    results
      .flatMap((r) => r.sources)
      .every((s) => s.excerpt !== '프로젝트 경험' && s.excerpt !== '협업 경험'),
  );
});
