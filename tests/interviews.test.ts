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
import {
  applyInterviewReview,
  interviewReviewSchema,
  reviewQuestionStatus,
  reviewStorageKey,
} from '../lib/interview/review';
import { generateInterview } from '../lib/interview/generator';
import { interviewInputSchema } from '../lib/interview/types';
import { validExperienceContext } from '../lib/interview/context';
import { parseProjects, saveProject } from '../lib/projects/domain';
import type { AnalysisProject, ProjectDB } from '../lib/projects/types';
import { authFixture } from './auth-fixture';
const testSecret = 'test-proxy-secret-at-least-thirty-two-characters';
process.env.INTERVIEW_PROXY_SECRET = testSecret;
const { cookie } = authFixture({
  id: 'owner',
  name: '테스트',
  role: 'recruiter',
  provider: 'test',
});
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
            pages: [
              { number: 2, text: '경력 사항\nJava API를 구현하여 처리 시간을 개선했습니다.' },
            ],
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

function contextFor(experienceId: string, evidenceId: string, value = 'Java API') {
  return {
    experienceId,
    activityType: 'software-development',
    status: 'clear',
    target: { value, evidenceId },
    action: { value, evidenceId },
    role: null,
    participants: null,
    scale: null,
    scaleMeaning: 'unknown',
  };
}

test('JD-only gives no questions; career evidence gives four personal questions', () => {
  const { p, input } = setup();
  assert.equal(templateQuestions(buildInterviewInput(p)).questions.length, 0);
  const result = templateQuestions(input);
  assert.equal(result.questions.length, 4);
  assert.equal(result.questions.filter((q) => q.kind === 'common').length, 0);
  assert.match(result.questions.find((q) => q.kind === 'personal')!.topicId, /^experience-/);
  assert.ok(
    result.questions
      .filter((q) => q.kind === 'personal')
      .every((q) => q.topic.length <= 30 && !q.topic.includes('구현하여') && q.sources.length > 0),
  );
  assert.ok(!result.questions.some((q) => q.kind === 'personal' && q.topicId === 'db'));
  const source = result.questions.flatMap((q) => q.sources)[0];
  assert.equal(source.page, 2);
  assert.equal(source.excerpt, 'Java API를 구현하여 처리 시간을 개선했습니다.');
});

test('experience topics come from applicant text even without JD keyword matches, across roles', () => {
  const { p, r, a } = setup();
  const experiences = [
    'Redis 캐시를 구현하여 조회 응답 시간을 30% 개선했습니다.',
    'React 화면의 접근성을 개선하고 키보드 탐색을 구현했습니다.',
    '금융 고객과 요구사항을 조율하고 프로젝트 일정을 관리했습니다.',
    'Figma 프로토타입을 제작하여 사용자 테스트를 수행했습니다.',
  ];
  r.documents[0].pages = [{ number: 1, text: ['경력', ...experiences].join('\n') }];
  a.results = [];
  const input = buildInterviewInput(p, r, a);
  assert.equal(input.experienceTopics?.length, 4);
  const personal = templateQuestions(input).questions.filter((q) => q.kind === 'personal');
  assert.equal(new Set(personal.map((q) => q.topicId)).size, 4);
  for (const q of personal) {
    assert.ok(experiences.includes(q.sources[0].excerpt));
    // Context stays on the question card and in evidence, rather than a repeated long quotation.
    assert.ok(!q.question.includes(q.sources[0].excerpt));
    assert.ok(q.question.length <= 80);
    assert.equal(q.question.split('?').length - 1, 1);
    assert.equal(
      q.jdEvidence,
      q.sources[0].excerpt.includes('요구사항') ? '고객 요구사항 조율 경험' : '',
    );
  }
});

