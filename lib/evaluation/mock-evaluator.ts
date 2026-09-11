import type { CandidateEvaluator } from './interface';
import { calculateScore, scoreCriterion } from '@/lib/scoring';
import type { ActionType, Application, EvaluationCriterion, ImprovementAction, Job } from '@/types';
function actionType(c: EvaluationCriterion, hasEvidence: boolean): ActionType {
  if (hasEvidence) return 'RESUME_IMPROVEMENT';
  if (/자격|기사/.test(c.name)) return 'CERTIFICATION';
  if (c.category === '협업') return 'TEAM_PROJECT';
  if (c.category === '경험') return 'PROJECT';
  if (/cloud|aws|gcp/i.test(c.name)) return 'LEARNING';
  return 'PROJECT';
}
export class MockCandidateEvaluator implements CandidateEvaluator {
  evaluate(job: Job, criteria: EvaluationCriterion[], application: Application) {
    const id = `evaluation-${application.id}`;
    const items = criteria.map((c) => scoreCriterion(c, application, id));
    const calculated = calculateScore(criteria, items);
    const strengths = items
      .filter((i) => i.score / i.maxScore >= 0.85)
      .map((i) => criteria.find((c) => c.id === i.criterionId)!.name);
    const gaps = items.filter((i) => i.score / i.maxScore < 0.65);
    const actions: ImprovementAction[] = gaps
      .map((i) => {
        const c = criteria.find((c) => c.id === i.criterionId)!;
        const type = actionType(c, !!i.evidence);
        return {
          id: `action-${application.id}-${c.id}`,
          evaluationId: id,
          criterionId: c.id,
          type,
          title:
            type === 'RESUME_IMPROVEMENT'
              ? `${c.name} 경험을 구체적으로 표현하기`
              : type === 'TEAM_PROJECT'
                ? '팀 프로젝트에서 협업 경험 만들기'
                : type === 'CERTIFICATION'
                  ? `${c.name} 준비 계획 세우기`
                  : type === 'LEARNING'
                    ? `${c.name} 기초 학습과 실습하기`
                    : `${c.name} 프로젝트 경험 만들기`,
          description:
            type === 'RESUME_IMPROVEMENT'
              ? '상황 → 본인의 역할 → 해결 과정 → 결과 순서로 3~4문장을 작성하세요. 실제 수행한 내용과 확인 가능한 결과를 담아 주세요.'
              : type === 'TEAM_PROJECT'
                ? '2~3명의 팀원과 작은 서비스를 만들어 보세요. 역할 분담, 코드 리뷰, 의견을 조율한 과정을 기록하세요.'
                : type === 'CERTIFICATION'
                  ? '응시 조건과 시험 범위를 확인하고 주 단위 학습 계획을 만드세요. 취득 여부는 실제 확인 가능한 사실만 기재하세요.'
                  : `작은 기능 하나에 ${c.name}을 적용해 보세요. 구현 과정, 선택한 이유, 테스트 결과를 README에 기록하면 다음 지원서의 근거가 됩니다.`,
          reason: i.evidence
            ? `${c.name}에 대한 언급은 있지만 담당 역할과 수행 결과가 충분히 드러나지 않습니다.`
            : `이 공고는 ${c.name} 경험을 ${c.required ? '필수로 확인' : '우대'}합니다. 현재 지원서에서는 이를 확인할 근거가 부족합니다.`,
          priority: 0,
          estimatedScoreImpact: Math.max(1, Math.floor(c.weight * 0.85 - i.score)),
          links: [
            {
              label:
                type === 'RESUME_IMPROVEMENT'
                  ? '지원서 보강하기'
                  : type === 'TEAM_PROJECT'
                    ? '팀 프로젝트 보기'
                    : type === 'CERTIFICATION'
                      ? '준비 가이드 보기'
                      : type === 'LEARNING'
                        ? '학습 가이드 보기'
                        : '관련 프로젝트 보기',
              resourceType: type,
            },
          ],
        };
      })
      .sort((a, b) => b.estimatedScoreImpact - a.estimatedScoreImpact)
      .map((a, i) => ({ ...a, priority: i + 1 }));
    if (application.experience < job.minExperience)
      actions.push({
        id: `action-${application.id}-experience`,
        evaluationId: id,
        criterionId: 'experience',
        type: 'INTERNSHIP',
        title: '관련 실무 경험을 쌓을 기회 찾기',
        description:
          '관련 인턴십의 담당 업무를 살펴보고 현재 프로젝트 경험으로 기여할 수 있는 부분을 정리해 보세요.',
        reason: `공고의 권장 경력은 ${job.minExperience}년이며, 입력한 경력은 ${application.experience}년입니다. 경력은 종합 점수에 중복 반영하지 않습니다.`,
        priority: actions.length + 1,
        estimatedScoreImpact: 0,
        links: [{ label: '인턴십 예시 보기', resourceType: 'INTERNSHIP' }],
      });
    return {
      id,
      applicationId: application.id,
      ...calculated,
      items,
      actions,
      evaluatedAt: new Date().toISOString(),
      evaluatorVersion: 'keyword-v1',
      summary: `${strengths.length ? `${strengths.slice(0, 3).join(', ')} 경험이 JD와 잘 연결됩니다.` : '지원서에 기재된 경험을 기준으로 분석했습니다.'} ${
        gaps.length
          ? `${gaps
              .slice(0, 2)
              .map((i) => criteria.find((c) => c.id === i.criterionId)!.name)
              .join(', ')} 항목은 추가 근거를 확인해 보세요.`
          : '모든 평가 항목에서 관련 근거가 확인됩니다.'
      }`,
      recommendation:
        calculated.totalScore >= 85 && calculated.requiredMet
          ? '면접 검토 추천'
          : calculated.totalScore >= 70
            ? '주요 경험 추가 확인 추천'
            : '지원서 근거 보완 검토',
    };
  }
}
export const evaluator: CandidateEvaluator = new MockCandidateEvaluator();
