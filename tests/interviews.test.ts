import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInterviewInput,
  newPacket,
  regeneratePacket,
  packetKey,
  saveInterview,
  templateQuestions,
  interviewText,
} from '../lib/interview/domain';
import { generateInterview } from '../lib/interview/generator';
import { interviewInputSchema } from '../lib/interview/types';
import { parseProjects, saveProject } from '../lib/projects/domain';
import type { AnalysisProject, ProjectDB } from '../lib/projects/types';
import { POST } from '../app/api/interviews/route';

function fixture(role: 'applicant' | 'recruiter' = 'recruiter'): AnalysisProject {
  return {
    id: 'project',
    ownerId: 'owner',
    role,
    title: '백엔드 개발자',
    createdAt: '2026-09-17',
    jd: {
      mode: 'text',
      reference: '입력',
      text: 'Java API 개발 경험\n데이터베이스 설계 경험\n고객 요구사항 조율 경험',
    },
    criteria: [
      {
        id: 'java',
        name: 'Java API',
        keywords: ['Java'],
        description: 'Java 개발',
        required: true,
      },
      {
        id: 'db',
        name: '데이터베이스 설계',
        keywords: ['데이터베이스'],
        description: '설계',
        required: true,
        core: true,
      },
      {
        id: 'pm',
        name: '요구사항 조율',
        keywords: ['요구사항'],
        description: '조율',
        required: false,
      },
    ],
    revisions: [
      {
        id: 'r1',
        number: 1,
        createdAt: '2026-09-17',
        status: 'success',
        taskType: 'analysis',
        people: [{ id: 'person', name: '홍길동', birthDate: '1990-01-01', experience: 3 }],
        documents: [
          {
            id: 'doc',
            applicantId: 'person',
            filename: '가상 이력서.txt',
            size: 20,
            status: 'ready',
            source: 'text',
            pages: [{ number: 2, text: 'Java API를 구현하여 처리 시간을 개선했습니다.' }],
          },
        ],
        analyses: [
          {
            id: 'a1',
            personId: 'person',
            name: '홍길동',
            birthDate: '1990-01-01',
            score: 80,
            summary: '요약',
            results: [
              {
                criterionId: 'java',
                mentioned: true,
                reading: 'O',
                status: 'confirmed',
                reason: '확인',
                sources: [
                  {
                    documentId: 'doc',
                    filename: '가상 이력서.txt',
                    page: 2,
                    excerpt: 'Java API를 구현하여 처리 시간을 개선했습니다.',
                  },
                ],
              },
              {
                criterionId: 'db',
                mentioned: false,
                reading: '-',
                status: 'missing',
                reason: '없음',
                sources: [],
              },
              {
                criterionId: 'pm',
                mentioned: false,
                reading: '-',
                status: 'unreadable',
                reason: '판독 불가',
                sources: [],
              },
            ],
          },
        ],
      },
    ],
  };
}
function setup(role: 'applicant' | 'recruiter' = 'recruiter') {
  const p = fixture(role),
    r = p.revisions[0],
    a = r.analyses[0];
  const input = buildInterviewInput(p, r, a);
  const packet = newPacket(p, r, a, templateQuestions(input));
  const db: ProjectDB = {
    version: 1,
    actor: { id: 'owner', role, name: '사용자', provider: 'demo' },
    projects: [p],
  };
  return { p, r, a, input, packet, db };
}

test('JD-only gives six questions; personalized gives three common and four evidence questions', () => {
  const { p, input } = setup();
  assert.equal(templateQuestions(buildInterviewInput(p)).questions.length, 6);
  const result = templateQuestions(input);
  assert.equal(result.questions.length, 7);
  assert.equal(result.questions.filter((q) => q.kind === 'common').length, 3);
  assert.equal(result.questions.find((q) => q.kind === 'personal')?.topicId, 'db');
  assert.ok(result.questions.some((q) => q.reason.includes('읽지 못해')));
  const source = result.questions.flatMap((q) => q.sources)[0];
  assert.equal(source.page, 2);
  assert.equal(source.excerpt, 'Java API를 구현하여 처리 시간을 개선했습니다.');
});

test('unverified, cross-applicant and fabricated source excerpts never become question citations', () => {
  const { p, r, a } = setup();
  r.documents[0].applicantId = 'another-person';
  assert.deepEqual(buildInterviewInput(p, r, a).topics[0].sources, []);
  r.documents[0].applicantId = a.personId;
  a.results[0].sources[0].excerpt = '성능 99% 개선';
  assert.deepEqual(buildInterviewInput(p, r, a).topics[0].sources, []);
  assert.equal(buildInterviewInput(p, r, a).topics[0].evidence, 'missing');
});

