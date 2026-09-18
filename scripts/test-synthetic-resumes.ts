import assert from 'node:assert/strict';
import { emailAuthFixture } from './email-auth-fixture';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { deriveCriteria, processDraft } from '../lib/projects/domain';
import { JOB_PROFILE_CATALOG_VERSION } from '../lib/evaluation/job-profiles';
import { ServerKeywordEvaluator } from '../lib/evaluation/server-keyword-evaluator';
import type { ProjectDraft } from '../lib/projects/types';
import { fitSummary, sortAnalyses } from '../lib/projects/fit';
import { buildInterviewInput, templateQuestions } from '../lib/interview/domain';
import { generationSchema } from '../lib/interview/types';

// Run against a running local web + Kotlin server, never a mocked response.
// node --import tsx scripts/test-synthetic-resumes.ts http://127.0.0.1:3100
const origin = process.argv[2] ?? 'http://127.0.0.1:3100';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname), 'Local test only');
const scenarios = [
  {
    key: 'backend',
    profile: 'backend',
    score: 45,
    missing: ['operations'],
    levels: [2, 2, 2, 2, 2, 2, 2, 0],
  },
  {
    key: 'frontend',
    profile: 'frontend',
    score: 44,
    missing: ['testing', 'collaboration'],
    levels: [2, 3, 2, 2, 2, 0, 2, 0],
  },
  {
    key: 'pm',
    profile: 'project-pm',
    score: 58,
    missing: ['regulated'],
    levels: [4, 3, 1, 2, 0, 4, 1],
  },
] as const;
async function main() {
  const sessions = {
    recruiter: await emailAuthFixture(origin, 'recruiter'),
    applicant: await emailAuthFixture(origin, 'applicant'),
  };
  const actor = sessions.recruiter.actor;
  const reports = [];
  for (const scenario of scenarios) {
    const read = (name: string) =>
      readFileSync(
        new URL(`../tests/fixtures/synthetic-resumes/${name}.txt`, import.meta.url),
        'utf8',
      );
    const text = read(scenario.key);
    const jd = read(`${scenario.key}-jd`);
    const draft: ProjectDraft = {
      id: crypto.randomUUID(),
      title: `가상 이력서 검증 · ${scenario.key}`,
      jobProfile: scenario.profile,
      profileCatalogVersion: JOB_PROFILE_CATALOG_VERSION,
      jd: { mode: 'text', reference: '가상 채용공고', text: jd },
      criteria: deriveCriteria(jd, scenario.profile),
      people: [
        {
          id: 'synthetic-person',
          name: text.split('\n')[0],
          birthDate: '',
          experience: scenario.key === 'pm' ? 11 : 3,
        },
      ],
      documents: [
        {
          id: 'synthetic-document',
          applicantId: 'synthetic-person',
          filename: `${scenario.key}.txt`,
          size: Buffer.byteLength(text),
          status: 'ready',
          source: 'text',
          pages: [{ number: 1, text }],
        },
      ],
    };
    const evaluator = new ServerKeywordEvaluator((url, init) =>
      fetch(new URL(String(url), origin), {
        ...init,
        headers: {
          ...Object.fromEntries(new Headers(init?.headers)),
          Origin: new URL(origin).origin,
          Cookie: sessions.recruiter.cookie,
        },
      }),
    );
    const project = await processDraft(draft, actor, undefined, () => {}, evaluator);
    const analysis = project.revisions[0].analyses[0];
    for (const role of ['applicant', 'recruiter'] as const) {
      const input = buildInterviewInput({ ...project, role }, project.revisions[0], analysis);
      const cookie = sessions[role].cookie;
      const response = await fetch(new URL('/api/interviews', origin), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: new URL(origin).origin,
          Cookie: cookie,
        },
        body: JSON.stringify(input),
      });
      assert.equal(response.status, 200, `${scenario.key}/${role}: interview endpoint`);
      const interview = generationSchema.parse(await response.json());
      assert.equal(interview.questions.length, 7);
      assert.equal(interview.questions.filter((q) => q.kind === 'common').length, 3);
      assert.equal(interview.questions.filter((q) => q.kind === 'personal').length, 4);
      for (const question of interview.questions) {
        assert.ok(
          [...input.topics, ...(input.experienceTopics ?? [])].some(
            (t) => t.id === question.topicId,
          ),
        );
        for (const source of question.sources) assert.ok(text.includes(source.excerpt));
      }
      if (role === 'recruiter')
        assert.deepEqual(
          interview.questions.filter((q) => q.kind === 'common'),
          templateQuestions(input).questions.filter((q) => q.kind === 'common'),
        );
      console.log(
        `PASS interview ${scenario.key}/${role}: 3 common + 4 personal, ${interview.generation}`,
      );
    }
    const rows = analysis.results.map((result, i) => ({
      criterion: draft.criteria[i].catalogCriterionId,
      name: draft.criteria[i].name,
      score: result.score,
      maxScore: result.maxScore,
      reading: result.reading,
      evidenceLevel: result.evidenceLevel,
      matches: result.keywordMatches,
      sources: result.sources,
    }));
    const report = {
      scenario: scenario.key,
      score: analysis.score,
      expectedScore: scenario.score,
      evaluatorVersion: analysis.evaluatorVersion,
      rows,
    };
    reports.push(report);
    console.log(JSON.stringify(report, null, 2));
    assert.equal(analysis.score, scenario.score, `${scenario.key}: total score`);
    assert.deepEqual(
      rows.filter((r) => r.reading === '-').map((r) => r.criterion),
      [...scenario.missing],
    );
    if (scenario.levels)
      assert.deepEqual(
        rows.map((r) => r.evidenceLevel),
        [...scenario.levels],
      );
    for (const row of rows) {
      if (row.reading === 'O') assert.ok(row.sources.length > 0, `${row.name}: source must exist`);
      for (const source of row.sources)
        assert.ok(text.includes(source.excerpt), `${row.name}: original source`);
    }
    const matches = rows.flatMap((row) => row.matches ?? []);
    assert.ok(matches.some((m) => m.relation === 'DIRECT'));
    assert.ok(matches.some((m) => m.relation === 'RELATED'));
    assert.ok(matches.some((m) => m.relation === 'NONE'));
    if (scenario.key === 'backend') {
      assert.ok(
        matches.some(
          (m) =>
            m.jdKeyword === 'MySQL' &&
            m.matchedKeyword?.toLowerCase() === 'postgresql' &&
            m.relation === 'RELATED',
        ),
      );
      assert.ok(
        matches.some(
          (m) =>
            m.jdKeyword === '아키텍처 설계' &&
            m.matchedKeyword?.toLowerCase() === 'docker' &&
            m.relation === 'RELATED',
        ),
      );
    }
  }
  mkdirSync(new URL('../output/synthetic-resumes/', import.meta.url), { recursive: true });
  const balancedJD = '자격요건\nJava\nMySQL\nDocker';
  const candidates = [
    {
      id: 'focused',
      name: '가상 집중형',
      text: 'Java로 서버를 구현하고 처리 방식을 선택해 응답 시간을 30% 단축했습니다.\nPostgreSQL로 테이블을 설계하고 저장 방식을 선택해 조회 시간을 30% 단축했습니다.',
    },
    {
      id: 'balanced',
      name: '가상 균형형',
      text: 'Java로 서버를 구현했습니다.\nPostgreSQL로 테이블을 설계했습니다.\nDocker로 서비스를 배포했습니다.',
    },
  ];
  const balancedDraft: ProjectDraft = {
    id: crypto.randomUUID(),
    title: '균형순 검증',
    jobProfile: 'backend',
    profileCatalogVersion: JOB_PROFILE_CATALOG_VERSION,
    jd: { mode: 'text', reference: '가상 JD', text: balancedJD },
    criteria: deriveCriteria(balancedJD, 'backend').map((c) => ({
      ...c,
      core: c.catalogCriterionId === 'language',
      minimumRatio: 0.5,
    })),
    people: candidates.map((c) => ({ id: c.id, name: c.name, birthDate: '', experience: 3 })),
    documents: candidates.map((c) => ({
      id: c.id,
      applicantId: c.id,
      filename: `${c.id}.txt`,
      size: Buffer.byteLength(c.text),
      status: 'ready',
      source: 'text',
      pages: [{ number: 1, text: c.text }],
    })),
  };
  const balancedProject = await processDraft(
    balancedDraft,
    actor,
    undefined,
    () => {},
    new ServerKeywordEvaluator((url, init) =>
      fetch(new URL(String(url), origin), {
        ...init,
        headers: {
          ...Object.fromEntries(new Headers(init?.headers)),
          Origin: new URL(origin).origin,
          Cookie: sessions.recruiter.cookie,
        },
      }),
    ),
  );
  const analyses = balancedProject.revisions[0].analyses;
  assert.deepEqual(
    analyses.map((a) => a.score),
    [75, 50],
  );
  assert.equal(
    sortAnalyses(analyses, balancedProject.criteria, 'balanced')[0].personId,
    'balanced',
  );
  assert.equal(sortAnalyses(analyses, balancedProject.criteria, 'score')[0].personId, 'focused');
  assert.deepEqual(
    analyses.map((a) => fitSummary(balancedProject.criteria, a).met),
    [2, 3],
  );
  assert.ok(
    analyses[1].results.every((r) => r.status === 'confirmed'),
    '50% policy and item status must agree',
  );
  writeFileSync(
    new URL('../output/synthetic-resumes/balanced-ranking.json', import.meta.url),
    JSON.stringify(balancedProject, null, 2) + '\n',
  );
  writeFileSync(
    new URL('../output/synthetic-resumes/results.json', import.meta.url),
    JSON.stringify(reports, null, 2) + '\n',
  );
  console.log(
    'PASS: 3 synthetic resumes + 2 ranking candidates, real web proxy and Kotlin server, scores / relations / evidence / balanced ordering verified.',
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
