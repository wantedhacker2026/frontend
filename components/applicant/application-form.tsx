'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, FileText, Sparkles } from 'lucide-react';
import { useStore } from '@/lib/store';
import type { ApplicationInput } from '@/types';
import { sampleApplication } from '@/data/mock/seed';
import { Button } from '@/components/ui/button';
import { Busy, EmptyState } from '@/components/ui/states';
const blank: ApplicationInput = {
  name: '',
  email: '',
  experience: 0,
  skills: '',
  projects: '',
  introduction: '',
  motivation: '',
  collaboration: '',
  additionalExperience: '',
};
export function ApplicationForm({
  jobId,
  applicationId,
}: {
  jobId?: string;
  applicationId?: string;
}) {
  const { db, submitApplication } = useStore();
  const existing = db.applications.find((a) => a.id === applicationId);
  const candidate = db.candidates.find((c) => c.id === existing?.candidateId);
  const job = db.jobs.find((j) => j.id === (jobId ?? existing?.jobId));
  const [form, setForm] = useState<ApplicationInput>(
    existing && candidate ? { ...existing, name: candidate.name, email: candidate.email } : blank,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  if (!job || (applicationId && !existing))
    return <EmptyState title="지원 정보를 찾을 수 없습니다" href="/jobs" />;
  const actualJobId = job.id;
  function update<K extends keyof ApplicationInput>(key: K, value: ApplicationInput[K]) {
    setForm({ ...form, [key]: value });
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      await new Promise((r) => setTimeout(r, 650));
      const id = await submitApplication(actualJobId, form, applicationId);
      router.push(`/applications/${id}?${applicationId ? 'updated' : 'submitted'}=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '분석에 실패했습니다. 다시 시도해 주세요.');
      setBusy(false);
    }
  }
  const fields: {
    key: 'projects' | 'introduction' | 'motivation' | 'collaboration' | 'additionalExperience';
    label: string;
    hint: string;
    placeholder: string;
    rows: number;
    required: boolean;
  }[] = [
    {
      key: 'projects',
      label: '프로젝트 경험',
      hint: '사용한 기술, 본인의 역할, 수행 과정과 결과를 적어주세요.',
      placeholder:
        '예: Spring Boot로 주문 API를 개발하고 MySQL 쿼리를 개선해 응답 시간을 30% 줄였습니다.',
      rows: 5,
      required: true,
    },
    {
      key: 'introduction',
      label: '자기소개',
      hint: '어떤 문제를 해결하고 싶은 개발자인가요?',
      placeholder: '관심 분야와 자신만의 일하는 방식을 소개해 주세요.',
      rows: 3,
      required: true,
    },
    {
      key: 'motivation',
      label: '지원동기',
      hint: '이 회사와 직무를 선택한 이유를 알려주세요. 점수에는 반영하지 않습니다.',
      placeholder: '이 제품과 팀에서 기여하고 싶은 부분을 적어주세요.',
      rows: 3,
      required: true,
    },
    {
      key: 'collaboration',
      label: '협업 / 커뮤니케이션 경험',
      hint: '함께한 사람, 역할 분담, 의견을 조율한 과정을 적어주세요. 경험이 없으면 현재 상황을 적어도 괜찮아요.',
      placeholder: '예: 3명의 팀원과 API 명세를 조율하고 코드 리뷰를 진행했습니다.',
      rows: 4,
      required: true,
    },
    {
      key: 'additionalExperience',
      label: '추가 경험',
      hint: '학습, 자격증, 오픈소스 기여, 운영 경험 등을 자유롭게 적어주세요.',
      placeholder: '작성할 내용이 없다면 비워두어도 괜찮아요.',
      rows: 3,
      required: false,
    },
  ];
  return (
    <div className="form-page">
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
          <h1>{applicationId ? '경험을 더 선명하게 보여주세요.' : '당신의 경험을 들려주세요.'}</h1>
          <p>
            {job.companyName} · {job.title}
          </p>
        </div>
      </div>
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
      <form className="panel application-form" onSubmit={submit}>
        <div className="form-two-col">
          <label>
            이름 <em>*</em>
            <input
              required
              maxLength={50}
              autoComplete="name"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="이름을 입력하세요"
            />
          </label>
          <label>
            관련 경력 (년) <em>*</em>
            <input
              required
              type="number"
              min={0}
              max={60}
              step={0.1}
              value={form.experience}
              onChange={(e) => update('experience', Number(e.target.value))}
            />
          </label>
        </div>
        <label>
          이메일 <span className="optional">선택 · 실제 발송 없음</span>
          <input
            type="email"
            maxLength={254}
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            placeholder="example@email.com"
          />
        </label>
        <label>
          기술 스택 <em>*</em>
          <span className="field-hint">직접 사용하거나 학습한 기술을 쉼표로 구분해 주세요.</span>
          <input
            required
            maxLength={500}
            value={form.skills}
            onChange={(e) => update('skills', e.target.value)}
            placeholder="Java, Spring Boot, MySQL …"
          />
        </label>
        {fields.map((f) => (
          <label key={f.key}>
            {f.label} {f.required ? <em>*</em> : <span className="optional">선택</span>}
            <span className="field-hint">{f.hint}</span>
            <textarea
              required={f.required}
              maxLength={8000}
              rows={f.rows}
              placeholder={f.placeholder}
              value={form[f.key]}
              onChange={(e) => update(f.key, e.target.value)}
            />
          </label>
        ))}
        <div className="info-box">
          입력 내용은 이 브라우저에 저장됩니다. 키워드 기반 데모 분석이며, 이름과 이메일은 평가에
          사용하지 않습니다.
          {applicationId && ' 다시 분석하면 검토 상태와 개선 액션 완료 기록이 초기화됩니다.'}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <span className="muted text-xs">* 필수 항목</span>
          <Button type="submit" disabled={busy}>
            {busy ? (
              <Busy text="지원서 근거를 분석하고 있어요" />
            ) : (
              <>
                {applicationId ? '저장하고 다시 분석' : '지원하고 매칭 분석받기'}
                <ArrowRight size={16} />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
