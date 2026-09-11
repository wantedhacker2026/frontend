'use client';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, CheckCheck, FileSliders, Sparkles, Users } from 'lucide-react';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
import { CandidateTable } from './candidate-table';
export function CandidatesPage({ jobId }: { jobId: string }) {
  const { db } = useStore();
  const job = db.jobs.find((j) => j.id === jobId);
  if (!job) return <EmptyState title="채용공고를 찾을 수 없습니다" href="/recruiter/jobs" />;
  const apps = db.applications.filter((a) => a.jobId === jobId);
  const evaluations = db.evaluations.filter((e) => apps.some((a) => a.id === e.applicationId));
  const avg = evaluations.length
    ? Math.round(evaluations.reduce((s, e) => s + e.totalScore, 0) / evaluations.length)
    : 0;
  return (
    <>
      <Link className="back-link" href="/recruiter/jobs">
        <ArrowLeft size={14} />
        전체 채용공고
      </Link>
      <div className="page-heading candidate-page-heading">
        <div>
          <div className="flex items-center gap-3">
            <h1>{job.title}</h1>
            <span className="hiring-badge">
              <span />
              채용 중
            </span>
          </div>
          <p>
            {job.companyName}
            <span className="caption-separator">·</span>
            {job.location}
            <span className="caption-separator">·</span>
            {job.employmentType}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/recruiter/jobs/${jobId}/criteria`}>
              <FileSliders size={15} />
              평가 기준
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/jobs/${jobId}`}>
              공고 보기
              <ArrowUpRight size={15} />
            </Link>
          </Button>
        </div>
      </div>
      <div className="stats-grid candidate-stats">
        <div className="stat-block">
          <div className="stat-label">
            전체 지원자
            <Users size={16} />
          </div>
          <div className="stat-value">
            {apps.length}
            <small>명</small>
          </div>
          <p>모든 지원서 분석 완료</p>
        </div>
        <div className="stat-block">
          <div className="stat-label">
            평균 Match Score
            <Sparkles size={16} />
          </div>
          <div className="stat-value">
            {evaluations.length ? avg : '—'}
            <small>/ 100</small>
            <div className="mini-bars">
              {[35, 52, 41, 68, 60, 85, 74, 94].map((h, i) => (
                <span key={i} style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
          <p>동일한 평가 기준으로 산출</p>
        </div>
        <div className="stat-block">
          <div className="stat-label">
            필수조건 충족
            <CheckCheck size={16} />
          </div>
          <div className="stat-value">
            {evaluations.filter((e) => e.requiredMet).length}
            <small>명</small>
            <span className="stat-percent">
              {apps.length
                ? Math.round((evaluations.filter((e) => e.requiredMet).length / apps.length) * 100)
                : 0}
              %
            </span>
          </div>
          <p>지원서에서 필수 역량 근거 확인</p>
        </div>
        <div className="stat-block">
          <div className="stat-label">
            검토 완료
            <CheckCheck size={16} />
          </div>
          <div className="stat-value">
            {apps.filter((a) => a.status !== 'NEW').length}
            <small>/ {apps.length}</small>
          </div>
          <div className="progress-track mt-3">
            <span
              style={{
                width: `${apps.length ? (apps.filter((a) => a.status !== 'NEW').length / apps.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      </div>
      <CandidateTable jobId={jobId} />
      <div className="evaluation-footnote">
        <Sparkles size={15} />
        <p>
          JD와 지원서의 근거를 연결한 <strong>키워드 기반 데모 평가</strong>입니다. 근거 미확인은
          역량의 부재를 의미하지 않습니다.
        </p>
      </div>
    </>
  );
}
