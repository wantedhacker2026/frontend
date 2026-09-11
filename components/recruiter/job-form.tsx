'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Busy, EmptyState } from '@/components/ui/states';
import { CriteriaEditor } from './criteria-editor';
import { backendDescription } from '@/data/mock/seed';
import { generateCriteria, validateCriteria } from '@/data/mock/criteria';
import type { EvaluationCriterion, Job } from '@/types';
import { uid } from '@/lib/utils';
export function JobForm({ jobId }: { jobId?: string }) {
  const { db, addJob, updateCriteria } = useStore();
  const router = useRouter();
  const existing = db.jobs.find((j) => j.id === jobId);
  const [id] = useState(() => jobId ?? uid('job'));
  const [title, setTitle] = useState('Backend Engineer');
  const [role, setRole] = useState('백엔드 개발');
  const [company, setCompany] = useState('Shortlist Studio');
  const [description, setDescription] = useState(backendDescription);
  const [minExperience, setMinExperience] = useState(1);
  const [criteria, setCriteria] = useState<EvaluationCriterion[]>(
    jobId ? db.criteria.filter((c) => c.jobId === jobId) : [],
  );
  const [step, setStep] = useState(jobId ? 2 : 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (jobId && !existing)
    return <EmptyState title="채용공고를 찾을 수 없습니다" href="/recruiter/jobs" />;
  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    await new Promise((r) => setTimeout(r, 450));
    setCriteria(generateCriteria(id, description));
    setStep(2);
    setBusy(false);
  }
  async function save() {
    const error = validateCriteria(criteria);
    if (error) {
      setError(error);
      return;
    }
    setBusy(true);
    try {
      if (jobId) await updateCriteria(jobId, criteria);
      else {
        const job: Job = {
          id,
          title: title.trim(),
          companyName: company.trim(),
          role: role.trim(),
          description: description.trim(),
          createdAt: new Date().toISOString(),
          location: '서울 · 하이브리드',
          employmentType: '정규직',
          minExperience,
        };
        addJob(job, criteria);
      }
      router.push(`/recruiter/jobs/${id}/candidates`);
    } catch (error) {
      setError(error instanceof Error ? error.message : '저장에 실패했습니다. 다시 시도해 주세요.');
      setBusy(false);
    }
  }
  return (
    <div className="form-page">
      <Link
        className="back-link"
        href={jobId ? `/recruiter/jobs/${jobId}/candidates` : '/recruiter/jobs'}
      >
        <ArrowLeft size={14} />
        {jobId ? '지원자 목록' : '채용 대시보드'}
      </Link>
      <div className="page-heading">
        <div>
          <div className="eyebrow">{jobId ? 'EVALUATION CRITERIA' : 'NEW OPPORTUNITY'}</div>
          <h1>{jobId ? '평가 기준 수정' : '새로운 동료를 만날 준비.'}</h1>
          <p>{jobId ? existing?.title : 'JD를 입력하면 일관된 평가의 기준을 만들어 드려요.'}</p>
        </div>
      </div>
      {!jobId && (
        <div className="form-steps">
          <span className={step === 1 ? 'active' : ''}>
            <i>{step > 1 ? <Check size={13} /> : 1}</i>채용공고 작성
          </span>
          <div />
          <span className={step === 2 ? 'active' : ''}>
            <i>2</i>평가 기준 확인
          </span>
        </div>
      )}
      {step === 1 ? (
        <form onSubmit={generate} className="job-form panel">
          <div className="form-two-col">
            <label>
              공고 제목
              <input
                required
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              직무
              <input
                required
                maxLength={80}
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
            </label>
            <label>
              회사명
              <input
                required
                maxLength={80}
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </label>
            <label>
              권장 경력 (년)
              <input
                required
                type="number"
                min={0}
                max={50}
                step={0.1}
                value={minExperience}
                onChange={(e) => setMinExperience(Number(e.target.value))}
              />
            </label>
          </div>
          <label>
            JD 본문<span className="field-hint">지원 자격과 우대사항을 구체적으로 적어주세요.</span>
            <textarea
              required
              minLength={30}
              maxLength={15000}
              rows={18}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <div className="form-actions">
            <span className="muted text-xs">키워드 기반으로 평가 기준 초안을 생성합니다.</span>
            <Button
              type="submit"
              disabled={busy || !title.trim() || !role.trim() || !company.trim()}
            >
              {busy ? (
                <Busy text="기준 생성 중" />
              ) : (
                <>
                  <Sparkles size={16} />
                  평가 기준 생성
                  <ArrowRight size={16} />
                </>
              )}
            </Button>
          </div>
        </form>
      ) : (
        <div className="panel">
          <CriteriaEditor
            criteria={criteria}
            onChange={(c) => {
              setCriteria(c);
              setError('');
            }}
            jobId={id}
          />
          {jobId && (
            <p className="info-box mt-6">
              저장하면 기존 지원서를 새 기준으로 재평가하고 검토 상태를 ‘검토 전’으로 변경합니다.
              완료한 개선 액션도 새 평가에 맞춰 초기화됩니다.
            </p>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            {!jobId ? (
              <Button variant="outline" onClick={() => setStep(1)}>
                이전 단계
              </Button>
            ) : (
              <span />
            )}
            <Button onClick={save} disabled={busy}>
              {busy ? (
                <Busy text="저장 중" />
              ) : (
                <>
                  {jobId ? '기준 저장 및 재평가' : '공고 등록하기'}
                  <ArrowRight size={16} />
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
