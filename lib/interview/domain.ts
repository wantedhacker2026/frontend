import type {
  AnalysisProject,
  ProjectAnalysis,
  ProjectDB,
  ProjectRevision,
} from '@/lib/projects/types';
import {
  packetSchema,
  type InterviewInput,
  type InterviewPacket,
  type InterviewGeneration,
  type InterviewQuestion,
} from './types';
import { extractExperienceTopics } from './experiences';

export const INTERVIEW_VERSION = 'interview-v1';
export const assessmentNames = {
  'not-asked': '아직 질문 전',
  confirmed: '구체적 사례 확인',
  partial: '일부 확인',
  'follow-up': '추가 확인 필요',
};
export const stageNames = { preparing: '면접 준비', ready: '질문지 확정', completed: '면접 완료' };
export function packetKey(revisionId: string, analysisId: string) {
  return `${INTERVIEW_VERSION}:${revisionId}:${analysisId}`;
}

export function buildInterviewInput(
  project: Pick<AnalysisProject, 'role' | 'jd' | 'criteria' | 'interviewPrompt'>,
  revision?: ProjectRevision,
  analysis?: ProjectAnalysis,
): InterviewInput {
  const criteria = project.criteria.slice(0, 30);
  const topics = criteria.map((c) => {
    const result = analysis?.results.find((r) => r.criterionId === c.id);
    const sources = (result?.sources ?? [])
      .filter((s) => {
        const doc = revision?.documents.find(
          (d) =>
            d.id === s.documentId && d.applicantId === analysis?.personId && d.status === 'ready',
        );
        return Boolean(
          s.excerpt.trim() &&
          s.page > 0 &&
          doc?.pages.some((p) => p.number === s.page && p.text.includes(s.excerpt)),
        );
      })
      .slice(0, 2)
      .map((s) => ({
        ...s,
        filename: revision!.documents.find((d) => d.id === s.documentId)!.filename,
        excerpt: s.excerpt.slice(0, 2000),
      }));
    const jdEvidence =
      project.jd.text
        .split(/\n/)
        .find((line) =>
          c.keywords.some((k) => k.trim() && line.toLowerCase().includes(k.toLowerCase())),
        )
        ?.trim()
        .slice(0, 1500) ?? '';
    return {
      id: c.id,
      name: c.name.slice(0, 200),
      jdEvidence,
      evidence: !analysis
        ? ('jd-only' as const)
        : result?.status === 'unreadable'
          ? ('unreadable' as const)
          : !sources.length
            ? ('missing' as const)
            : result?.status === 'confirmed'
              ? ('confirmed' as const)
              : ('review' as const),
      sources,
    };
  });
  return {
    prompt: project.interviewPrompt ?? '',
    role: project.role,
    topics,
    experienceTopics:
      revision && analysis
        ? extractExperienceTopics(revision, analysis.personId, criteria, project.jd.text)
        : [],
    // Retained for older clients; personal questions now select from experienceTopics.
    priorityIds: criteria.map((c) => c.id),
    personalized: Boolean(analysis),
  };
}

export function templateQuestions(input: InterviewInput): InterviewGeneration {
  const commonPrompts = [
    (name: string) => `${name} 관련 업무를 시작할 때 무엇부터 확인하시겠어요?`,
    (name: string) => `${name} 업무에서 일정과 품질이 충돌하면 무엇을 우선하시겠어요?`,
    (name: string) => `${name} 업무의 결과가 잘 나왔는지 어떻게 확인하시겠어요?`,
    (name: string) => `${name} 업무에서 예상과 다른 결과가 나오면 어떻게 대응하시겠어요?`,
    (name: string) => `${name} 업무에서 동료와 의견이 다르면 어떻게 조율하시겠어요?`,
    (name: string) => `${name} 업무에서 먼저 개선하고 싶은 부분은 무엇인가요?`,
  ];
  const experiences = input.experienceTopics ?? [];
  const personalPrompts = [
    '이 경험에서 직접 맡은 일은 무엇인가요?',
    '그 방법을 선택한 이유는 무엇인가요?',
    '진행하면서 가장 어려웠던 점은 무엇인가요?',
    '작업 결과는 어떻게 확인하셨나요?',
  ];
  const personalFollowups = [
    ['처음 해결하려던 문제는 무엇이었나요?', '직접 맡은 부분은 어떻게 진행하셨나요?'],
    ['다른 방법도 검토하셨나요?', '선택에 가장 크게 영향을 준 조건은 무엇인가요?'],
    ['어떤 방식으로 풀어가셨나요?', '그 방법이 효과가 있었는지 어떻게 확인하셨나요?'],
    ['어떤 기준으로 결과를 판단하셨나요?', '다시 한다면 어떤 부분을 바꾸고 싶나요?'],
  ];
  function question(index: number, personal: boolean): InterviewQuestion {
    const topic = personal
      ? experiences[index % experiences.length]
      : input.topics[index % input.topics.length];
    const sources = personal ? topic.sources : [];
    const reason = !personal
      ? '채용공고의 직무 수행 방식과 판단 기준을 준비하는 공통 질문입니다.'
      : '지원서에 작성한 경험을 주제로 선정했습니다. 실제 역할, 판단 과정과 결과를 구체적으로 확인합니다.';
    return {
      id: `${personal ? 'personal' : 'common'}-${index}`,
      topicId: topic.id,
      topic: topic.name,
      kind: personal ? 'personal' : 'common',
      question: personal ? personalPrompts[index % 4] : commonPrompts[index % 6](topic.name),
      reason,
      jdEvidence: topic.jdEvidence,
      sources,
      followups: personal
        ? personalFollowups[index % 4]
        : ['그렇게 생각한 이유는 무엇인가요?', '비슷한 상황을 겪어본 적이 있나요?'],
      guide: [
        '상황과 목표를 짧게 정리하세요.',
        '직접 한 행동과 선택 이유를 구분하세요.',
        '확인 가능한 결과와 배운 점을 준비하세요. 경험이 없다면 가정임을 밝혀 접근 방법을 설명하세요.',
      ],
      note: '',
      prepared: false,
      edited: false,
      assessment: 'not-asked',
    };
  }
  const questions = Array.from({ length: 3 }, (_, i) => question(i, false));
  if (input.personalized && experiences.length)
    questions.push(...Array.from({ length: 4 }, (_, i) => question(i, true)));
  else if (input.personalized)
    return {
      generation: 'template',
      notice:
        '지원서에서 구체적인 수행 경험을 추출하지 못해 공통 질문만 표시합니다. 프로젝트·역할·수행 내용이 적힌 서류를 등록해 주세요.',
      questions,
    };
  else questions.push(...Array.from({ length: 3 }, (_, i) => question(i + 3, false)));
  return {
    generation: 'template',
    notice: '기본 질문 · JD와 서류 근거를 이용한 규칙 기반 질문입니다.',
    questions,
  };
}