test('experience extraction deduplicates evidence and excludes other applicants, unreadable pages and identity', () => {
  const { p, r, a } = setup();
  const original = 'Java API를 구현하여 처리 시간을 개선했습니다.';
  r.documents[0].pages = [
    {
      number: 1,
      text: [
        '경력',
        original,
        original,
        '이름: 홍길동 개발자',
        '사용자의 문제를 안정적인 서비스로 해결하는 백엔드 개발자입니다.',
        '개발자 연락처: dev@example.com',
        '종교 단체에서 프로젝트를 관리했습니다.',
        'Kubernetes 운영 경험이 없습니다.',
        'Kafka 운영 경험은 없습니다.',
        '서비스를 직접 배포해 보지 않았습니다.',
        'I have never managed a Kafka cluster.',
        'Redis를 개발에 도입하고 싶습니다.',
        'Java, Redis, Kafka, Docker',
      ].join('\n'),
    },
    { number: 2, text: '판독 불가 페이지에서 서버를 설계했습니다.' },
  ];
  r.documents[0].unreadablePages = [2];
  r.documents.push({
    ...r.documents[0],
    id: 'other',
    applicantId: 'other-person',
    pages: [{ number: 1, text: '다른 지원자가 대형 서비스를 구축했습니다.' }],
  });
  const input = buildInterviewInput(p, r, a);
  assert.equal(input.experienceTopics?.length, 1);
  assert.equal(input.experienceTopics![0].sources[0].excerpt, original);
  assert.equal(input.experienceTopics![0].sources[0].page, 1);
  assert.deepEqual(input.experienceTopics, buildInterviewInput(p, r, a).experienceTopics);
});

test('without written experiences no personal questions are invented and AI is not called', async () => {
  const { p, r, a } = setup();
  r.documents[0].pages = [{ number: 1, text: '기술 스택: Java, Redis, Kafka' }];
  const input = buildInterviewInput(p, r, a);
  const result = await generateInterview(input, {
    serverUrl: 'http://server:8080',
    proxySecret: 'test',
    fetch: async () => {
      throw new Error('must not call');
    },
  });
  assert.equal(result.questions.length, 0);
  assert.ok(result.questions.every((q) => q.kind === 'common'));
  assert.match(result.notice, /경력 항목에서/);
});

test('only career sections reach question generation, excluding stronger non-career examples', async () => {
  const { p, r, a } = setup();
  const career = 'Spring Boot 주문 API를 구현하고 조회 시간을 개선했습니다.';
  r.documents[0].pages = [
    {
      number: 1,
      text: [
        '자기소개',
        'Redis 캐시를 설계하여 처리량을 200% 개선했습니다.',
        '## 경력 사항 (4년)',
        career,
        '학력',
        '학교에서 Kafka 서버를 설계하고 처리 시간을 90% 단축했습니다.',
        '개인 프로젝트',
        'Docker 배포를 자동화하여 시간을 80% 단축했습니다.',
        '기술 스택',
        'MySQL 데이터베이스를 설계했습니다.',
      ].join('\n'),
    },
  ];
  const input = buildInterviewInput(p, r, a);
  assert.deepEqual(
    input.experienceTopics?.map((t) => t.sources[0].excerpt),
    [career],
  );
  const result = await generateInterview(input, {
    serverUrl: 'http://server',
    proxySecret: 'test',
    fetch: async (_url, options) => {
      const body = JSON.parse(options!.body as string);
      assert.equal(body.questions.length, 4);
      assert.ok(body.questions.every((q: { evidence: string[] }) => q.evidence[0] === career));
      assert.ok(!/200%|90%|80%|Docker|Redis|Kafka/.test(JSON.stringify(body)));
      return Response.json({
        questions: body.questions.map(
          (q: { id: string; experienceId: string; evidenceIds: string[] }) => ({
            id: q.id,
            experienceId: q.experienceId,
            evidenceIds: q.evidenceIds,
            context: contextFor(q.experienceId, q.evidenceIds[0], '주문 API'),
            title: '주문 API 성능 개선',
            reason: '직접 담당한 API 개발 범위를 확인합니다.',
            grounding: 'verified',
            question: '주문 API에서 직접 맡은 부분은 무엇인가요?',
            followups: ['결과는 어떻게 확인하셨나요?'],
            guide: ['담당 업무를 설명하세요.'],
          }),
        ),
      });
    },
  });
  assert.equal(result.generation, 'ai');
  assert.ok(
    result.questions.every((q) => q.kind === 'personal' && q.sources[0].excerpt === career),
  );
});