test('common questions remain identical across candidates with different evidence', () => {
  const { p, r, a, input } = setup();
  const other = structuredClone(a);
  other.results = [];
  other.id = 'other';
  const common = (i: typeof input) =>
    templateQuestions(i).questions.filter((q) => q.kind === 'common');
  assert.deepEqual(common(input), common(buildInterviewInput(p, r, other)));
});

test('generation input excludes identity, internal scores, weights and saved private notes', () => {
  const { p, r, a, packet } = setup('applicant');
  packet.questions[0].note = 'PRIVATE NOTE';
  p.interviews = [packet];
  p.criteria[0].weight = 99;
  const json = JSON.stringify(buildInterviewInput(p, r, a));
  for (const secret of [
    '홍길동',
    '1990-01-01',
    'PRIVATE NOTE',
    '"score"',
    '"weight"',
    '"minimumRatio"',
    '"ownerId"',
  ])
    assert.ok(!json.includes(secret), secret);
});

test('interview save checks owner, role, revision and optimistic version', () => {
  const { db, packet } = setup();
  const saved = saveInterview(db, 'project', packet, 0);
  assert.equal(saved.projects[0].interviews?.[0].version, 1);
  assert.throws(() => saveInterview(saved, 'project', packet, 0), /다른 화면/);
  assert.throws(
    () => saveInterview({ ...db, actor: { ...db.actor!, id: 'other' } }, 'project', packet, 0),
    /접근/,
  );
  assert.throws(() => saveInterview(db, 'project', { ...packet, role: 'applicant' }, 0), /접근/);
  assert.throws(() => saveInterview(db, 'project', { ...packet, revisionId: 'r2' }, 0), /버전/);
  assert.throws(() => saveInterview(db, 'project', { ...packet, analysisId: 'other' }, 0), /버전/);
  assert.equal(packetKey('r2', 'a1') === packet.key, false);
});

test('notes, interview status and questions persist without changing the original analysis', () => {
  const { db, packet, p } = setup();
  packet.questions[0].note = '면접에서 설계 근거 확인';
  packet.questions[0].assessment = 'confirmed';
  packet.stage = 'completed';
  const saved = saveInterview(db, 'project', packet, 0);
  const restored = parseProjects(JSON.stringify(saved));
  assert.equal(restored.projects[0].interviews?.[0].questions[0].note, '면접에서 설계 근거 확인');
  assert.equal(restored.projects[0].interviews?.[0].stage, 'completed');
  assert.deepEqual(restored.projects[0].revisions, p.revisions);
  assert.equal(parseProjects(JSON.stringify(db)).projects[0].interviews, undefined);
});

test('saving an in-flight new analysis preserves latest interview notes and previous packets', () => {
  const { db, packet, p } = setup();
  const saved = saveInterview(db, 'project', packet, 0);
  const pending = structuredClone(p);
  pending.revisions.push({ ...pending.revisions[0], id: 'r2', number: 2 });
  const merged = saveProject(saved, pending, 1);
  assert.deepEqual(merged.projects[0].interviews, saved.projects[0].interviews);
  assert.equal(merged.projects[0].revisions.length, 2);
});

test('no credentials makes no outbound call and labels templates honestly', async () => {
  const { input } = setup();
  const result = await generateInterview(input, {
    fetch: async () => {
      throw new Error('must not call');
    },
  });
  assert.equal(result.generation, 'template');
  assert.match(result.notice, /기본 질문/);
});

test('provider uses validated JSON; keeps common questions and source metadata immutable', async () => {
  const { input } = setup();
  const base = templateQuestions(input);
  let requestBody: Record<string, unknown> = {};
  const result = await generateInterview(input, {
    apiKey: 'fake',
    model: 'test-model',
    fetch: async (_url, options) => {
      requestBody = JSON.parse(options!.body as string);
      return Response.json({
        status: 'completed',
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: JSON.stringify({
                  questions: base.questions
                    .filter((q) => q.kind === 'personal')
                    .map((q) => ({
                      id: q.id,
                      question: `${q.topic}에 대한 판단 이유를 설명해 주세요.`,
                      followups: ['대안은 무엇이었나요?'],
                      guide: ['사례를 정리하세요.'],
                      sources: [{ excerpt: 'invented' }],
                    })),
                }),
              },
            ],
          },
        ],
      });
    },
  });
  assert.equal(requestBody.store, false);
  assert.equal(result.generation, 'ai');
  assert.deepEqual(
    result.questions.filter((q) => q.kind === 'common'),
    base.questions.filter((q) => q.kind === 'common'),
  );
  assert.deepEqual(
    result.questions.map((q) => q.sources),
    base.questions.map((q) => q.sources),
  );
  assert.ok(!JSON.stringify(result).includes('invented'));
});

