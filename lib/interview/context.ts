import type { ExperienceContext, InterviewQuestion } from './types';

export const activityNames: Record<ExperienceContext['activityType'], string> = {
  'community-operation': '스터디·커뮤니티 활동',
  'software-development': '소프트웨어 개발',
  'service-operation': '서비스 운영',
  planning: '기획',
  'project-management': '프로젝트 관리',
  research: '조사·연구',
  design: '디자인',
  collaboration: '협업·조율',
  other: '기타 업무',
  unclear: '활동 유형 확인 필요',
};
export const scaleMeaningNames: Record<ExperienceContext['scaleMeaning'], string> = {
  participants: '활동 참여 인원',
  'team-members': '팀 인원',
  users: '제품 사용자',
  other: '기타 규모',
  unknown: '규모 의미 확인 필요',
};

export function validExperienceContext(
  context: ExperienceContext,
  question: Pick<InterviewQuestion, 'topicId' | 'evidenceIds' | 'sources'>,
  selectedIds = question.evidenceIds ?? [],
) {
  if (
    context.experienceId !== question.topicId ||
    context.status !== 'clear' ||
    context.activityType === 'unclear' ||
    !context.target ||
    !context.action ||
    (!context.scale && context.scaleMeaning !== 'unknown')
  )
    return false;
  return [context.target, context.action, context.role, context.participants, context.scale].every(
    (fact) => {
      if (!fact) return true;
      const index = question.evidenceIds?.indexOf(fact.evidenceId) ?? -1;
      return (
        selectedIds.includes(fact.evidenceId) &&
        index >= 0 &&
        question.sources[index]?.excerpt.includes(fact.value)
      );
    },
  );
}