test('career sections continue across pages, stop at other headings and reset per document', () => {
  const { p, r, a } = setup();
  const work = 'Developed payment APIs and improved response time.';
  const continuation = 'Implemented billing automation and reduced manual work.';
  r.documents[0].pages = [
    { number: 1, text: `WORK EXPERIENCE\n${work}` },
    {
      number: 2,
      text: `${continuation}\nSKILLS: React, Java\nDeveloped a personal React application.`,
    },
  ];
  r.documents.push({
    ...r.documents[0],
    id: 'portfolio',
    filename: '포트폴리오.txt',
    pages: [{ number: 1, text: 'Designed a personal project and improved its performance.' }],
  });
  const topics = buildInterviewInput(p, r, a).experienceTopics!;
  assert.equal(topics.length, 2);
  assert.deepEqual(new Set(topics.map((t) => t.sources[0].excerpt)), new Set([work, continuation]));
  assert.equal(topics.find((t) => t.sources[0].excerpt === continuation)?.sources[0].page, 2);
});

test('inline career headings and employer project descriptions work without including side projects', () => {
  const { p, r, a } = setup();
  const work = '주문 서비스를 개발하고 배포 자동화를 구현했습니다.';
  r.documents[0].pages = [
    {
      number: 1,
      text: `경력: 4년\n프로젝트: 주문 서비스\n${work}\n개인 프로젝트: 실습\n개인용 알림 서비스를 개발했습니다.`,
    },
  ];
  assert.deepEqual(
    buildInterviewInput(p, r, a).experienceTopics?.map((t) => t.sources[0].excerpt),
    [work],
  );
  r.documents[0].pages = [{ number: 1, text: `[경력 사항]: ${work}` }];
  assert.deepEqual(
    buildInterviewInput(p, r, a).experienceTopics?.map((t) => t.sources[0].excerpt),
    [work],
  );
});

test('an unreadable intervening page cannot leak later non-career content into career questions', () => {
  const { p, r, a } = setup();
  r.documents[0].pages = [
    { number: 1, text: '경력\nJava API를 구현하여 처리 시간을 개선했습니다.' },
    { number: 2, text: '' },
    { number: 3, text: '개인 앱을 개발하고 화면을 설계했습니다.' },
  ];
  r.documents[0].unreadablePages = [2];
  const topics = buildInterviewInput(p, r, a).experienceTopics!;
  assert.equal(topics.length, 1);
  assert.equal(topics[0].sources[0].page, 1);
});

