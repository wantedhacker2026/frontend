import { z } from 'zod';
import { generationSchema, type InterviewPacket, type InterviewQuestion } from './types';
import { newPacket, packetKey, regeneratePacket } from './domain';
import type { AnalysisProject, ProjectAnalysis, ProjectRevision } from '@/lib/projects/types';

export const interviewReviewSchema = z.object({
  key: z.string(),
  baseVersion: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  prompt: z.string().max(2000),
  result: generationSchema,
});
export type InterviewReview = z.infer<typeof interviewReviewSchema>;
export function reviewStorageKey(
  project: Pick<AnalysisProject, 'id' | 'ownerId' | 'role'>,
  key: string,
) {
  return `wantedhacker-interview-review:${project.ownerId}:${project.role}:${project.id}:${key}`;
}
export function reviewQuestionStatus(question: InterviewQuestion, previous?: InterviewQuestion[]) {
  if (!previous) return 'new';
  const old = previous.find((q) => q.id === question.id);
  if (!old) return 'excluded';
  if (old.edited) return 'kept';
  return old.topic === question.topic &&
    old.reason === question.reason &&
    JSON.stringify(old.sources) === JSON.stringify(question.sources) &&
    old.grounding === question.grounding &&
    old.question === question.question &&
    JSON.stringify(old.followups) === JSON.stringify(question.followups) &&
    JSON.stringify(old.guide) === JSON.stringify(question.guide)
    ? 'unchanged'
    : 'changed';
}
export function applyInterviewReview(
  project: AnalysisProject,
  revision: ProjectRevision,
  analysis: ProjectAnalysis,
  review: InterviewReview,
  current?: InterviewPacket,
): InterviewPacket {
  if (review.key !== packetKey(revision.id, analysis.id) || (current && current.key !== review.key))
    throw new Error('이 분석의 생성 결과가 아닙니다. 질문을 다시 생성해 주세요.');
  if ((current?.version ?? 0) !== review.baseVersion)
    throw new Error(
      '검토 중 기존 질문이나 메모가 변경되었습니다. 현재 결과를 취소하고 다시 생성해 주세요.',
    );
  if (current && project.role === 'recruiter' && current.stage !== 'preparing')
    throw new Error('질문 수정하기로 면접 준비 상태를 연 뒤 다시 생성해 주세요.');
  return {
    ...(current
      ? regeneratePacket(current, review.result)
      : newPacket(project, revision, analysis, review.result)),
    promptUsed: review.result.generation === 'ai' ? review.prompt : '',
  };
}
