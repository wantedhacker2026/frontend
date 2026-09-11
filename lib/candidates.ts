import type { CandidateRow, EvaluationCriterion } from '@/types';
export function rowSignals(row: CandidateRow, criteria: EvaluationCriterion[]) {
  const strong = row.evaluation.items
    .filter((i) => i.score / i.maxScore >= 0.85)
    .sort((a, b) => b.maxScore - a.maxScore)
    .map((i) => criteria.find((c) => c.id === i.criterionId)?.name)
    .filter(Boolean) as string[];
  const gaps = row.evaluation.items
    .filter((i) => i.score / i.maxScore < 0.65)
    .sort((a, b) => b.maxScore - b.score - (a.maxScore - a.score))
    .map((i) => criteria.find((c) => c.id === i.criterionId)?.name)
    .filter(Boolean) as string[];
  return { strong, gaps };
}
