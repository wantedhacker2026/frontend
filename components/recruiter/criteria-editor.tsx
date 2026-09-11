'use client';
import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import { categories, type EvaluationCriterion } from '@/types';
import { Button } from '@/components/ui/button';
import { normalizeWeights } from '@/data/mock/criteria';
import { uid } from '@/lib/utils';
export function CriteriaEditor({
  criteria,
  onChange,
  jobId,
}: {
  criteria: EvaluationCriterion[];
  onChange: (criteria: EvaluationCriterion[]) => void;
  jobId: string;
}) {
  const total = criteria.reduce((s, c) => s + (Number.isFinite(c.weight) ? c.weight : 0), 0);
  function update(id: string, patch: Partial<EvaluationCriterion>) {
    onChange(criteria.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  return (
    <div className="criteria-editor">
      <div className="criteria-summary">
        <div>
          <h2>평가 기준 검토</h2>
          <p>자동 생성한 초안입니다. 실제 JD에 맞게 수정하세요.</p>
        </div>
        <span className={`weight-total ${total === 100 ? 'valid' : ''}`}>총 {total} / 100점</span>
      </div>
      <div className="info-box mb-5">
        배점은 채용담당자에게만 표시됩니다. 지원자는 역량 이름과 개선 가이드를 확인합니다.
      </div>
      <div className="criteria-list">
        {criteria.map((c, index) => (
          <div className="criterion-edit-row" key={c.id}>
            <span className="criterion-index">{String(index + 1).padStart(2, '0')}</span>
            <div className="criterion-edit-main">
              <div className="criterion-fields">
                <label>
                  평가 항목
                  <input
                    value={c.name}
                    maxLength={80}
                    onChange={(e) => update(c.id, { name: e.target.value })}
                    aria-label={`평가 항목 ${index + 1}`}
                  />
                </label>
                <label>
                  카테고리
                  <select
                    value={c.category}
                    onChange={(e) =>
                      update(c.id, { category: e.target.value as EvaluationCriterion['category'] })
                    }
                  >
                    {categories.map((cat) => (
                      <option key={cat}>{cat}</option>
                    ))}
                  </select>
                </label>
                <label className="weight-field">
                  배점
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={c.weight}
                    onChange={(e) => update(c.id, { weight: Number(e.target.value) })}
                    aria-label={`${c.name || '항목'} 배점`}
                  />
                </label>
                <label className="required-toggle">
                  <input
                    type="checkbox"
                    checked={c.required}
                    onChange={(e) => update(c.id, { required: e.target.checked })}
                  />
                  필수
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`${c.name || '항목'} 삭제`}
                  onClick={() => onChange(criteria.filter((x) => x.id !== c.id))}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
              <details>
                <summary>설명 및 매칭 키워드 수정</summary>
                <label>
                  설명
                  <input
                    value={c.description}
                    maxLength={500}
                    onChange={(e) => update(c.id, { description: e.target.value })}
                  />
                </label>
                <label>
                  키워드 · 쉼표로 구분
                  <input
                    value={c.keywords.join(',')}
                    maxLength={500}
                    onChange={(e) => update(c.id, { keywords: e.target.value.split(',') })}
                  />
                </label>
              </details>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mt-5">
        <Button
          variant="outline"
          onClick={() =>
            onChange([
              ...criteria,
              {
                id: uid('criterion'),
                jobId,
                category: '기술 역량',
                name: '',
                description: '지원서에서 구체적인 수행 근거를 확인합니다.',
                weight: 5,
                required: false,
                keywords: [],
              },
            ])
          }
        >
          <Plus size={16} />
          항목 추가
        </Button>
        <Button variant="ghost" onClick={() => onChange(normalizeWeights(criteria))}>
          <RotateCcw size={15} />
          배점 합계 100으로 맞추기
        </Button>
      </div>
    </div>
  );
}