export function newPacket(
  project: AnalysisProject,
  revision: ProjectRevision,
  analysis: ProjectAnalysis,
  generation: InterviewGeneration,
): InterviewPacket {
  const now = new Date().toISOString();
  return {
    ...generation,
    promptUsed: generation.generation === 'ai' ? (project.interviewPrompt ?? '') : '',
    key: packetKey(revision.id, analysis.id),
    role: project.role,
    revisionId: revision.id,
    analysisId: analysis.id,
    version: 1,
    createdAt: now,
    updatedAt: now,
    stage: 'preparing',
  };
}

// Interviews are saved independently; an in-flight analysis cannot overwrite notes or scores.
export function saveInterview(
  db: ProjectDB,
  projectId: string,
  value: InterviewPacket,
  expectedVersion: number,
): ProjectDB {
  const packet = packetSchema.parse(value);
  const project = db.projects.find((p) => p.id === projectId);
  if (
    !project ||
    !db.actor ||
    db.actor.id !== project.ownerId ||
    db.actor.role !== project.role ||
    packet.role !== project.role
  )
    throw new Error('이 면접 준비에 접근할 수 없습니다.');
  const revision = project.revisions.find((r) => r.id === packet.revisionId);
  if (
    !revision?.analyses.some((a) => a.id === packet.analysisId) ||
    packet.key !== packetKey(packet.revisionId, packet.analysisId)
  )
    throw new Error('면접 질문의 분석 버전이 올바르지 않습니다.');
  const previous = project.interviews?.find((p) => p.key === packet.key);
  if ((previous?.version ?? 0) !== expectedVersion)
    throw new Error('다른 화면에서 면접 준비를 변경했습니다. 화면을 새로 열고 다시 저장해 주세요.');
  const saved = {
    ...packet,
    version: expectedVersion + 1,
    createdAt: previous?.createdAt ?? packet.createdAt,
    updatedAt: new Date().toISOString(),
  };
  return {
    ...db,
    projects: db.projects.map((p) =>
      p.id === projectId
        ? { ...p, interviews: [...(p.interviews ?? []).filter((v) => v.key !== packet.key), saved] }
        : p,
    ),
  };
}

export function regeneratePacket(
  packet: InterviewPacket,
  generation: InterviewGeneration,
): InterviewPacket {
  return {
    ...packet,
    ...generation,
    questions: packet.questions.map((old) => {
      const fresh = generation.questions.find((q) => q.id === old.id);
      if (old.edited || !fresh) return old;
      const unchanged = old.question === fresh.question;
      return {
        ...fresh,
        note: old.note,
        prepared: unchanged && old.prepared,
        assessment: unchanged ? old.assessment : 'not-asked',
      };
    }),
  };
}

export function interviewText(title: string, packet: InterviewPacket) {
  return [
    title,
    stageNames[packet.stage],
    packet.notice,
    ...packet.questions.map(
      (q, i) =>
        `\n${i + 1}. [${q.kind === 'common' ? '공통' : '개인별'} · ${q.topic}] ${q.question}\n이유: ${q.reason}\nJD: ${q.jdEvidence || '직접 지정한 기준'}\n${q.sources.map((s) => `근거: ${s.filename} p.${s.page} — ${s.excerpt}`).join('\n')}\n후속 질문: ${q.followups.join(' / ')}\n${packet.role === 'applicant' ? `준비: ${q.prepared ? '완료' : '진행 중'}\n답변 가이드: ${q.guide.join(' / ')}` : `확인 상태: ${assessmentNames[q.assessment]}`}\n메모: ${q.note || '(없음)'}`,
    ),
  ].join('\n');
}
