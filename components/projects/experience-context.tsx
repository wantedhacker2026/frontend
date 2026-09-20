import type { InterviewQuestion } from '@/lib/interview/types';
import { activityNames, scaleMeaningNames, validExperienceContext } from '@/lib/interview/context';

export function ExperienceContextSummary({ question }: { question: InterviewQuestion }) {
  const context = question.context;
  if (!context || !validExperienceContext(context, question))
    return (
      <p className="career-evidence-hint">
        경험의 유형·대상·역할을 확인하지 못했습니다. 원문의 담당 역할을 먼저 확인해 주세요.
      </p>
    );
  const rows = [
    ['활동 유형', activityNames[context.activityType]],
    ['활동 대상', context.target?.value],
    ['수행한 행동', context.action?.value],
    ['본인 역할', context.role?.value],
    ['참여 대상', context.participants?.value],
    [
      '규모',
      context.scale
        ? `${context.scale.value} · ${scaleMeaningNames[context.scaleMeaning]}`
        : undefined,
    ],
  ];
  return (
    <details className="experience-context" open>
      <summary>질문에 사용한 경험 해석{question.edited ? ' · 질문 직접 수정 전 기준' : ''}</summary>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value || '원문에서 확인되지 않음'}</dd>
          </div>
        ))}
      </dl>
      <small>
        원문에 대한 자동 해석입니다. 표시되지 않은 역할·성과는 추정하지 않으며 실제 수행 여부는
        면접에서 확인하세요.
      </small>
    </details>
  );
}
