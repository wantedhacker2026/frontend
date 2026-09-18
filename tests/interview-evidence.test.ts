import test from 'node:test';
import assert from 'node:assert/strict';
import {
  careerEvidenceRows,
  resolveInterviewSource,
  type EvidenceContext,
} from '../lib/interview/evidence';
import { templateQuestions } from '../lib/interview/domain';
import type { InterviewInput } from '../lib/interview/types';

function fixture() {
  const excerpt = '주문 조회 API의 인덱스를 개선하여 응답 시간을 30% 단축했습니다.';
  const source = { documentId: 'doc', filename: '저장 당시 파일명.txt', page: 2, excerpt };
  const context: EvidenceContext = {
    personId: 'person',
    revision: {
      id: 'revision',
      number: 1,
      createdAt: '',
      status: 'success',
      taskType: 'analysis',
      people: [],
      analyses: [],
      documents: [
        {
          id: 'doc',
          applicantId: 'person',
          filename: '지원서.txt',
          size: 20,
          status: 'ready',
          source: 'text',
          pages: [
            { number: 2, text: `경력\n주문 서비스 개발\n${excerpt}\n사용자 요청을 반영했습니다.` },
          ],
        },
      ],
    },
  };
  const topic = {
    id: 'experience',
    name: excerpt,
    jdEvidence: '',
    evidence: 'review' as const,
    sources: [source],
  };
  const input: InterviewInput = {
    sourceScope: 'career',
    role: 'recruiter',
    topics: [topic],
    experienceTopics: [topic],
    priorityIds: [],
    personalized: true,
  };
  return { source, context, topic, questions: templateQuestions(input).questions };
}

test('source view preserves full page context and highlights the exact original excerpt', () => {
  const { source, context } = fixture();
  const result = resolveInterviewSource(context, source)!;
  assert.equal(result.source.filename, '지원서.txt');
  assert.equal(result.excerpt, source.excerpt);
  assert.equal(
    result.before + result.excerpt + result.after,
    context.revision.documents[0].pages[0].text,
  );
  assert.ok(result.before.includes('주문 서비스 개발'));
  assert.ok(result.after.includes('사용자 요청'));
});

test('source view rejects another applicant, unreadable or missing pages and fabricated excerpts', () => {
  const { source, context } = fixture();
  assert.equal(resolveInterviewSource({ ...context, personId: 'other' }, source), null);
  assert.equal(resolveInterviewSource(context, { ...source, documentId: 'missing' }), null);
  assert.equal(resolveInterviewSource(context, { ...source, page: 3 }), null);
  assert.equal(resolveInterviewSource(context, { ...source, excerpt: '없는 성과 99%' }), null);
  assert.equal(resolveInterviewSource(context, { ...source, excerpt: ' ' }), null);
  context.revision.documents[0].unreadablePages = [2];
  assert.equal(resolveInterviewSource(context, source), null);
  delete context.revision.documents[0].unreadablePages;
  context.revision.documents[0].status = 'failed';
  assert.equal(resolveInterviewSource(context, source), null);
});

test('one extracted evidence groups multiple questions using current question order and exact citations', () => {
  const { context, topic, questions } = fixture();
  const reordered = [questions[3], questions[0]];
  const rows = careerEvidenceRows(context, [topic, topic], reordered);
  assert.equal(rows.length, 1);
  assert.deepEqual(
    rows[0].questions.map((q) => [q.number, q.question.id]),
    [
      [1, 'personal-3'],
      [2, 'personal-0'],
    ],
  );
  assert.equal(rows[0].source.filename, '지원서.txt');
  assert.deepEqual(
    careerEvidenceRows(context, [topic], []).map((r) => r.questions),
    [[]],
  );
});

test('matching topic names or IDs cannot create a citation link to different evidence', () => {
  const { context, topic, source, questions } = fixture();
  questions[0].sources = [{ ...source, excerpt: '다른 문장' }];
  const rows = careerEvidenceRows(context, [topic], [questions[0]]);
  assert.equal(rows[0].questions.length, 0);
  assert.deepEqual(careerEvidenceRows({ ...context, personId: 'other' }, [topic], questions), []);
});

test('same words in different documents remain separate evidence and deleted questions are not linked', () => {
  const { context, topic, source, questions } = fixture();
  context.revision.documents.push({
    ...context.revision.documents[0],
    id: 'doc-2',
    filename: '경력기술서.txt',
  });
  const second = { ...topic, id: 'second', sources: [{ ...source, documentId: 'doc-2' }] };
  const rows = careerEvidenceRows(context, [topic, second], [questions[1]]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].questions[0].question.id, 'personal-1');
  assert.equal(rows[1].questions.length, 0);
});
