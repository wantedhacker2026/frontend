'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Check, CircleHelp, FileText } from 'lucide-react';
import type { Application, Evaluation, EvaluationCriterion, EvaluationLevel } from '@/types';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ActionCard } from '@/components/applicant/actions';

const labels: Record<EvaluationLevel, string> = {
  Strong: '충분한 근거',
  Good: '관련 근거',
  Partial: '보완 필요',
  Unverified: '근거 미확인',
};
type Filter = 'all' | 'confirmed' | 'gap';

export function DocumentAnalysis({
  criteria,
  evaluation,
  application,
  recruiter = false,
}: {
  criteria: EvaluationCriterion[];
  evaluation: Evaluation;
  application: Application;
  recruiter?: boolean;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const confirmed = (level: EvaluationLevel) => level === 'Strong' || level === 'Good';
  const items = evaluation.items.filter(
    (item) =>
      filter === 'all' || (filter === 'confirmed' ? confirmed(item.level) : !confirmed(item.level)),
  );
  const selected = evaluation.items.find((item) => item.id === selectedId);
  const criterion = criteria.find((c) => c.id === selected?.criterionId);
  const action = evaluation.actions.find((a) => a.criterionId === criterion?.id);
  return (
    <section className="document-analysis" aria-labelledby="document-analysis-title">
      <div className="document-analysis-heading">
        <div>
          <span className="eyebrow">DOCUMENT ANALYSIS</span>
          <h2 id="document-analysis-title">{recruiter ? '지원자' : '나의'} 서류 분석표</h2>
          <p>JD 항목을 누르면 지원서 근거와 상세 설명을 확인할 수 있어요.</p>
        </div>
        <span className="analysis-count">
          {evaluation.items.filter((i) => confirmed(i.level)).length} / {evaluation.items.length}{' '}
          항목 연결
        </span>
      </div>
      <div className="analysis-filters" aria-label="분석 항목 필터">
        {(
          [
            { value: 'all', label: '전체' },
            { value: 'confirmed', label: '근거 확인' },
            { value: 'gap', label: '보완할 항목' },
          ] as const
        ).map((f) => (
          <button
            type="button"
            key={f.value}
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
            <span>
              {
                evaluation.items.filter(
                  (i) =>
                    f.value === 'all' ||
                    (f.value === 'confirmed' ? confirmed(i.level) : !confirmed(i.level)),
                ).length
              }
            </span>
          </button>
        ))}
      </div>
      <div className="analysis-table-wrap">
        <table className="analysis-table">
          <caption className="sr-only">JD 기준별 지원서 근거와 분석 상태</caption>
          <thead>
            <tr>
              <th scope="col">JD 기준</th>
              <th scope="col">지원서</th>
              <th scope="col">근거 요약</th>
              {recruiter && <th scope="col">내부 점수</th>}
              <th scope="col">상태</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const c = criteria.find((c) => c.id === item.criterionId);
              if (!c) return null;
              return (
                <tr key={item.id}>
                  <th scope="row">
                    <button
                      className="analysis-criterion"
                      onClick={() => setSelectedId(item.id)}
                      aria-haspopup="dialog"
                    >
                      <span>
                        {c.name}
                        <small>
                          {c.required ? '필수' : '우대'} · {c.category}
                        </small>
                      </span>
                      <ArrowUpRight size={15} />
                    </button>
                  </th>
                  <td data-label="지원서">
                    <span className="document-presence">
                      {item.evidence ? <Check size={15} /> : <CircleHelp size={15} />}
                      {item.evidence ? '언급 확인' : '미확인'}
                    </span>
                  </td>
                  <td data-label="근거 요약">
                    <p className="analysis-evidence">{item.evidence || item.reason}</p>
                  </td>
                  {recruiter && (
                    <td data-label="내부 점수">
                      {item.score} / {item.maxScore}
                    </td>
                  )}
                  <td data-label="상태">
                    <span className={`analysis-status status-${item.level.toLowerCase()}`}>
                      <i />
                      {labels[item.level]}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!items.length && (
          <p className="analysis-empty" role="status">
            해당하는 항목이 없습니다. 다른 필터를 선택해 주세요.
          </p>
        )}
      </div>
      <p className="analysis-note">
        ‘미확인’은 경험이 없다는 뜻이 아니라, 현재 지원서에서 근거를 찾지 못했다는 뜻이에요.
      </p>
      <Dialog
        open={Boolean(selected && criterion)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        title={`${criterion?.name ?? ''} · 서류 분석`}
        description="제출한 지원서의 근거와 JD 요구사항을 함께 확인하세요."
        wide
      >
        {selected && criterion && (
          <div className="analysis-modal">
            <section className="analysis-modal-criterion">
              <span className={`analysis-status status-${selected.level.toLowerCase()}`}>
                <i />
                {labels[selected.level]}
              </span>
              <h3>JD에서 확인하는 내용</h3>
              <p>{criterion.description}</p>
            </section>
            <section>
              <h3>
                <FileText size={16} /> 지원서에서 확인한 근거
              </h3>
              {selected.evidence ? (
                <blockquote>{selected.evidence}</blockquote>
              ) : (
                <p className="analysis-missing">
                  관련 경험의 직접적인 근거가 확인되지 않았어요. 수행한 일과 결과를 구체적으로
                  작성해 주세요.
                </p>
              )}
            </section>
            <section>
              <h3>분석 이유</h3>
              <p>{selected.reason}</p>
            </section>
            {recruiter && (
              <p>
                내부 평가 점수: {selected.score} / {selected.maxScore}
              </p>
            )}
            {!recruiter &&
              (action ? (
                <ActionCard action={action} applicationId={application.id} />
              ) : (
                <div className="analysis-next">
                  <h3>다음으로 할 수 있는 일</h3>
                  <p>이 경험에서 맡은 역할과 성과를 정리해 면접에서 설명할 준비를 해보세요.</p>
                </div>
              ))}
            <details className="analysis-source">
              <summary>제출한 지원서 원문 보기</summary>
              {[
                { label: '기술 스택', value: application.skills },
                { label: '프로젝트 경험', value: application.projects },
                { label: '자기소개', value: application.introduction },
                { label: '지원동기', value: application.motivation },
                { label: '협업 경험', value: application.collaboration },
                { label: '추가 경험', value: application.additionalExperience },
              ]
                .filter((f) => f.value)
                .map((f) => (
                  <section key={f.label}>
                    <h4>{f.label}</h4>
                    <p>{f.value}</p>
                  </section>
                ))}
            </details>
            {!recruiter && (
              <div className="analysis-modal-actions">
                <Button asChild>
                  <Link href={`/applications/${application.id}/edit`}>
                    서류 수정 및 재분석
                    <ArrowUpRight size={15} />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/jobs/${application.jobId}/apply`}>다른 버전으로 지원</Link>
                </Button>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </section>
  );
}