test('previous packets remain stored but are not reused as career-only questions', () => {
  const { db, packet, p, r, a } = setup();
  const old = { ...packet, key: `interview-v1:${r.id}:${a.id}` };
  old.questions[0].note = '이전 질문 메모';
  p.interviews = [old];
  const saved = saveInterview(db, p.id, packet, 0);
  assert.equal(saved.projects[0].interviews?.length, 2);
  assert.equal(
    saved.projects[0].interviews?.find((q) => q.key === old.key)?.questions[0].note,
    '이전 질문 메모',
  );
  assert.notEqual(old.key, packetKey(r.id, a.id));
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

test('questions are empty when the applicant has no career section even if JD matches', () => {
  const { p, r, a } = setup();
  r.documents[0].pages[0].text = 'Java API를 구현하여 처리 시간을 개선했습니다.';
  assert.deepEqual(templateQuestions(buildInterviewInput(p, r, a)).questions, []);
});

test('study interpretation survives generation, review and storage with participant scale attached to the original quote', async () => {
  const { p, r, a, db } = setup();
  const excerpt = '회사 업무로 50명 규모의 개발자 스터디를 운영했습니다.';
  r.documents[0].pages = [
    { number: 2, text: `경력 사항\n사내 교육 담당\n${excerpt}\n학력\n학교 동아리 활동` },
  ];
  const input = buildInterviewInput(p, r, a);
  assert.ok(input.experienceTopics![0].careerContext?.includes('사내 교육 담당'));
  assert.ok(!input.experienceTopics![0].careerContext?.includes('학교 동아리'));
  const result = await generateInterview(input, {
    serverUrl: 'http://server',
    proxySecret: 'fake',
    fetch: async (_url, options) => {
      const body = JSON.parse(String(options?.body));
      return Response.json({
        questions: body.questions.map(
          (q: {
            id: string;
            experienceId: string;
            evidenceIds: string[];
            careerContext: string;
          }) => {
            assert.ok(q.careerContext.includes('사내 교육 담당'));
            return {
              id: q.id,
              experienceId: q.experienceId,
              evidenceIds: q.evidenceIds,
              title: '개발자 스터디 운영',
              reason: '직접 맡은 활동을 확인합니다.',
              grounding: 'verified',
              question: '스터디 운영에서 직접 맡은 일은 무엇인가요?',
              followups: ['진행 방식은 어떻게 정해졌나요?'],
              guide: ['직접 수행한 일을 정리하세요.'],
              context: {
                experienceId: q.experienceId,
                activityType: 'community-operation',
                status: 'clear',
                target: { value: '개발자 스터디', evidenceId: q.evidenceIds[0] },
                action: { value: '운영', evidenceId: q.evidenceIds[0] },
                role: null,
                participants: { value: '개발자', evidenceId: q.evidenceIds[0] },
                scale: { value: '50명', evidenceId: q.evidenceIds[0] },
                scaleMeaning: 'participants',
              },
            };
          },
        ),
      });
    },
  });
  assert.equal(result.generation, 'ai');
  const q = result.questions[0];
  assert.equal(q.context?.activityType, 'community-operation');
  assert.equal(q.context?.role, null);
  assert.equal(q.context?.scaleMeaning, 'participants');
  assert.equal(validExperienceContext(q.context!, q), true);
  assert.equal(
    validExperienceContext(
      { ...q.context!, role: { value: '개발팀장', evidenceId: q.evidenceIds![0] } },
      q,
    ),
    false,
  );
  assert.equal(
    validExperienceContext(
      { ...q.context!, target: { value: '개발자 스터디', evidenceId: 'foreign' } },
      q,
    ),
    false,
  );
  const packet = newPacket(p, r, a, result);
  packet.questions[0].prepared = true;
  packet.questions[0].note = '운영 범위 확인';
  const saved = parseProjects(JSON.stringify(saveInterview(db, p.id, packet, 0)));
  assert.deepEqual(saved.projects[0].interviews![0].questions[0].context, q.context);
  const changed = { ...q, context: { ...q.context!, scaleMeaning: 'unknown' as const } };
  assert.equal(reviewQuestionStatus(changed, [q]), 'changed');
  const regenerated = regeneratePacket(packet, {
    ...result,
    questions: [changed, ...result.questions.slice(1)],
  });
  assert.equal(regenerated.questions[0].prepared, false);
  assert.equal(regenerated.questions[0].note, '운영 범위 확인');
});

test('missing or fabricated interpretation falls back and non-career experiences are omitted', async () => {
  const { input } = setup();
  for (const mode of ['missing', 'fabricated', 'excluded']) {
    const result = await generateInterview(input, {
      serverUrl: 'http://server',
      proxySecret: 'fake',
      fetch: async (_url, options) => {
        const body = JSON.parse(String(options?.body));
        return Response.json({
          questions: body.questions.map(
            (q: { id: string; experienceId: string; evidenceIds: string[] }) => ({
              id: q.id,
              experienceId: q.experienceId,
              evidenceIds: q.evidenceIds,
              title: '개발팀 운영',
              reason: '관리 역량 확인',
              question: '팀을 어떻게 관리했나요?',
              followups: ['관리 방법은 무엇인가요?'],
              guide: ['팀 관리를 설명하세요.'],
              grounding: mode === 'excluded' ? 'excluded' : 'verified',
              ...(mode === 'fabricated'
                ? { context: contextFor(q.experienceId, q.evidenceIds[0], '개발팀') }
                : {}),
            }),
          ),
        });
      },
    });
    assert.equal(result.generation, 'template');
    if (mode === 'excluded') {
      assert.equal(result.questions.length, 0);
      assert.match(result.notice, /경력 범위 밖/);
    } else {
      assert.equal(result.questions.length, 4);
      assert.ok(result.questions.every((q) => q.grounding === 'fallback' && !q.context));
      assert.ok(!JSON.stringify(result).includes('개발팀'));
    }
  }
});

test('planning motivation in a JD result cannot enable career questions, even under a career heading', () => {
  const { p, r, a } = setup('applicant');
  const motivation =
    '과 소통하고 토론하며 결과를 만들어가는 과정이 서비스 기획 직무와 맞닿아 있음을 느껴 관심을 갖게 되었습니다.';
  p.criteria = [
    {
      id: 'planning',
      name: '문제·요구사항 정의',
      keywords: ['서비스 기획'],
      required: true,
      description: '기획',
    },
  ];
  a.results = [
    {
      criterionId: 'planning',
      mentioned: true,
      reading: 'O',
      status: 'review',
      reason: '키워드 언급',
      sources: [{ documentId: 'doc', filename: '가상 이력서.txt', page: 2, excerpt: motivation }],
    },
  ];
  for (const title of ['지원 동기', '경력 사항']) {
    r.documents[0].pages = [{ number: 2, text: `${title}\n${motivation}` }];
    const input = buildInterviewInput(p, r, a);
    assert.equal(a.results[0].sources.length, 1);
    assert.equal(input.experienceTopics?.length, 0);
    assert.equal(templateQuestions(input).questions.length, 0);
  }
  const career = '고객 요구사항을 정리하고 주문 화면을 설계했습니다.';
  r.documents[0].pages[0].text += `\n${career}`;
  const input = buildInterviewInput(p, r, a);
  assert.deepEqual(
    input.experienceTopics?.map((topic) => topic.sources[0].excerpt),
    [career],
  );
  assert.equal(templateQuestions(input).questions.length, 4);
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

test('provider uses only career evidence and keeps source metadata immutable', async () => {
  const { input } = setup();
  const base = templateQuestions(input);
  let requestBody: Record<string, unknown> = {};
  const result = await generateInterview(input, {
    serverUrl: 'http://server:8080',
    proxySecret: 'fake',
    fetch: async (_url, options) => {
      requestBody = JSON.parse(options!.body as string);
      const seeds = requestBody.questions as { topic: string; evidence: string[] }[];
      assert.ok(
        seeds.every(
          (q) =>
            q.topic.length <= 30 &&
            q.evidence.includes('Java API를 구현하여 처리 시간을 개선했습니다.'),
        ),
      );
      assert.equal(_url, 'http://server:8080/api/interviews');
      assert.equal(new Headers(options?.headers).get('X-Interview-Proxy-Secret'), 'fake');
      return Response.json({
        questions: base.questions
          .filter((q) => q.kind === 'personal')
          .map((q) => ({
            id: q.id,
            experienceId: q.topicId,
            evidenceIds: q.evidenceIds,
            context: contextFor(q.topicId, q.evidenceIds![0]),
            title: 'Java API 성능 개선',
            reason: '응답 시간 개선 과정을 확인합니다.',
            grounding: 'verified',
            question: 'API 처리 시간은 어떻게 개선하셨나요?',
            followups: ['대안은 무엇이었나요?'],
            guide: ['사례를 정리하세요.'],
            sources: [{ excerpt: 'invented' }],
          })),
      });
    },
  });
  assert.equal(requestBody.prompt, input.prompt);
  assert.ok(!JSON.stringify(requestBody).includes('apiKey'));
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
  assert.equal(result.questions[0].topic, 'Java API 성능 개선');
  assert.equal(result.questions[0].reason, '응답 시간 개선 과정을 확인합니다.');
  assert.equal(result.questions[0].grounding, 'verified');
});

test('cross-experience citations and failed grounding fall back per question without losing valid questions', async () => {
  const { input } = setup();
  const base = templateQuestions(input);
  const result = await generateInterview(input, {
    serverUrl: 'http://server',
    proxySecret: 'test',
    fetch: async () =>
      Response.json({
        questions: base.questions.map((q, i) => ({
          id: q.id,
          experienceId: i === 0 ? 'other-experience' : q.topicId,
          evidenceIds: i === 1 ? ['invented-evidence'] : q.evidenceIds,
          context: contextFor(q.topicId, q.evidenceIds![0]),
          title: 'API 성능 개선',
          reason: '개선 과정을 확인합니다.',
          question: 'API 처리 시간을 어떻게 개선하셨나요?',
          followups: ['결과는 어떻게 확인하셨나요?'],
          guide: ['개선 과정을 정리하세요.'],
          grounding: i === 2 ? 'fallback' : 'verified',
        })),
      }),
  });
  assert.equal(result.generation, 'ai');
  assert.match(result.notice, /AI 질문 1개.*기본 질문 3개/);
  assert.deepEqual(result.questions.slice(0, 3), base.questions.slice(0, 3));
  assert.equal(result.questions[3].grounding, 'verified');
  assert.ok(!JSON.stringify(result).includes('invented-evidence'));
});

test('only cited original sources are displayed, never model supplied text', async () => {
  const { input } = setup();
  input.experienceTopics![0].sources.push({
    ...input.experienceTopics![0].sources[0],
    page: 3,
    excerpt: '실행 계획을 분석하고 인덱스를 개선했습니다.',
  });
  const result = await generateInterview(input, {
    serverUrl: 'http://server',
    proxySecret: 'test',
    fetch: async (_url, options) => {
      const body = JSON.parse(options!.body as string);
      return Response.json({
        questions: body.questions.map(
          (q: { id: string; experienceId: string; evidenceIds: string[] }) => ({
            id: q.id,
            experienceId: q.experienceId,
            evidenceIds: [q.evidenceIds[1]],
            context: contextFor(q.experienceId, q.evidenceIds[1], '인덱스'),
            title: '인덱스 개선',
            reason: '선택 기준 확인',
            grounding: 'verified',
            question: '인덱스는 어떤 기준으로 개선하셨나요?',
            followups: ['결과는 어떻게 확인하셨나요?'],
            guide: ['개선 기준을 정리하세요.'],
            sources: [{ excerpt: '위조 근거', page: 999 }],
          }),
        ),
      });
    },
  });
  assert.equal(result.generation, 'ai');
  for (const q of result.questions) {
    assert.deepEqual(q.sources, [input.experienceTopics![0].sources[1]]);
    assert.equal(q.evidenceIds?.length, 1);
  }
  assert.ok(!JSON.stringify(result).includes('위조'));
});

test('all rejected questions are labeled template and old server responses cannot bypass review', async () => {
  const { input } = setup();
  const base = templateQuestions(input);
  for (const legacy of [false, true]) {
    const result = await generateInterview(input, {
      serverUrl: 'http://server',
      proxySecret: 'test',
      fetch: async () =>
        Response.json({
          questions: base.questions.map((q) => ({
            id: q.id,
            question: '검토되지 않은 질문',
            followups: q.followups,
            guide: q.guide,
            ...(!legacy && {
              experienceId: q.topicId,
              evidenceIds: q.evidenceIds,
              title: 'API 개발',
              reason: '업무 확인',
              grounding: 'fallback',
            }),
          })),
        }),
    });
    assert.equal(result.generation, 'template');
    assert.deepEqual(result.questions, base.questions);
    assert.ok(!JSON.stringify(result).includes('검토되지 않은 질문'));
  }
});

test('title and citation changes are included in review status and persisted grounding survives reload', () => {
  const { packet, db, p } = setup();
  const q = packet.questions[0];
  assert.equal(reviewQuestionStatus({ ...q, topic: 'API 개선' }, packet.questions), 'changed');
  assert.equal(reviewQuestionStatus({ ...q, sources: [] }, packet.questions), 'changed');
  const restored = parseProjects(JSON.stringify(saveInterview(db, p.id, packet, 0)));
  assert.deepEqual(restored.projects[0].interviews?.[0].questions[0].evidenceIds, q.evidenceIds);
  assert.equal(restored.projects[0].interviews?.[0].questions[0].grounding, 'fallback');
});

test('changed evidence or followups reset preparation even if the main question is unchanged', () => {
  const { packet, input } = setup();
  packet.questions[0].prepared = true;
  packet.questions[0].assessment = 'confirmed';
  packet.questions[0].note = '직접 작성한 면접 메모';
  for (const change of ['source', 'followup']) {
    const generated = templateQuestions(input);
    if (change === 'source')
      generated.questions[0].sources = [
        {
          ...generated.questions[0].sources[0],
          page: 3,
          excerpt: 'API 조회 결과를 검증했습니다.',
        },
      ];
    else generated.questions[0].followups = ['직접 진행한 검증은 무엇인가요?'];
    const result = regeneratePacket(packet, generated).questions[0];
    assert.equal(result.prepared, false);
    assert.equal(result.assessment, 'not-asked');
    assert.equal(result.note, '직접 작성한 면접 메모');
  }
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
      serverUrl: 'http://server:8080',
      proxySecret: 'secret',
      fetch: async () => Response.json(payload),
    });
    assert.equal(result.generation, 'template');
    assert.match(result.notice, /생성하지 못해/);
    assert.ok(!result.notice.includes('secret'));
  }
  const failed = await generateInterview(input, {
    serverUrl: 'http://server:8080',
    proxySecret: 'secret',
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
      headers: { 'content-type': 'application/json', origin, cookie },
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
  assert.equal((await response.json()).questions.length, 4);
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
      headers: { 'content-type': 'application/json', host: 'localhost:3000', origin, cookie },
      body: JSON.stringify(input),
    });
  assert.equal((await POST(make('http://localhost:3000'))).status, 200);
  assert.equal((await POST(make('http://evil.example'))).status, 403);
  assert.equal((await POST(make('null'))).status, 403);
});

test('anonymous generation and mismatched login roles are rejected', async () => {
  const { input } = setup();
  const make = (headers: Record<string, string>, role = input.role) =>
    new Request('http://localhost:3000/api/interviews', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', ...headers },
      body: JSON.stringify({ ...input, role }),
    });
  assert.equal((await POST(make({}))).status, 401);
  assert.equal((await POST(make({ cookie }, 'applicant'))).status, 403);
});

