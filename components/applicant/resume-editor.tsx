'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Copy, Save, Sparkles } from 'lucide-react';
import { useStore } from '@/lib/store';
import { applicationContent, blankApplication } from '@/lib/resumes';
import { sampleApplication } from '@/data/mock/seed';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/states';
import { ApplicationFields } from './application-fields';

export function ResumeEditor({
  resumeId,
  jobId,
  applicationId,
}: {
  resumeId?: string;
  jobId?: string;
  applicationId?: string;
}) {
  const { db, saveResume } = useStore();
  const existing = db.resumes.find((r) => r.id === resumeId);
  const imported = db.applications.find(
    (a) => a.id === applicationId && db.ownApplicationIds.includes(a.id),
  );
  const person = db.candidates.find((c) => c.id === imported?.candidateId);
  const job = db.jobs.find((j) => j.id === jobId);
  const initial =
    existing?.content ??
    (imported && person ? applicationContent(imported, person) : blankApplication);
  const [form, setForm] = useState({ ...initial });
  const [title, setTitle] = useState(
    existing?.title ?? (imported ? '기존 지원서 · 보강 버전' : ''),
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cancel, setCancel] = useState(false);
  const router = useRouter();
  if ((resumeId && !existing) || (applicationId && !imported))
    return <EmptyState title="지원서 버전을 찾을 수 없습니다" href="/resumes" label="내 지원서" />;
  const back = job ? `/jobs/${job.id}/apply${resumeId ? `?resumeId=${resumeId}` : ''}` : '/resumes';
  const dirty =
    JSON.stringify(form) !== JSON.stringify(initial) ||
    title !== (existing?.title ?? (imported ? '기존 지원서 · 보강 버전' : ''));
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const copy = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'copy';
    try {
      const name = copy && title === existing?.title ? `${title.slice(0, 70)} · 새 버전` : title;
      const id = saveResume(name, form, copy ? undefined : resumeId);
      router.push(job ? `/jobs/${job.id}/apply?resumeId=${id}` : '/resumes');
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했습니다.');
      setBusy(false);
    }
  }
  return (
    <div className="form-page">
      <Link
        href={back}
        className="back-link"
        onClick={(e) => {
          if (dirty) {
            e.preventDefault();
            setCancel(true);
          }
        }}
      >
        <ArrowLeft size={14} />
        {job ? '지원서 선택' : '내 지원서'}
      </Link>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR EXPERIENCE, YOUR VERSIONS</div>
          <h1>{existing ? '지원서를 더 선명하게.' : '나를 보여주는 지원서 만들기.'}</h1>
          <p>
            {job
              ? `${job.title} 지원을 위한 버전을 준비하세요.`
              : '공고에 맞춰 꺼내 쓸 나만의 경험을 정리하세요.'}
          </p>
        </div>
      </div>
      <div className="application-form-intro">
        <Sparkles size={20} />
        <p>직접 경험한 역할과 결과를 구체적으로 적어주세요.</p>
        {!existing && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setForm({ ...sampleApplication });
              if (!title) setTitle('백엔드 기본형');
            }}
          >
            예시 채우기
          </Button>
        )}
      </div>
      <form className="panel application-form" onSubmit={submit}>
        <label>
          버전 이름 <em>*</em>
          <span className="field-hint">
            백엔드 기본형, Kafka 프로젝트 강조형처럼 구분하기 쉬운 이름을 붙여주세요.
          </span>
          <input
            required
            maxLength={80}
            placeholder="예: 백엔드 기본형"
            value={title}
            disabled={busy}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <ApplicationFields form={form} onChange={setForm} disabled={busy} />
        <div className="info-box">
          현재 브라우저에 저장됩니다. 저장만으로 공고에 지원되거나 분석이 실행되지는 않습니다. 기존
          제출 내용과 분석 결과는 변경되지 않습니다.
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => (dirty ? setCancel(true) : router.push(back))}
          >
            취소
          </Button>
          <div className="resume-button-row">
            {existing && (
              <Button type="submit" value="copy" variant="outline" disabled={busy}>
                <Copy size={15} />새 버전으로 저장
              </Button>
            )}
            <Button type="submit" value="save" disabled={busy}>
              <Save size={15} />
              {busy ? '저장 중…' : existing ? '변경사항 저장' : '지원서 버전 저장'}
            </Button>
          </div>
        </div>
      </form>
      <Dialog
        open={cancel}
        onOpenChange={setCancel}
        title="저장하지 않고 나갈까요?"
        description="아직 저장하지 않은 변경사항은 사라집니다."
      >
        <div className="resume-button-row justify-end">
          <Button variant="outline" onClick={() => setCancel(false)}>
            계속 작성하기
          </Button>
          <Button onClick={() => router.push(back)}>저장하지 않고 나가기</Button>
        </div>
      </Dialog>
    </div>
  );
}
