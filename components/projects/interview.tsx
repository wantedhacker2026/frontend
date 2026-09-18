'use client';
import { authenticatedFetch } from '@/lib/auth/client';
import { InterviewReviewDialog } from './interview-review';
import { CareerEvidenceSummary, InterviewSourceEvidence } from './interview-evidence';
import {
  applyInterviewReview,
  interviewReviewSchema,
  reviewStorageKey,
  type InterviewReview,
} from '@/lib/interview/review';
import { InterviewPrompt } from './interview-prompt';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { MessageSquare, RefreshCw, Copy, Printer, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProjects } from '@/lib/projects/store';
import type { AnalysisProject, ProjectAnalysis, ProjectRevision } from '@/lib/projects/types';
import {
  assessmentNames,
  buildInterviewInput,
  interviewText,
  packetKey,
  stageNames,
  templateQuestions,
} from '@/lib/interview/domain';
import {
  generationSchema,
  type InterviewGeneration,
  type InterviewInput,
  type InterviewPacket,
  type InterviewQuestion,
} from '@/lib/interview/types';

const pending = new Map<string, Promise<InterviewGeneration>>();
async function generate(input: InterviewInput) {
  const key = JSON.stringify(input);
  if (pending.has(key)) return pending.get(key)!;
  const task = (async () => {
    try {
      const response = await authenticatedFetch('/api/interviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: key,
        signal: AbortSignal.timeout(65_000),
      });
      if (response.status === 401) throw new Error('login-required');
      if (!response.ok) throw new Error('generation');
      return generationSchema.parse(await response.json());
    } catch (error) {
      if (error instanceof Error && error.message === 'login-required')
        throw new Error('로그인이 만료되었습니다. 다시 로그인 후 생성해 주세요.');
      return {
        ...templateQuestions(input),
        notice:
          '질문 생성 연결을 확인하지 못해 기본 질문을 표시합니다. 잠시 후 다시 시도해 주세요.',
      };
    }
  })();
  pending.set(key, task);
  try {
    return await task;
  } finally {
    pending.delete(key);
  }
}