test('project prompt persists and enters generation without scores or private notes', () => {
  const { p, r, a, db } = setup();
  p.interviewPrompt = '트레이드오프와 장애 대응을 중심으로 질문해 주세요.';
  const restored = parseProjects(JSON.stringify({ ...db, projects: [p] }));
  const input = buildInterviewInput(restored.projects[0], r, a);
  assert.equal(input.prompt, p.interviewPrompt);
  assert.equal(newPacket(p, r, a, templateQuestions(input)).promptUsed, '');
  assert.equal(
    newPacket(p, r, a, { ...templateQuestions(input), generation: 'ai' }).promptUsed,
    p.interviewPrompt,
  );
  assert.equal(
    interviewInputSchema.safeParse({ ...input, prompt: 'x'.repeat(2001) }).success,
    false,
  );
});

test('new questions remain a separate draft until reviewed and saved', () => {
  const { p, r, a, db, input } = setup();
  const before = JSON.stringify(db);
  const review = interviewReviewSchema.parse({
    key: packetKey(r.id, a.id),
    baseVersion: 0,
    createdAt: new Date().toISOString(),
    prompt: '설계 판단을 확인해 주세요.',
    result: { ...templateQuestions(input), generation: 'ai' },
  });
  const restored = interviewReviewSchema.parse(JSON.parse(JSON.stringify(review)));
  const candidate = applyInterviewReview(p, r, a, restored);
  assert.equal(JSON.stringify(db), before);
  assert.equal(candidate.promptUsed, review.prompt);
  const saved = saveInterview(db, p.id, candidate, restored.baseVersion);
  assert.equal(saved.projects[0].interviews?.[0].questions.length, 4);
});

