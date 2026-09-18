'use client';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { InterviewGeneration, InterviewQuestion } from '@/lib/interview/types';
import { reviewQuestionStatus } from '@/lib/interview/review';

const statusNames = {
  new: '새 질문',
  changed: '변경 예정',
  unchanged: '기존과 동일',
  kept: '직접 수정한 질문 유지',
  excluded: '삭제한 질문 · 적용 제외',
};
export function InterviewReviewDialog({
  open,
  onOpenChange,
  result,
  prompt,
  previous,
  error,
  onApply,
  onDiscard,
  disabled = false,
  previewOnly = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: InterviewGeneration;
  prompt: string;
  previous?: InterviewQuestion[];
  error?: string;
  onApply: () => void;
  onDiscard: () => void;
  disabled?: boolean;
  previewOnly?: boolean;
}) {
  const changed = result.questions.filter((q) =>
    ['new', 'changed'].includes(reviewQuestionStatus(q, previous)),
  ).length;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="새로 생성된 질문 검토"
      wide
      description="새 질문과 근거를 확인한 뒤 적용하세요. 적용하기 전에는 기존 질문이 바뀌지 않습니다."
    >
      <div className="interview-review-summary">
        <strong>
          {result.generation === 'ai' ? 'AI 생성 결과' : '기본 질문 결과'} ·{' '}
          {result.questions.length}개
        </strong>
        <p>{result.notice}</p>
        <p>
          새로 추가되거나 달라지는 질문 {changed}개
          {previous ? ' · 기존 메모와 질문 순서는 유지됩니다.' : ''}
        </p>
        <details>
          <summary>생성에 요청한 지침 확인</summary>
          <p>{prompt || '기본 지침'}</p>
          {result.generation !== 'ai' && <p>기본 질문에는 추가 지침이 적용되지 않았습니다.</p>}
        </details>
      </div>
      {error && (
        <p className="project-error" role="alert">
          {error}
        </p>
      )}
      <div className="interview-review-list">
        {result.questions.map((q, index) => {
          const old = previous?.find((item) => item.id === q.id);
          const status = reviewQuestionStatus(q, previous);
          return (
            <article className="interview-review-question" key={q.id}>
              <div className="interview-review-heading">
                <h3>
                  {index + 1}. {q.topic} · {q.kind === 'common' ? '공통' : '개인별'}
                </h3>
                <span>{statusNames[status]}</span>
              </div>
              <div className={`interview-review-comparison ${old ? 'has-previous' : ''}`}>
                {old && (
                  <section>
                    <h4>기존 질문</h4>
                    <p>{old.question}</p>
                    <details>
                      <summary>기존 후속 질문·가이드</summary>
                      <ul>
                        {old.followups.map((v, i) => (
                          <li key={i}>{v}</li>
                        ))}
                      </ul>
                      <ul>
                        {old.guide.map((v, i) => (
                          <li key={i}>{v}</li>
                        ))}
                      </ul>
                    </details>
                  </section>
                )}
                <section>
                  <h4>새로 생성된 질문</h4>
                  <p>{q.question}</p>
                  <strong>후속 질문</strong>
                  <ul>
                    {q.followups.map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                  <strong>답변 준비 가이드</strong>
                  <ul>
                    {q.guide.map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                </section>
              </div>
              {(status === 'kept' || status === 'excluded') && (
                <p className="interview-review-preserved">
                  {status === 'kept'
                    ? '새 질문을 확인할 수 있지만, 적용 시 직접 수정한 기존 질문을 그대로 유지합니다.'
                    : '이전에 삭제한 질문입니다. 적용해도 복원되지 않습니다.'}
                </p>
              )}
              <details>
                <summary>질문 이유와 근거</summary>
                <p>{q.reason}</p>
                <blockquote>{q.jdEvidence || `${q.topic} 평가 기준`}</blockquote>
                {q.sources.length ? (
                  q.sources.map((source, i) => (
                    <div key={i}>
                      <strong>
                        {source.filename} · {source.page}페이지
                      </strong>
                      <blockquote>{source.excerpt}</blockquote>
                    </div>
                  ))
                ) : (
                  <p>지원서 원문 근거가 없는 질문입니다. 실제 경험은 면접에서 확인하세요.</p>
                )}
              </details>
            </article>
          );
        })}
      </div>
      <div className="interview-review-footer">
        <Button type="button" variant="outline" onClick={onDiscard}>
          취소 · 기존 질문 유지
        </Button>
        <Button type="button" disabled={disabled} onClick={onApply}>
          {previewOnly ? '확인 후 미리보기에 적용' : '확인 후 질문지에 적용'}
        </Button>
      </div>
    </Dialog>
  );
}
