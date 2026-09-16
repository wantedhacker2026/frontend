import type {
  AnalysisProject,
  ProjectAnalysis,
  ProjectCriterion,
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
  project: Pick<AnalysisProject, 'role' | 'jd' | 'criteria'>,
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
  const priority = (c: ProjectCriterion) => {
    const topic = topics.find((t) => t.id === c.id)!;
    return (topic.evidence !== 'confirmed' ? 10 : 0) + (c.core || c.required ? 5 : 0);
  };
  return {
    role: project.role,
    topics,
    priorityIds: [...criteria].sort((a, b) => priority(b) - priority(a)).map((c) => c.id),
    personalized: Boolean(analysis),
  };
}

export function templateQuestions(input: InterviewInput): InterviewGeneration {
  const commonPrompts = [
    (name: string) => `${name} 업무를 맡는다면 무엇을 먼저 확인하고 어떤 순서로 진행하시겠습니까?`,
    (name: string) =>
      `${name} 업무에서 일정과 품질이 충돌할 때 어떤 기준으로 우선순위를 정하시겠습니까?`,
    (name: string) => `${name} 업무의 결과를 어떻게 검증하고 이해관계자에게 설명하시겠습니까?`,
    (name: string) => `${name} 업무에서 발생할 수 있는 예외 상황과 대응 방법을 설명해 주세요.`,
    (name: string) =>
      `${name} 업무를 다른 담당자와 협업할 때 역할과 의사결정을 어떻게 정리하시겠습니까?`,
    (name: string) => `${name} 업무를 더 잘 수행하기 위해 어떤 정보를 수집하고 개선하시겠습니까?`,
  ];
  const personalPrompts = [
    (name: string, has: boolean) =>
      has
        ? `서류에 기재한 ${name} 경험에서 직접 담당한 범위와 팀이 담당한 범위를 설명해 주세요.`
        : `${name}과 관련해 직접 수행한 사례가 있다면 본인의 역할과 진행 과정을 설명해 주세요.`,
    (name: string) =>
      `${name}과 관련해 선택했던 대안과 선택 이유를 설명해 주세요. 실제 사례가 없다면 접근 방법을 말씀해 주세요.`,
    (name: string) =>
      `${name} 업무에서 어려움이나 예외 상황을 어떻게 해결하고 결과를 검증했는지 설명해 주세요.`,
    (name: string) =>
      `${name}과 관련한 결과를 무엇으로 확인했나요? 본인의 기여와 다음에 개선할 점을 설명해 주세요.`,
  ];
  function question(index: number, personal: boolean): InterviewQuestion {
    const id = personal ? input.priorityIds[index % input.priorityIds.length] : undefined;
    const topic =
      (id && input.topics.find((t) => t.id === id)) || input.topics[index % input.topics.length];
    const sources = personal ? topic.sources : [];
    const reason = !personal
      ? '채용공고의 직무 수행 방식과 판단 기준을 준비하는 공통 질문입니다.'
      : topic.evidence === 'unreadable'
        ? '서류 일부를 읽지 못해 확인할 내용입니다. 경험이 없다는 의미는 아닙니다.'
        : sources.length
          ? '서류의 관련 경험에서 실제 역할, 판단 과정과 결과를 구체적으로 확인합니다.'
          : '서류에서 관련 근거를 찾지 못했습니다. 실제 경험 또는 접근 방법을 이야기할 수 있도록 준비하세요.';
    return {
      id: `${personal ? 'personal' : 'common'}-${index}`,
      topicId: topic.id,
      topic: topic.name,
      kind: personal ? 'personal' : 'common',
      question: personal
        ? personalPrompts[index % 4](topic.name, sources.length > 0)
        : commonPrompts[index % 6](topic.name),
      reason,
      jdEvidence: topic.jdEvidence,
      sources,
      followups: personal
        ? [
            '본인이 내린 결정과 그 이유는 무엇인가요?',
            '결과를 확인할 수 있는 근거나 배운 점이 있나요?',
          ]
        : [
            '그 우선순위를 선택한 이유는 무엇인가요?',
            '예상과 다른 결과가 나오면 어떻게 대응하시겠습니까?',
          ],
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
  if (input.personalized) questions.push(...Array.from({ length: 4 }, (_, i) => question(i, true)));
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
