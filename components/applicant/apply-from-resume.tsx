'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, FilePenLine, Plus } from 'lucide-react';
import { useStore } from '@/lib/store';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Busy, EmptyState } from '@/components/ui/states';
import { ResumePreview } from './resume-preview';
import { ApplicationForm } from './application-form';

export function ApplyFromResume({ jobId, resumeId }: { jobId: string; resumeId?: string }) {
  const { db, submitResume } = useStore();
  const resumes = [...db.resumes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const [selectedId, setSelectedId] = useState(resumeId ?? resumes[0]?.id ?? '');
  const [mode, setMode] = useState<'saved' | 'new'>(resumes.length || resumeId ? 'saved' : 'new');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState('');
  const [discard, setDiscard] = useState(false);
  const router = useRouter();
  const selected = resumes.find((r) => r.id === selectedId);
  const job = db.jobs.find((j) => j.id === jobId);
  if (!job) return <EmptyState title="공고를 찾을 수 없습니다" href="/jobs" />;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      const id = await submitResume(jobId, selected.id);
      router.push(`/applications/${id}?submitted=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '분석하지 못했습니다.');
      setBusy(false);
      submitting.current = false;
    }
  }
  return (
    <div className="form-page">
      <Link className="back-link" href={`/jobs/${jobId}`}>
        <ArrowLeft size={14} />
        공고 상세
      </Link>
      <div className="page-heading">
        <div>
          <div className="eyebrow">THE RIGHT VERSION FOR THIS OPPORTUNITY</div>
          <h1>어떤 지원서로 나를 보여줄까요?</h1>
          <p>
            {job.companyName} · {job.title}
          </p>
        </div>
      </div>
      <div className="resume-mode-bar">
        <div className="resume-button-row">
          <Button
            variant={mode === 'saved' ? 'secondary' : 'ghost'}
            disabled={!resumes.length || busy}
            onClick={() => (mode === 'new' ? setDiscard(true) : undefined)}
          >
            저장된 버전 {resumes.length}
          </Button>
          <Button
            variant={mode === 'new' ? 'secondary' : 'ghost'}
            disabled={busy}
            onClick={() => {
              setMode('new');
              setError('');
              setSaved(false);
            }}
          >
            <Plus size={14} />
            새로 작성
          </Button>
        </div>
        <Link href="/resumes" className="text-link">
          내 지원서 관리
          <ArrowRight size={14} />
        </Link>
      </div>
      {saved && (
        <p className="success-banner" role="status">
          <Check size={16} />
          지원서 버전을 저장했어요. 내용을 확인하고 지원해 주세요.
        </p>
      )}
      {mode === 'new' ? (
        <ApplicationForm
          key={jobId}
          jobId={jobId}
          onSaved={(id) => {
            setSelectedId(id);
            setMode('saved');
            setSaved(true);
          }}
        />
      ) : (
        <form onSubmit={submit}>
          <fieldset className="resume-choices" disabled={busy}>
            <legend>지원할 버전 선택</legend>
            {resumes.map((resume) => (
              <label
                key={resume.id}
                className={`resume-choice ${selectedId === resume.id ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="resume"
                  value={resume.id}
                  checked={selectedId === resume.id}
                  onChange={() => {
                    setSelectedId(resume.id);
                    setError('');
                    setSaved(false);
                  }}
                />
                <span>
                  <strong>{resume.title}</strong>
                  <small>
                    v{resume.revision} · {resume.content.name} · 경력 {resume.content.experience}년
                    · {formatDate(resume.updatedAt)} 수정
                  </small>
                  <span className="resume-choice-skills">{resume.content.skills}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {selected ? (
            <section className="panel selected-resume">
              <div className="resume-card-heading">
                <div>
                  <span className="eyebrow">SELECTED VERSION</span>
                  <h2>
                    {selected.title} <small>v{selected.revision}</small>
                  </h2>
                </div>
                {!busy && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/resumes/${selected.id}/edit?jobId=${jobId}`}>
                      <FilePenLine size={14} />
                      내용 수정
                    </Link>
                  </Button>
                )}
              </div>
              <ResumePreview key={selected.id} content={selected.content} />
              <p className="info-box mt-5">
                선택한 버전의 현재 내용을 복사해 제출합니다. 이후 내 지원서를 수정해도 이번 제출
                내용과 분석 결과는 유지됩니다.
              </p>
            </section>
          ) : (
            <p className="form-error" role="alert">
              선택한 지원서가 없습니다. 다른 버전을 선택하거나 새 지원서를 작성해 주세요.
            </p>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <span className="muted text-xs">현재 브라우저에서 체험하는 데모 지원입니다.</span>
            <Button type="submit" disabled={!selected || busy}>
              {busy ? (
                <Busy text="선택한 지원서를 분석하고 있어요" />
              ) : (
                <>
                  선택한 버전으로 지원·분석
                  <ArrowRight size={16} />
                </>
              )}
            </Button>
          </div>
        </form>
      )}
      <Dialog
        open={discard}
        onOpenChange={setDiscard}
        title="저장된 버전을 선택할까요?"
        description="새로 작성 중인 내용을 저장하지 않았다면 사라집니다."
      >
        <div className="resume-button-row justify-end">
          <Button variant="outline" onClick={() => setDiscard(false)}>
            계속 작성하기
          </Button>
          <Button
            onClick={() => {
              setMode('saved');
              setDiscard(false);
            }}
          >
            저장된 버전 선택
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
