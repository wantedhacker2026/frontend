'use client';

import { useCallback, useState } from 'react';
import { FileText, ArrowDownRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import {
  careerEvidenceRows,
  resolveInterviewSource,
  type EvidenceContext,
  type InterviewSource,
} from '@/lib/interview/evidence';
import type { InterviewInput, InterviewQuestion } from '@/lib/interview/types';

export function InterviewSourceEvidence({
  context,
  source,
}: {
  context: EvidenceContext;
  source: InterviewSource;
}) {
  const [open, setOpen] = useState(false);
  const revealExcerpt = useCallback((node: HTMLElement | null) => {
    if (node)
      requestAnimationFrame(() => {
        if (node.isConnected) node.scrollIntoView({ block: 'center' });
      });
  }, []);
  const resolved = resolveInterviewSource(context, source);
  if (!resolved)
    return (
      <p className="project-notice">
        현재 이력서에서 이 근거를 확인할 수 없습니다. 문서를 다시 확인해 주세요.
      </p>
    );
  return (
    <div className="interview-source">
      <div className="interview-source-heading">
        <span>
          <FileText size={15} aria-hidden="true" />
          {resolved.source.filename} · {source.page}페이지
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          aria-label={`${resolved.source.filename} ${source.page}페이지 원문 보기`}
        >
          원문 페이지 보기
        </Button>
      </div>
      <blockquote>{resolved.excerpt}</blockquote>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        wide
        title="이력서 원문 텍스트"
        description={`${resolved.source.filename} · ${source.page}페이지에서 추출한 텍스트입니다. 질문 근거로 사용한 문장을 강조했습니다.`}
      >
        <div
          className="interview-source-page"
          tabIndex={0}
          role="region"
          aria-label="근거가 강조된 원문 페이지"
        >
          {resolved.before}
          <mark ref={revealExcerpt}>{resolved.excerpt}</mark>
          {resolved.after}
        </div>
      </Dialog>
    </div>
  );
}

export function CareerEvidenceSummary({
  context,
  topics,
  questions,
  questionPrefix,
}: {
  context: EvidenceContext;
  topics: NonNullable<InterviewInput['experienceTopics']>;
  questions: InterviewQuestion[];
  questionPrefix: string;
}) {
  const rows = careerEvidenceRows(context, topics, questions);
  const linked = rows.filter((row) => row.questions.length).length;
  return (
    <section className="career-evidence-summary" aria-label="이력서에서 추출한 경력">
      <div className="career-evidence-heading">
        <div>
          <h3>이력서에서 추출한 경력</h3>
          <p>
            경력 항목에서 질문 후보로 추출한 내용을 모았습니다. 원문과 현재 질문의 연결을
            확인하세요.
          </p>
        </div>
        <span>
          추출 근거 {rows.length}개 · 질문과 연결 {linked}개
        </span>
      </div>
      {rows.length ? (
        <>
          <p className="career-evidence-hint">
            최대 12개 후보를 표시합니다. 질문 생성 전에는 원문을 먼저 확인할 수 있으며, 생성 결과를
            적용하면 연결된 질문이 표시됩니다.
          </p>
          <div
            className="career-evidence-list"
            role="region"
            aria-label="추출한 경력 근거 목록"
            tabIndex={0}
          >
            {rows.map((row, index) => (
              <article className="career-evidence-card" key={row.key}>
                <div className="career-evidence-card-heading">
                  <h4>경력 근거 {String(index + 1).padStart(2, '0')}</h4>
                  <span>
                    {row.questions.length
                      ? `질문 ${row.questions.map((q) => q.number).join(', ')}에 사용`
                      : '현재 질문에 사용하지 않음'}
                  </span>
                </div>
                <InterviewSourceEvidence context={context} source={row.source} />
                {row.questions.length > 0 && (
                  <div className="career-evidence-links">
                    <strong>이 경력에서 확인할 내용</strong>
                    {row.questions.map(({ question, number }) => (
                      <div key={question.id}>
                        <a href={`#${encodeURIComponent(`${questionPrefix}-question-${number}`)}`}>
                          <ArrowDownRight size={15} aria-hidden="true" />
                          질문 {number} · {question.topic}
                        </a>
                        <p>
                          {question.edited
                            ? '직접 수정한 질문입니다. 아래 질문과 원문의 연결을 함께 확인하세요.'
                            : question.reason}
                        </p>
                        <p className="career-evidence-linked-question">{question.question}</p>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      ) : (
        <p className="project-notice">
          경력 항목에서 질문에 사용할 업무 경험을 찾지 못했습니다. 이력서에 경력 제목과 담당 업무가
          포함되어 있는지 확인해 주세요.
        </p>
      )}
    </section>
  );
}
