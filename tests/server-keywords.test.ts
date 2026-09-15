import test from 'node:test';
import assert from 'node:assert/strict';
import { ServerKeywordEvaluator } from '../lib/evaluation/server-keyword-evaluator';
import { demoDraft } from '../lib/projects/demo';
import { deriveCriteria, parseProjects, processDraft, revisionDraft } from '../lib/projects/domain';
import type { ProjectActor } from '../lib/projects/types';
import { POST } from '../app/api/analysis/keywords/route';

const actor: ProjectActor = { id: 'reviewer', role: 'recruiter', name: '담당자', provider: '데모' };
function draft() {
  const d = demoDraft(actor);
  d.people = d.people.slice(0, 1);
  d.documents = d.documents.filter((doc) => doc.applicantId === d.people[0].id).slice(0, 1);
  d.documents[0].filename = 'candidate.pdf';
  d.documents[0].pages = [{ number: 3, text: 'Docker 구현 경험\nMySQL 운영 경험' }];
  d.criteria = [
    {
      id: 'architecture',
      name: '아키텍처 설계',
      keywords: ['아키텍처 설계'],
      required: true,
      description: '아키텍처 설계 경험',
    },
    {
      id: 'db',
      name: 'PostgreSQL',
      keywords: ['postgresql'],
      required: true,
      description: '관계형 DB 경험',
    },
    { id: 'cache', name: 'Redis', keywords: ['redis'], required: false, description: '캐시 경험' },
  ];
  return d;
}
const payload = {
  version: 'experience-keywords-v1',
  results: [
    {
      criterionId: 'architecture',
      related: true,
      matches: [
        {
          jdKeyword: '아키텍처 설계',
          relation: 'RELATED',
          matchedKeyword: 'docker',
          evidence: 'Docker 구현 경험',
        },
      ],
    },
    {
      criterionId: 'db',
      related: true,
      matches: [
        {
          jdKeyword: 'postgresql',
          relation: 'RELATED',
          matchedKeyword: 'mysql',
          evidence: 'MySQL 운영 경험',
        },
      ],
    },
    {
      criterionId: 'cache',
      related: false,
      matches: [{ jdKeyword: 'redis', relation: 'NONE', matchedKeyword: null, evidence: null }],
    },
  ],
};

test('recruiter uses server by default, keeps keyword explanations, source pages and history', async (t) => {
  t.mock.method(
    globalThis,
    'fetch',
    async function (this: unknown, url: string, init: RequestInit) {
      assert.ok(
        !(this instanceof ServerKeywordEvaluator),
        'fetch must not receive the evaluator as its receiver',
      );
      assert.equal(url, '/api/analysis/keywords');
      const body = JSON.parse(String(init.body));
      assert.equal(body.text, 'Docker 구현 경험\nMySQL 운영 경험');
      assert.equal('birthDate' in body, false);
      return Response.json(payload);
    },
  );
  const project = await processDraft(draft(), actor, undefined, () => {});
  const analysis = project.revisions[0].analyses[0];
  assert.equal(analysis.evaluatorVersion, payload.version);
  assert.equal(analysis.score, 67);
  assert.equal(analysis.results[0].status, 'confirmed');
  assert.equal(analysis.results[0].keywordMatches?.[0].relation, 'RELATED');
  assert.deepEqual(analysis.results[0].sources, [
    {
      documentId: project.revisions[0].documents[0].id,
      filename: 'candidate.pdf',
      page: 3,
      excerpt: 'Docker 구현 경험',
    },
  ]);
  assert.equal(analysis.results[2].status, 'missing');
  assert.deepEqual(
    parseProjects(JSON.stringify({ version: 1, actor, projects: [project] })).projects[0],
    project,
  );
  const next = await processDraft(revisionDraft(project), actor, project, () => {});
  assert.deepEqual(next.revisions[0], project.revisions[0]);
  assert.equal(next.revisions.length, 2);
});

test('server outage or fabricated evidence fails analysis without changing the draft', async () => {
  const d = draft();
  const before = JSON.stringify(d);
  const failing = new ServerKeywordEvaluator(async () => new Response('', { status: 502 }));
  await assert.rejects(() => processDraft(d, actor, undefined, () => {}, failing), /서버 분석/);
  const bad = structuredClone(payload);
  bad.results[0].matches[0].evidence = '존재하지 않는 원문';
  await assert.rejects(
    () =>
      processDraft(
        d,
        actor,
        undefined,
        () => {},
        new ServerKeywordEvaluator(async () => Response.json(bad)),
      ),
    /근거가 일치/,
  );
  assert.equal(JSON.stringify(d), before);
});

test('unreadable documents remain unknown, not unrelated; old snapshots still parse', async () => {
  const d = draft();
  d.documents[0].unreadablePages = [4];
  const p = await processDraft(
    d,
    actor,
    undefined,
    () => {},
    new ServerKeywordEvaluator(async () => Response.json(payload)),
  );
  assert.equal(p.revisions[0].analyses[0].results[2].status, 'unreadable');
  const legacy = structuredClone(p);
  for (const a of legacy.revisions[0].analyses) {
    delete a.evaluatorVersion;
    for (const r of a.results) delete r.keywordMatches;
  }
  assert.equal(
    parseProjects(JSON.stringify({ version: 1, actor, projects: [legacy] })).projects.length,
    1,
  );
});

test('JD extraction includes broad architecture and server experience', () => {
  const criteria = deriveCriteria(
    '아키텍처 설계 경험과 서버 구현 경험, Docker 사용 경험을 필수로 확인합니다.',
  );
  assert.ok(criteria.some((c) => c.name === '아키텍처 설계 경험'));
  assert.ok(criteria.some((c) => c.name === '서버 구현 경험'));
  assert.ok(criteria.some((c) => c.name === 'Docker'));
  assert.deepEqual(deriveCriteria('PostgreSQL 데이터베이스 사용 경험이 필요합니다.')[0].keywords, [
    'postgresql',
  ]);
});

test('proxy validates input, forwards only analysis data and handles server failure', async (t) => {
  const oldUrl = process.env.WANTEDHACKER_SERVER_URL;
  process.env.WANTEDHACKER_SERVER_URL = 'http://127.0.0.1:18080';
  t.after(() => {
    if (oldUrl === undefined) delete process.env.WANTEDHACKER_SERVER_URL;
    else process.env.WANTEDHACKER_SERVER_URL = oldUrl;
  });
  const makeRequest = (body: unknown) =>
    new Request('http://localhost/api/analysis/keywords', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    calls++;
    assert.equal(url, 'http://127.0.0.1:18080/api/analysis/keywords');
    assert.equal(JSON.parse(String(init.body)).name, undefined);
    return Response.json(payload);
  });
  assert.equal((await POST(makeRequest({ criteria: [], text: '' }))).status, 400);
  assert.equal(calls, 0);
  const response = await POST(
    makeRequest({
      criteria: [{ id: 'db', keywords: ['postgresql'] }],
      text: 'MySQL',
      name: 'private',
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), payload);
  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('offline');
  });
  assert.equal(
    (await POST(makeRequest({ criteria: [{ id: 'db', keywords: ['postgresql'] }], text: 'MySQL' })))
      .status,
    502,
  );
});
