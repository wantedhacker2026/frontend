'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, FileText, Sparkles } from 'lucide-react';
import { useStore } from '@/lib/store';
import type { ApplicationInput } from '@/types';
import { sampleApplication } from '@/data/mock/seed';
import { Button } from '@/components/ui/button';
import { Busy, EmptyState } from '@/components/ui/states';
import { ApplicationFields } from './application-fields';
import { applicationContent, blankApplication } from '@/lib/resumes';
export function ApplicationForm({
  jobId,
  applicationId,
  onSaved,
}: {
  jobId?: string;
  applicationId?: string;
  onSaved?: (id: string) => void;
}) {
  const { db, submitApplication, saveResume, submitResume } = useStore();
  const existing = db.applications.find((a) => a.id === applicationId);
  const candidate = db.candidates.find((c) => c.id === existing?.candidateId);
  const job = db.jobs.find((j) => j.id === (jobId ?? existing?.jobId));
  const [form, setForm] = useState<ApplicationInput>(
    existing && candidate ? applicationContent(existing, candidate) : { ...blankApplication },
  );
  const [title, setTitle] = useState(job ? `${job.title} · 기본 지원서` : '');
  const [savedId, setSavedId] = useState<string>();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  if (!job || (applicationId && !existing))
    return <EmptyState title="지원 정보를 찾을 수 없습니다" href="/jobs" />;
  const actualJobId = job.id;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      await new Promise((r) => setTimeout(r, 650));
      let id: string;
      if (applicationId) {
        id = await submitApplication(actualJobId, form, applicationId);
      } else {
        const resumeId = saveResume(title, form, savedId);
        setSavedId(resumeId);
        id = await submitResume(actualJobId, resumeId);
      }
      router.push(`/applications/${id}?${applicationId ? 'updated' : 'submitted'}=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '분석에 실패했습니다. 다시 시도해 주세요.');
      setBusy(false);
    }
  }
  function saveOnly() {
    if (!formRef.current?.reportValidity()) return;
    try {
      const id = saveResume(title, form, savedId);
      setSavedId(id);
      onSaved?.(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했습니다.');
    }
  }
  return (
    <div className="form-page">
      {!onSaved && (
        <>
          <Link
            className="back-link"
            href={applicationId ? `/applications/${applicationId}` : `/jobs/${actualJobId}`}
          >
            <ArrowLeft size={14} />
            {applicationId ? '매칭 결과' : '공고 상세'}
          </Link>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {applicationId ? 'MAKE YOUR EXPERIENCE VISIBLE' : 'YOUR EXPERIENCE MATTERS'}
              </div>
              <h1>
                {applicationId ? '경험을 더 선명하게 보여주세요.' : '당신의 경험을 들려주세요.'}
              </h1>
              <p>
                {job.companyName} · {job.title}
              </p>
            </div>
          </div>
        </>
      )}
      <div className="application-form-intro">
        <FileText size={20} />
        <p>
          실제로 수행한 경험을 작성해 주세요.{' '}
          <strong>구체적인 근거가 더 정확한 분석을 만듭니다.</strong>
        </p>
        {!applicationId && (
          <Button size="sm" variant="outline" onClick={() => setForm({ ...sampleApplication })}>
            <Sparkles size={14} />
            예시 채우기
          </Button>
        )}
      </div>
      <form ref={formRef} className="panel application-form" onSubmit={submit}>
        {!applicationId && (
          <label>
            버전 이름 <em>*</em>
            <span className="field-hint">예: 백엔드 기본형, Kafka 프로젝트 강조형</span>
            <input
              required
              maxLength={80}
              value={title}
              disabled={busy}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
        )}
        <ApplicationFields form={form} onChange={setForm} disabled={busy} />
        <div className="info-box">
          입력 내용은 이 브라우저에 저장됩니다. 키워드 기반 데모 분석이며, 이름과 이메일은 평가에
          사용하지 않습니다.
          {applicationId
            ? ' 다시 분석하면 검토 상태와 개선 액션 완료 기록이 초기화됩니다. 내 지원서의 저장 버전은 변경되지 않습니다.'
            : ' 지원할 때 이 내용을 내 지원서 버전으로 함께 저장합니다.'}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <span className="muted text-xs">* 필수 항목</span>
          <div className="resume-button-row">
            {!applicationId && (
              <Button type="button" variant="outline" disabled={busy} onClick={saveOnly}>
                버전만 저장
              </Button>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? (
                <Busy text="지원서 근거를 분석하고 있어요" />
              ) : (
                <>
                  {applicationId ? '저장하고 다시 분석' : '버전 저장 후 지원·분석'}
                  <ArrowRight size={16} />
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