export function InterviewPanel({
  project,
  revision,
  analysis,
}: {
  project: AnalysisProject;
  revision: ProjectRevision;
  analysis: ProjectAnalysis;
}) {
  const { commitInterview, commitInterviewPrompt } = useProjects();
  const [prompt, setPrompt] = useState(project.interviewPrompt ?? '');
  const packet = project.interviews?.find((p) => p.key === packetKey(revision.id, analysis.id));
  const recruiter = project.role === 'recruiter';
  const questionPrefix = useId();
  const sourceContext = { revision, personId: analysis.personId };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [review, setReview] = useState<InterviewReview | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewReady, setReviewReady] = useState(false);
  const reviewKey = packetKey(revision.id, analysis.id);
  const storageKey = reviewStorageKey(project, reviewKey);
  const attempted = useRef(false);
  const lock = useRef(false);
  const input = useMemo(
    () => buildInterviewInput({ ...project, interviewPrompt: prompt }, revision, analysis),
    [project, prompt, revision, analysis],
  );
  const hasCareer = Boolean(input.experienceTopics?.length);
  const hasPreviousQuestions = project.interviews?.some(
    (p) => p.revisionId === revision.id && p.analysisId === analysis.id && p.key !== reviewKey,
  );

  /* eslint-disable react-hooks/set-state-in-effect -- Restore generated drafts from external tab storage. */
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const saved = interviewReviewSchema.parse(JSON.parse(raw));
        if (saved.key !== reviewKey) throw new Error('invalid draft');
        setReview(saved);
        attempted.current = true;
      }
    } catch {
      attempted.current = true;
      setError(
        '임시 생성 결과를 복원하지 못했습니다. 기존 질문은 유지되며 다시 생성할 수 있습니다.',
      );
    }
    setReviewReady(true);
  }, [storageKey, reviewKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function clearReview() {
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      setError('임시 결과 정리에 실패했습니다. 기존 질문은 유지됩니다.');
    }
    setReview(null);
    setReviewOpen(false);
    attempted.current = true;
  }
  function acceptReview() {
    if (!review) return;
    try {
      const next = applyInterviewReview(project, revision, analysis, review, packet);
      commitInterview(project.id, next, review.baseVersion);
      clearReview();
      setError('');
      setMessage('검토한 질문을 적용했습니다.');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function createOrRegenerate() {
    if (lock.current || review || !reviewReady || !hasCareer) return;
    lock.current = true;
    attempted.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      commitInterviewPrompt(project.id, prompt, project.interviewPrompt ?? '');
      const result = await generate(input);
      if (!result.questions.length) {
        setMessage(result.notice);
        return;
      }
      const draft = {
        key: reviewKey,
        baseVersion: packet?.version ?? 0,
        createdAt: new Date().toISOString(),
        prompt,
        result,
      };
      setReview(draft);
      setReviewOpen(true);
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(draft));
      } catch {
        setError('생성 결과의 임시 저장에 실패했습니다. 새로고침하기 전에 검토 후 적용해 주세요.');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  useEffect(() => {
    if (hasCareer && reviewReady && !recruiter && !packet && !review && !attempted.current)
      void createOrRegenerate();
    // Initialize only once per analysis; pending review drafts survive page reloads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCareer, reviewReady, recruiter, packet, review]);

  function update(next: InterviewPacket) {
    if (!packet) return;
    try {
      commitInterview(project.id, next, packet.version);
      setError('');
      setMessage('저장했습니다.');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function edit(id: string, patch: Partial<InterviewQuestion>) {
    if (packet)
      update({
        ...packet,
        questions: packet.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)),
      });
  }
  function move(index: number, direction: number) {
    if (!packet) return;
    const questions = [...packet.questions];
    [questions[index], questions[index + direction]] = [
      questions[index + direction],
      questions[index],
    ];
    update({ ...packet, questions });
  }
  const locked = Boolean(packet && packet.stage !== 'preparing');
  const staleReview = Boolean(
    review && (review.baseVersion !== (packet?.version ?? 0) || (recruiter && locked)),
  );
  return (
    <section className="interview-panel" aria-label={recruiter ? '면접 질문지' : '예상 면접 질문'}>
      <div className="interview-heading">
        <MessageSquare size={23} />
        <div>
          <span className="eyebrow">
            {recruiter ? 'INTERVIEW WORKSPACE' : 'PREPARE YOUR NEXT CONVERSATION'}
          </span>
          <h2>{recruiter ? '면접 준비' : '예상 면접 질문'}</h2>
          <p>
            {recruiter
              ? '이력서의 경력 항목에 작성한 담당 업무와 수행 경험으로 면접을 준비하세요.'
              : '이력서의 경력 항목을 바탕으로 만든 질문과 원문 근거를 확인하세요.'}
          </p>
        </div>
        {packet && (
          <span className="interview-badge">
            {recruiter
              ? stageNames[packet.stage]
              : `${packet.questions.filter((q) => q.prepared).length}/${packet.questions.length} 준비 완료`}
          </span>
        )}
      </div>
      <p className="interview-privacy">
        {recruiter
          ? '질문과 메모는 구직자 화면에 표시되지 않습니다. 면접 확인 상태는 서류 점수에 반영되지 않습니다.'
          : '실제 면접 질문을 보장하지 않습니다. 연습 메모는 채용담당자 화면에 표시되지 않습니다.'}{' '}
        현재 브라우저에 저장됩니다.
      </p>
      {error && (
        <p role="alert" className="project-error">
          {error}
        </p>
      )}
      {!hasCareer && !recruiter && (
        <p className="project-notice" role="status">
          {templateQuestions(input).notice}
        </p>
      )}
      {!packet && hasPreviousQuestions && (
        <p className="project-notice">
          질문 기준이 경력 항목으로 변경되었습니다. 이전 질문과 메모는 저장 데이터에 보존되며, 새
          기준의 질문지를 별도로 생성합니다.
        </p>
      )}
      {recruiter && (
        <CareerEvidenceSummary
          context={sourceContext}
          topics={input.experienceTopics ?? []}
          questions={packet?.questions ?? []}
          questionPrefix={questionPrefix}
        />
      )}
      <details className="project-criteria-editor">
        <summary>질문 생성 지침 관리</summary>
        <InterviewPrompt
          value={prompt}
          onChange={setPrompt}
          disabled={busy || (recruiter && locked)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={busy || (recruiter && locked)}
          onClick={() => {
            try {
              commitInterviewPrompt(project.id, prompt, project.interviewPrompt ?? '');
              setMessage('지침을 저장했습니다. 질문 다시 생성 시 적용됩니다.');
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          지침 저장
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy || (recruiter && locked)}
          onClick={() => setPrompt('')}
        >
          기본 지침으로 초기화
        </Button>
        <p>
          저장된 질문에는 자동 적용되지 않습니다. 질문을 다시 생성해 주세요. 직접 수정한 질문은
          유지됩니다.
        </p>
        {packet && (
          <small>
            현재 질문에 사용한 지침:{' '}
            {packet.generation === 'ai'
              ? packet.promptUsed || '기본 지침'
              : '기본 질문 (추가 지침 미적용)'}
          </small>
        )}
      </details>
      {review && (
        <>
          <div className="interview-review-banner" role="status">
            <div>
              <strong>새 질문 {review.result.questions.length}개 생성 완료 · 검토 대기</strong>
              <p>
                아직 적용하지 않은 결과입니다. 같은 탭에서 새로고침해도 다시 확인할 수 있습니다.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => {
                setError('');
                setReviewOpen(true);
              }}
            >
              생성 결과 확인
            </Button>
          </div>
          <InterviewReviewDialog
            open={reviewOpen}
            onOpenChange={setReviewOpen}
            result={review.result}
            prompt={review.prompt}
            previous={packet?.questions}
            sourceContext={sourceContext}
            disabled={staleReview}
            error={
              staleReview
                ? '기존 질문이나 메모가 변경되었습니다. 취소한 뒤 다시 생성해 주세요.'
                : error
            }
            onApply={acceptReview}
            onDiscard={() => {
              clearReview();
              setError('');
              setMessage('생성 결과를 취소했습니다. 기존 질문을 유지합니다.');
            }}
          />
        </>
      )}
      {!packet ? (
        <Button
          type="button"
          disabled={!hasCareer || busy || Boolean(review) || !reviewReady}
          onClick={createOrRegenerate}
        >
          {busy
            ? '질문 생성·근거 확인 중…'
            : recruiter
              ? '면접 대상으로 선택 · 질문 생성'
              : '예상 질문 생성'}
        </Button>
      ) : (
        <>
          <p className="interview-generation" role="status">
            {busy
              ? '질문을 준비하고 있습니다. 기존 서류 분석은 바로 확인할 수 있습니다.'
              : packet.notice}
          </p>
          <div className="interview-toolbar">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={
                !hasCareer || busy || Boolean(review) || !reviewReady || (recruiter && locked)
              }
              onClick={createOrRegenerate}
            >
              <RefreshCw size={14} />
              질문 다시 생성
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    interviewText(
                      `${project.title} · ${analysis.name} · 분석 v${revision.number}`,
                      packet,
                    ),
                  );
                  setMessage('질문과 메모를 복사했습니다.');
                } catch {
                  setError('복사하지 못했습니다. 인쇄용 보기에서 내용을 선택해 주세요.');
                }
              }}
            >
              <Copy size={14} />
              질문·메모 복사
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                const target = window.open('', '_blank');
                if (!target) {
                  setError('팝업이 차단됐습니다. 이 사이트의 팝업을 허용해 주세요.');
                  return;
                }
                target.opener = null;
                target.document.title = `${project.title} 면접 준비`;
                const pre = target.document.createElement('pre');
                pre.textContent = interviewText(
                  `${project.title} · ${analysis.name} · 분석 v${revision.number}`,
                  packet,
                );
                pre.style.cssText =
                  'white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.8 sans-serif;padding:24px';
                target.document.body.append(pre);
                target.focus();
                target.print();
              }}
            >
              <Printer size={14} />
              인쇄용 보기
            </Button>
            {recruiter && (
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() =>
                  update({
                    ...packet,
                    stage:
                      packet.stage === 'preparing'
                        ? 'ready'
                        : packet.stage === 'ready'
                          ? 'completed'
                          : 'preparing',
                  })
                }
              >
                {packet.stage === 'preparing'
                  ? '질문지 확정'
                  : packet.stage === 'ready'
                    ? '면접 완료로 표시'
                    : '면접 준비로 다시 열기'}
              </Button>
            )}
            {recruiter && packet.stage === 'ready' && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => update({ ...packet, stage: 'preparing' })}
              >
                질문 수정하기
              </Button>
            )}
          </div>
          <small>다시 생성해도 수정한 질문, 삭제한 질문의 제외 상태와 메모는 유지됩니다.</small>
          <div className="interview-questions">
            {packet.questions.map((q, index) => (
              <article
                className="interview-question"
                key={q.id}
                id={`${questionPrefix}-question-${index + 1}`}
                tabIndex={-1}
              >
                <div className="interview-question-heading">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>
                    {q.kind === 'common' ? '공통' : '개인별'} · {q.topic}
                    {q.edited ? ' · 직접 수정' : ''}
                  </strong>
                  {recruiter && !locked && (
                    <div className="interview-actions">
                      <button
                        type="button"
                        disabled={busy || index === 0}
                        aria-label={`${index + 1}번 질문 위로`}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        type="button"
                        disabled={busy || index === packet.questions.length - 1}
                        aria-label={`${index + 1}번 질문 아래로`}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown size={15} />
                      </button>
                      <button
                        type="button"
                        disabled={busy || packet.questions.length === 1}
                        aria-label={`${index + 1}번 질문 삭제`}
                        onClick={() =>
                          update({
                            ...packet,
                            questions: packet.questions.filter((v) => v.id !== q.id),
                          })
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
                {!q.edited && q.grounding && (
                  <small>
                    {q.grounding === 'verified' ? 'AI 질문 · 맥락 자동 검토' : '기본 질문'}
                  </small>
                )}
                {recruiter && !locked ? (
                  <SavedText
                    key={`${q.id}:question:${q.question}`}
                    label={`${index + 1}번 면접 질문`}
                    value={q.question}
                    disabled={busy}
                    maxLength={1000}
                    required
                    onSave={(value) => edit(q.id, { question: value, edited: true })}
                  />
                ) : (
                  <h3>{q.question}</h3>
                )}
                <p className="interview-reason">{q.reason}</p>
                <section
                  className="interview-evidence"
                  aria-label={`${index + 1}번 질문의 경력 근거`}
                >
                  <strong>질문의 근거가 된 경력 원문</strong>
                  {q.sources.length ? (
                    q.sources.map((s, i) => (
                      <InterviewSourceEvidence key={i} context={sourceContext} source={s} />
                    ))
                  ) : (
                    <p>
                      {q.kind === 'common'
                        ? 'JD 기반 공통 질문입니다.'
                        : '확인 가능한 지원서 원문이 없습니다. 경험이 없다고 판단하지 않습니다.'}
                    </p>
                  )}
                  {q.jdEvidence && (
                    <>
                      <strong>관련 공고 내용 · 참고</strong>
                      <blockquote>{q.jdEvidence}</blockquote>
                    </>
                  )}
                </section>
                <div className="interview-guidance">
                  <strong>{recruiter ? '후속 질문' : '답변 준비 가이드'}</strong>
                  <ul>
                    {(recruiter ? q.followups : q.guide).map((text, i) => (
                      <li key={i}>{text}</li>
                    ))}
                  </ul>
                </div>
                <SavedText
                  key={`${q.id}:note:${q.note}`}
                  label={recruiter ? `${index + 1}번 면접관 메모` : `${index + 1}번 나의 연습 메모`}
                  value={q.note}
                  disabled={busy}
                  maxLength={10000}
                  onSave={(value) => edit(q.id, { note: value })}
                />
                {recruiter ? (
                  <label className="interview-status">
                    확인 상태
                    <select
                      aria-label={`${index + 1}번 확인 상태`}
                      value={q.assessment}
                      disabled={busy}
                      onChange={(e) =>
                        edit(q.id, {
                          assessment: e.target.value as InterviewQuestion['assessment'],
                        })
                      }
                    >
                      {Object.entries(assessmentNames).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label className="interview-status">
                    <input
                      type="checkbox"
                      checked={q.prepared}
                      disabled={busy}
                      onChange={(e) => edit(q.id, { prepared: e.target.checked })}
                    />
                    이 질문의 답변 준비 완료
                  </label>
                )}
              </article>
            ))}
          </div>
        </>
      )}
      <p role="status" className="interview-save-status">
        {message}
      </p>
    </section>
  );
}

function SavedText({
  label,
  value,
  onSave,
  disabled,
  maxLength,
  required = false,
}: {
  label: string;
  value: string;
  onSave: (value: string) => void;
  disabled: boolean;
  maxLength: number;
  required?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <div className="interview-text">
      <label>
        {label}
        <textarea
          value={draft}
          disabled={disabled}
          rows={3}
          maxLength={maxLength}
          onChange={(e) => setDraft(e.target.value)}
        />
      </label>
      {draft !== value && (
        <div className="interview-toolbar">
          <Button
            type="button"
            size="sm"
            disabled={disabled || (required && !draft.trim())}
            onClick={() => onSave(draft)}
          >
            저장
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setDraft(value)}>
            취소
          </Button>
          <small role="status">아직 저장하지 않은 내용입니다.</small>
        </div>
      )}
    </div>
  );
}
