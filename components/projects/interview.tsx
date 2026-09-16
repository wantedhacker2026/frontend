'use client';
import { useEffect, useRef, useState } from 'react';
import { MessageSquare, RefreshCw, Copy, Printer, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProjects } from '@/lib/projects/store';
import type {
  AnalysisProject,
  ProjectAnalysis,
  ProjectDraft,
  ProjectRevision,
} from '@/lib/projects/types';
import {
  assessmentNames,
  buildInterviewInput,
  interviewText,
  newPacket,
  regeneratePacket,
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
      const response = await fetch('/api/interviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: key,
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error('generation');
      return generationSchema.parse(await response.json());
    } catch {
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

export function JDInterviewPreview({ draft }: { draft: ProjectDraft }) {
  if (draft.jd.text.trim().length < 20 || !draft.criteria.some((c) => c.name.trim())) return null;
  const input = buildInterviewInput({
    role: 'applicant',
    jd: draft.jd,
    criteria: draft.criteria.filter((c) => c.name.trim()),
  });
  const basic = templateQuestions(input);
  return (
    <section className="interview-panel interview-preview" aria-label="JD 기반 면접 준비">
      <div className="interview-heading">
        <MessageSquare size={22} />
        <div>
          <h2>이 공고의 예상 면접 질문</h2>
          <p>
            서류 등록 전에도 준비할 수 있는 JD 기반 기본 질문입니다. 분석을 마치면 내 경험에 맞춘
            질문이 추가됩니다.
          </p>
        </div>
      </div>
      <ol className="interview-preview-list">
        {basic.questions.map((q) => (
          <li key={q.id}>
            <strong>{q.question}</strong>
            <p>{q.jdEvidence || `${q.topic} 기준에 연결된 질문`}</p>
          </li>
        ))}
      </ol>
      <small>실제 채용담당자의 질문과 다를 수 있습니다.</small>
    </section>
  );
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
  const { commitInterview } = useProjects();
  const packet = project.interviews?.find((p) => p.key === packetKey(revision.id, analysis.id));
  const recruiter = project.role === 'recruiter';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const attempted = useRef(false);
  const lock = useRef(false);

  async function createOrRegenerate() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    const input = buildInterviewInput(project, revision, analysis);
    let base = packet;
    try {
      if (!base) {
        base = newPacket(project, revision, analysis, templateQuestions(input));
        commitInterview(project.id, base, 0);
      }
      const result = await generate(input);
      const next = packet ? regeneratePacket(packet, result) : { ...base, ...result };
      commitInterview(project.id, next, base.version);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  useEffect(() => {
    if (!recruiter && !packet && !attempted.current) {
      attempted.current = true;
      void createOrRegenerate();
    }
    // Initialization is once per keyed analysis. Saved packets are reused on every later visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recruiter, packet]);

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
  const locked = packet?.stage !== 'preparing';
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
              ? '같은 공고의 공통 질문과 지원자별 확인 질문을 준비하세요.'
              : '질문의 이유를 확인하고, 자신의 경험으로 답변을 준비하세요.'}
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
      {!packet ? (
        <Button type="button" disabled={busy} onClick={createOrRegenerate}>
          {recruiter ? '면접 대상으로 선택' : '예상 질문 생성'}
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
              disabled={busy || (recruiter && locked)}
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
              <article className="interview-question" key={q.id}>
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
                <details>
                  <summary>질문 근거 보기</summary>
                  <div className="interview-evidence">
                    <strong>연결된 JD</strong>
                    <blockquote>
                      {q.jdEvidence ||
                        `${q.topic} · 사용자가 지정한 기준으로, 일치하는 JD 문장은 없습니다.`}
                    </blockquote>
                    {q.sources.length ? (
                      q.sources.map((s, i) => (
                        <div key={i}>
                          <strong>
                            {s.filename} · {s.page}페이지
                          </strong>
                          <blockquote>{s.excerpt}</blockquote>
                        </div>
                      ))
                    ) : (
                      <p>
                        {q.kind === 'common'
                          ? 'JD 기반 공통 질문입니다.'
                          : '확인 가능한 지원서 원문이 없습니다. 경험이 없다고 판단하지 않습니다.'}
                      </p>
                    )}
                  </div>
                </details>
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
          <p role="status" className="interview-save-status">
            {message}
          </p>
        </>
      )}
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
