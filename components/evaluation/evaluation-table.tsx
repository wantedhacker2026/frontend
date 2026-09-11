import { categories, type Evaluation, type EvaluationCriterion } from '@/types';
export function EvaluationTable({
  criteria,
  evaluation,
}: {
  criteria: EvaluationCriterion[];
  evaluation: Evaluation;
}) {
  return (
    <div className="evaluation-table">
      {categories.map((category) => {
        const group = criteria.filter((c) => c.category === category);
        if (!group.length) return null;
        return (
          <section key={category}>
            <h3>
              {category}
              <span>{group.length}개 기준</span>
            </h3>
            {group.map((c) => {
              const item = evaluation.items.find((i) => i.criterionId === c.id)!;
              return (
                <details key={c.id} className="evaluation-row">
                  <summary>
                    <span className="criterion-name">
                      {c.name}
                      {c.required && <small>필수</small>}
                    </span>
                    <span className={`level-badge ${item.level.toLowerCase()}`}>
                      {item.level === 'Unverified' ? '근거 미확인' : item.level}
                    </span>
                    <span className="item-score">
                      {item.score}
                      <small> / {item.maxScore}</small>
                    </span>
                    <span className="expand-evidence">
                      근거 보기 <span>+</span>
                    </span>
                  </summary>
                  <div className="evaluation-evidence">
                    <p>{item.reason}</p>
                    {item.evidence ? (
                      <blockquote>“{item.evidence}”</blockquote>
                    ) : (
                      <p className="muted">직접 수행한 경험을 추가로 확인해 주세요.</p>
                    )}
                    <small>평가 기준: {c.description}</small>
                  </div>
                </details>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