test('provider refusal, failure, incomplete responses and invalid IDs fall back without leaking errors', async () => {
  const { input } = setup();
  for (const payload of [
    { status: 'incomplete' },
    { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal' }] }] },
    {
      status: 'completed',
      output: [
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text: JSON.stringify({
                questions: [
                  { id: 'wrong', question: '질문', guide: ['가이드'], followups: ['후속'] },
                ],
              }),
            },
          ],
        },
      ],
    },
  ]) {
    const result = await generateInterview(input, {
      apiKey: 'secret',
      model: 'test',
      fetch: async () => Response.json(payload),
    });
    assert.equal(result.generation, 'template');
    assert.match(result.notice, /생성하지 못해/);
    assert.ok(!result.notice.includes('secret'));
  }
  const failed = await generateInterview(input, {
    apiKey: 'secret',
    model: 'test',
    fetch: async () => {
      throw new Error('secret');
    },
  });
  assert.equal(failed.generation, 'template');
});

test('API validates input, origins and payload size; response is not cached', async () => {
  const { input } = setup();
  const make = (body: string, origin = 'http://localhost:3000') =>
    new Request('http://localhost:3000/api/interviews', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body,
    });
  assert.equal((await POST(make(JSON.stringify(input), 'https://other.example'))).status, 403);
  assert.equal((await POST(make('{}'))).status, 400);
  assert.equal((await POST(make('not-json'))).status, 400);
  assert.equal((await POST(make(' '.repeat(180001)))).status, 413);
  assert.equal(
    (await POST(make(JSON.stringify({ ...input, priorityIds: ['invalid'] })))).status,
    400,
  );
  const response = await POST(make(JSON.stringify(input)));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).questions.length, 7);
  assert.equal(interviewInputSchema.safeParse({ ...input, topics: [] }).success, false);
});

test('export includes interview evidence, preparation status and notes as plain text', () => {
  const { packet } = setup('applicant');
  packet.questions[0].note = '<script>alert(1)</script>';
  packet.questions[0].prepared = true;
  const text = interviewText('가상 지원자', packet);
  assert.match(text, /준비: 완료/);
  assert.match(text, /답변 가이드/);
  assert.match(text, /<script>/);
  assert.ok(!text.includes('총점'));
});

test('regeneration preserves edited questions, notes, ordering and deleted questions; changed wording clears assessment', () => {
  const { packet, input } = setup();
  packet.questions = packet.questions.slice(1).reverse();
  packet.questions[0] = {
    ...packet.questions[0],
    edited: true,
    question: '직접 수정한 질문',
    note: '직접 메모',
    prepared: true,
    assessment: 'confirmed',
  };
  packet.questions[1] = {
    ...packet.questions[1],
    note: '기존 메모',
    prepared: true,
    assessment: 'confirmed',
  };
  const generated = templateQuestions(input);
  generated.questions = generated.questions.map((q) => ({ ...q, question: '새로 생성된 질문' }));
  const result = regeneratePacket(packet, generated);
  assert.deepEqual(
    result.questions.map((q) => q.id),
    packet.questions.map((q) => q.id),
  );
  assert.deepEqual(result.questions[0], packet.questions[0]);
  assert.equal(result.questions[1].note, '기존 메모');
  assert.equal(result.questions[1].prepared, false);
  assert.equal(result.questions[1].assessment, 'not-asked');
});

test('Docker standalone accepts same browser host while rejecting a different origin host', async () => {
  const { input } = setup();
  const make = (origin: string) =>
    new Request('http://0.0.0.0:3000/api/interviews', {
      method: 'POST',
      headers: { 'content-type': 'application/json', host: 'localhost:3000', origin },
      body: JSON.stringify(input),
    });
  assert.equal((await POST(make('http://localhost:3000'))).status, 200);
  assert.equal((await POST(make('http://evil.example'))).status, 403);
  assert.equal((await POST(make('null'))).status, 403);
});
