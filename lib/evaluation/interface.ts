import type { Application, EvaluationCriterion, EvaluationResult, Job } from '@/types';
export interface CandidateEvaluator {
  evaluate(
    jobDescription: Job,
    criteria: EvaluationCriterion[],
    application: Application,
  ): EvaluationResult | Promise<EvaluationResult>;
}