test('review identifies preserved edits and exclusions and applies only allowed changes', () => {
  const { p, r, a, packet, input } = setup();
  const deleted = packet.questions.pop()!;
  packet.questions[0].edited = true;
  packet.questions[0].question = '직접 고친 질문';
  packet.questions[0].note = '보존할 메모';
  packet.questions.reverse();
  const result = templateQuestions(input);
  result.questions = result.questions.map((q) => ({ ...q, question: '새 질문 ' + q.id }));
  assert.equal(reviewQuestionStatus(result.questions[0], packet.questions), 'kept');
  assert.equal(
    reviewQuestionStatus(
      result.questions.find((q) => q.id === deleted.id)!,
      packet.questions,
    ),
    'excluded',
  );
  assert.equal(reviewQuestionStatus(result.questions[1], packet.questions), 'changed');
  assert.equal(reviewQuestionStatus(result.questions[1]), 'new');
  const review = {
    key: packet.key,
    baseVersion: packet.version,
    createdAt: new Date().toISOString(),
    prompt: '',
    result,
  };
  const next = applyInterviewReview(p, r, a, review, packet);
  assert.deepEqual(
    next.questions.map((q) => q.id),
    packet.questions.map((q) => q.id),
  );
  assert.deepEqual(
    next.questions.find((q) => q.edited),
    packet.questions.find((q) => q.edited),
  );
  assert.ok(next.questions.some((q) => q.question.startsWith('새 질문')));
  assert.ok(!next.questions.some((q) => q.id === deleted.id));
});

