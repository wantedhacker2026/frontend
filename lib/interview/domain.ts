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

export const INTERVIEW_VERSION = 'interview-career-v2';
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
  const experienceTopics =
    revision && analysis
      ? extractExperienceTopics(revision, analysis.personId, criteria, project.jd.text)
      : [];
  const topics = criteria.map((c) => {
    const result = analysis?.results.find((r) => r.criterionId === c.id);
    const sources = (result?.sources ?? [])
      .filter((s) => {
        const doc = revision?.documents.find(
          (d) =>
            d.id === s.documentId && d.applicantId === analysis?.personId && d.status === 'ready',
        );
        return Boolean(
          experienceTopics.some((t) =>
            t.sources.some(
              (career) =>
                career.documentId === s.documentId &&
                career.page === s.page &&
                career.excerpt.includes(s.excerpt),
            ),
          ) &&
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
    sourceScope: 'career',
    prompt: project.interviewPrompt ?? '',
    role: project.role,
    topics,
    experienceTopics,
    // Retained for older clients; personal questions now select from experienceTopics.
    priorityIds: criteria.map((c) => c.id),
    personalized: Boolean(analysis),
  };
}

export function templateQuestions(input: InterviewInput): InterviewGeneration {
  const experiences = input.sourceScope === 'career' ? (input.experienceTopics ?? []) : [];
  if (!input.personalized || !experiences.length)
    return {
      generation: 'template',
      notice:
        '이력서의 경력 항목에서 구체적인 업무 경험을 찾지 못했습니다. 경력 또는 Work Experience 제목 아래에 담당 업무와 수행 내용을 작성해 주세요.',
      questions: [],
    };
  const personalPrompts = [
    '이 경험에서 직접 맡은 일은 무엇인가요?',
    '이 업무는 어떤 순서로 진행하셨나요?',
    '이 업무에서 다른 사람과 함께 진행한 부분이 있었나요?',
    '작업 결과는 어떻게 확인하셨나요?',
  ];
  const personalFollowups = [
    ['처음 해결하려던 문제는 무엇이었나요?', '직접 맡은 부분은 어떻게 진행하셨나요?'],
    ['진행할 때 중요하게 고려한 조건은 무엇인가요?', '그 조건은 작업에 어떤 영향을 주었나요?'],
    ['함께 진행했다면 역할은 어떻게 나누셨나요?', '직접 진행한 부분은 무엇인가요?'],
    ['어떤 기준으로 결과를 판단하셨나요?', '다시 한다면 어떤 부분을 바꾸고 싶나요?'],
  ];
  function question(index: number): InterviewQuestion {
    const topic = experiences[index % experiences.length];
    const sources = topic.sources;
    const reason =
      '이력서의 경력 항목에 작성한 업무 경험을 바탕으로 실제 역할, 판단 과정과 결과를 확인합니다.';
    return {
      id: `personal-${index}`,
      topicId: topic.id,
      topic: [
        '경력 업무의 담당 역할',
        '경력 업무의 진행 과정',
        '경력 업무의 협업 범위',
        '경력 업무의 결과 확인',
      ][index % 4],
      kind: 'personal',
      question: personalPrompts[index % 4],
      reason,
      jdEvidence: topic.jdEvidence,
      sources,
      evidenceIds: sources.map((_, i) => `${topic.id}:evidence-${i}`),
      grounding: 'fallback',
      followups: personalFollowups[index % 4],
      guide: [
        '상황과 목표를 짧게 정리하세요.',
        '직접 한 행동과 선택 이유를 구분하세요.',
        '경력에 작성한 업무의 확인 가능한 결과와 배운 점을 준비하세요.',
      ],
      note: '',
      prepared: false,
      edited: false,
      assessment: 'not-asked',
    };
  }
  return {
    generation: 'template',
    notice: '경력 기반 기본 질문 · 이력서의 경력 항목에 작성한 업무 경험만 사용합니다.',
    questions: Array.from({ length: 4 }, (_, i) => question(i)),
  };
}

export function newPacket(
  project: AnalysisProject,
  revision: ProjectRevision,
  analysis: ProjectAnalysis,
  generation: InterviewGeneration,
): InterviewPacket {
  if (!generation.questions.length) throw new Error('경력 항목에 질문할 업무 경험이 없습니다.');
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
      const unchanged =
        old.question === fresh.question &&
        old.topicId === fresh.topicId &&
        JSON.stringify(old.sources) === JSON.stringify(fresh.sources) &&
        JSON.stringify(old.followups) === JSON.stringify(fresh.followups) &&
        JSON.stringify(old.guide) === JSON.stringify(fresh.guide);
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
