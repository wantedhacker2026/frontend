import { Check, CircleDashed, Sparkles } from 'lucide-react';
import { scoreLabel, scoreTone } from '@/lib/scoring';
import type { Evaluation, EvaluationCriterion } from '@/types';
export function ScoreBadge({ score }: { score: number }) {
  return (
    <span className={`score-badge ${scoreTone(score)}`}>
      <span className="badge-dot" />
      {scoreLabel(score)}
    </span>
  );
}
export function MatchScore({ score, compact = false }: { score: number; compact?: boolean }) {
  return (
    <div className={compact ? 'match-score compact' : 'match-score'}>
      <div className="score-number">
        {score}
        {!compact && <span>/ 100</span>}
      </div>
      <ScoreBadge score={score} />
    </div>
  );
}
export function CriterionProgress({
  label,
  value,
  subtle = false,
}: {
  label: string;
  value: number;
  subtle?: boolean;
}) {
  return (
    <div className={`criterion-progress ${subtle ? 'subtle' : ''}`}>
      <div>
        <span>{label}</span>
        <strong>
          {value}
          <small>%</small>
        </strong>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <span style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
export function RequirementChecklist({
  criteria,
  evaluation,
  experience,
  minExperience,
}: {
  criteria: EvaluationCriterion[];
  evaluation: Evaluation;
  experience?: number;
  minExperience?: number;
}) {
  return (
    <div className="requirement-list">
      {criteria
        .filter((c) => c.required)
        .map((c) => {
          const item = evaluation.items.find((i) => i.criterionId === c.id);
          const met = !!item && item.score / item.maxScore >= 0.65;
          return (
            <div key={c.id}>
              {met ? (
                <Check size={16} className="text-emerald-700" />
              ) : (
                <CircleDashed size={16} className="text-amber-700" />
              )}
              <span>{c.name}</span>
              <small>{met ? '근거 확인' : '추가 확인'}</small>
            </div>
          );
        })}
      {experience !== undefined && minExperience !== undefined && (
        <div>
          <CircleDashed size={16} />
          <span>관련 경력 {experience}년</span>
          <small>권장 {minExperience}년</small>
        </div>
      )}
    </div>
  );
}
export function RiskBadge({ children }: { children: React.ReactNode }) {
  return <span className="risk-badge">{children}</span>;
}
export function EvidenceCard({
  name,
  evidence,
  reason,
}: {
  name: string;
  evidence: string | null;
  reason: string;
}) {
  return (
    <article className="evidence-card">
      <h3>
        <Sparkles size={16} />
        {name}
      </h3>
      <p>{reason}</p>
      {evidence && <blockquote>“{evidence}”</blockquote>}
    </article>
  );
}
