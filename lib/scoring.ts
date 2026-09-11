import { containsKeyword, validateCriteria } from '@/data/mock/criteria';
import type { Application, EvaluationCriterion, EvaluationItem, Category } from '@/types';
import { categories } from '@/types';
const negative =
  /경험(?:이|은|는)?\s*(?:없|부족)|미경험|사용한 적.{0,4}없|사용 경험.{0,4}없|해본 적.{0,4}없|아직.{0,10}(?:못|않)|\b(?:no experience|not used|never used)\b/i;
const learning = /학습|공부|수강|입문|튜토리얼|배우|예정|계획|learning|tutorial/i;
const concrete =
  /구현|개발(?!자)|운영|구축|설계|배포|개선|해결|담당|리뷰|조율|기획|implemented|built|deployed/i;
const measurable = /\d+\s*(?:%|명|만|건|ms|초|tps)|성능 개선|장애 대응|운영 환경|상용/i;
export function scoreCriterion(
  criterion: EvaluationCriterion,
  application: Application,
  evaluationId: string,
): EvaluationItem {
  const fields =
    criterion.category === '경험'
      ? [application.projects]
      : criterion.category === '협업'
        ? [application.collaboration]
        : [
            application.projects,
            application.collaboration,
            application.additionalExperience,
            application.introduction,
          ];
  const sentences = fields
    .flatMap((text) => text.split(/\n|(?<=[.!?])\s+/))
    .map((s) => s.trim())
    .filter(Boolean);
  const matched = sentences.filter((s) => criterion.keywords.some((k) => containsKeyword(s, k)));
  const positive = matched.filter((s) => !negative.test(s));
  let ratio = 0;
  let evidence: string | null = null;
  for (const sentence of positive) {
    const next = learning.test(sentence)
      ? 0.35
      : concrete.test(sentence)
        ? measurable.test(sentence)
          ? 1
          : 0.85
        : 0.55;
    if (next > ratio) {
      ratio = next;
      evidence = sentence;
    }
  }
  if (
    !ratio &&
    !matched.some((s) => negative.test(s)) &&
    criterion.category !== '협업' &&
    criterion.category !== '경험' &&
    criterion.keywords.some((k) => containsKeyword(application.skills, k))
  ) {
    ratio = 0.45;
    evidence = `기술 스택: ${application.skills}`;
  }
  const level =
    ratio >= 0.85 ? 'Strong' : ratio >= 0.65 ? 'Good' : ratio > 0 ? 'Partial' : 'Unverified';
  const reason =
    ratio >= 0.85
      ? '직접 수행한 경험이 구체적으로 기재되어 있습니다.'
      : ratio > 0
        ? '관련 언급은 있으나 수행 과정이나 결과를 추가하면 경험을 더 정확히 확인할 수 있습니다.'
        : '지원서에서 직접 수행한 경험의 근거가 확인되지 않았습니다. 역량이 없다는 의미는 아닙니다.';
  return {
    id: `${evaluationId}-${criterion.id}`,
    evaluationId,
    criterionId: criterion.id,
    score: Math.round(ratio * criterion.weight * 10) / 10,
    maxScore: criterion.weight,
    level,
    evidence,
    reason,
  };
}
export function calculateScore(criteria: EvaluationCriterion[], items: EvaluationItem[]) {
  const error = validateCriteria(criteria);
  if (error) throw new Error(error);
  const totalScore = Math.round(items.reduce((sum, item) => sum + item.score, 0));
  const categoryScores = Object.fromEntries(
    categories.map((category: Category) => {
      const ids = criteria.filter((c) => c.category === category).map((c) => c.id);
      const group = items.filter((i) => ids.includes(i.criterionId));
      const max = group.reduce((s, i) => s + i.maxScore, 0);
      return [category, max ? Math.round((group.reduce((s, i) => s + i.score, 0) / max) * 100) : 0];
    }),
  ) as Record<Category, number>;
  const requiredMet = criteria
    .filter((c) => c.required)
    .every((c) => {
      const item = items.find((i) => i.criterionId === c.id);
      return item && item.score / item.maxScore >= 0.65;
    });
  return { totalScore, categoryScores, requiredMet };
}
export function scoreLabel(score: number) {
  return score >= 85
    ? 'Strong Match'
    : score >= 70
      ? 'Good Match'
      : score >= 50
        ? 'Partial Match'
        : 'Low Match';
}
export function scoreTone(score: number) {
  return score >= 85 ? 'strong' : score >= 70 ? 'good' : score >= 50 ? 'partial' : 'low';
}