test('stale or different-analysis reviews cannot overwrite newer notes or finalized packets', () => {
  const { p, r, a, packet, input } = setup();
  const review = {
    key: packet.key,
    baseVersion: packet.version,
    createdAt: new Date().toISOString(),
    prompt: '',
    result: templateQuestions(input),
  };
  assert.throws(
    () => applyInterviewReview(p, r, a, review, { ...packet, version: packet.version + 1 }),
    /변경/,
  );
  assert.throws(
    () => applyInterviewReview(p, r, a, review, { ...packet, stage: 'ready' }),
    /면접 준비/,
  );
  assert.throws(
    () => applyInterviewReview(p, r, a, { ...review, key: 'other' }, packet),
    /이 분석/,
  );
  assert.throws(() => applyInterviewReview(p, r, a, review), /변경/);
  assert.notEqual(
    reviewStorageKey(p, packet.key),
    reviewStorageKey({ ...p, ownerId: 'other' }, packet.key),
  );
  assert.notEqual(
    reviewStorageKey(p, packet.key),
    reviewStorageKey({ ...p, id: 'other-project' }, packet.key),
  );
});

test('fallback review stays labeled template and does not claim a custom prompt was used', () => {
  const { p, r, a, input } = setup();
  const result = templateQuestions(input);
  const review = {
    key: packetKey(r.id, a.id),
    baseVersion: 0,
    createdAt: new Date().toISOString(),
    prompt: '추가 지침',
    result,
  };
  const next = applyInterviewReview(p, r, a, review);
  assert.equal(next.generation, 'template');
  assert.equal(next.promptUsed, '');
  assert.equal(reviewQuestionStatus(result.questions[0], result.questions), 'unchanged');
});
