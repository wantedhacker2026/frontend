'use client';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  MapPin,
  Search,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import type { Job } from '@/types';
import { categories } from '@/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
export function JobCard({ job, index = 0 }: { job: Job; index?: number }) {
  const { db } = useStore();
  const skills = db.criteria
    .filter((c) => c.jobId === job.id && c.category === '기술 역량')
    .slice(0, 4);
  return (
    <Link href={`/jobs/${job.id}`} className="job-card">
      <div className="flex items-center justify-between">
        <span className={`job-icon job-icon-${index % 3}`}>
          <BriefcaseBusiness size={23} />
        </span>
        <span className="hiring-badge">
          <span />
          채용 중
        </span>
      </div>
      <p className="job-company">{job.companyName}</p>
      <h2>{job.title}</h2>
      <p className="job-location">
        <MapPin size={14} />
        {job.location}
      </p>
      <div className="job-card-tags">
        {skills.map((c) => (
          <span key={c.id}>{c.name}</span>
        ))}
      </div>
      <div className="job-card-bottom">
        <span>
          경력 {job.minExperience}년 이상 권장 · {job.employmentType}
        </span>
        <ArrowRight size={18} />
      </div>
    </Link>
  );
}
export function JobList() {
  const { db } = useStore();
  const [search, setSearch] = useState('');
  const jobs = db.jobs.filter((j) =>
    `${j.title} ${j.role} ${j.companyName}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">FIND YOUR NEXT CHAPTER</div>
          <h1>당신의 다음 기회를 찾아보세요.</h1>
          <p>나와 맞는 공고를 찾고, 더 나은 지원을 준비하세요.</p>
        </div>
      </div>
      <div className="applicant-banner">
        <div>
          <Sparkles size={21} />
          <h2>지원하고, 발견하고, 성장하세요.</h2>
          <p>지원서를 제출하면 JD 매칭 분석과 구체적인 개선 가이드를 바로 확인할 수 있어요.</p>
        </div>
        <div className="banner-step">
          <span>01 지원</span>
          <ArrowRight size={16} />
          <span>02 발견</span>
          <ArrowRight size={16} />
          <span>03 성장</span>
        </div>
      </div>
      <div className="section-heading">
        <h2>
          열려 있는 기회 <span>{jobs.length}</span>
        </h2>
        <label className="search-field">
          <Search size={16} />
          <input
            aria-label="채용공고 검색"
            placeholder="직무 또는 회사 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      {jobs.length ? (
        <div className="job-card-grid">
          {jobs.map((j, i) => (
            <JobCard job={j} index={i} key={j.id} />
          ))}
        </div>
      ) : (
        <EmptyState title="검색 결과가 없습니다" onReset={() => setSearch('')} />
      )}
      <p className="muted text-xs mt-6">모든 채용공고는 서비스 체험을 위한 예시입니다.</p>
    </>
  );
}
export function JobDetail({ jobId }: { jobId: string }) {
  const { db } = useStore();
  const job = db.jobs.find((j) => j.id === jobId);
  if (!job) return <EmptyState title="공고를 찾을 수 없습니다" href="/jobs" />;
  const criteria = db.criteria.filter((c) => c.jobId === jobId);
  return (
    <>
      <Link href="/jobs" className="back-link">
        <ArrowLeft size={14} />
        채용공고 탐색
      </Link>
      <div className="page-heading">
        <div>
          <p className="job-company !mt-0">{job.companyName}</p>
          <h1>{job.title}</h1>
          <p>
            {job.location} · {job.employmentType} · 경력 {job.minExperience}년 이상 권장
          </p>
        </div>
        <span className="hiring-badge">
          <span />
          채용 중
        </span>
      </div>
      <div className="job-detail-layout">
        <div className="panel job-description">
          <h2>이런 동료를 기다려요.</h2>
          <p>{job.description}</p>
          <section>
            <h2>어떤 경험을 살펴보나요?</h2>
            <p className="muted !whitespace-normal">
              공고와 연결되는 경험을 구체적으로 작성해 주세요. 직접 수행한 역할과 결과가 좋은 근거가
              됩니다.
            </p>
            {categories.map((cat) => {
              const list = criteria.filter((c) => c.category === cat);
              return list.length ? (
                <div className="public-criteria" key={cat}>
                  <h3>{cat}</h3>
                  <div>
                    {list.map((c) => (
                      <span key={c.id}>
                        <Check size={12} />
                        {c.name}
                        {c.required && <small>필수</small>}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null;
            })}
          </section>
        </div>
        <aside className="job-apply-aside">
          <div className="panel">
            <div className="eyebrow">YOUR NEXT OPPORTUNITY</div>
            <h2>
              나의 경험은
              <br />
              얼마나 연결될까요?
            </h2>
            <p>
              저장한 지원서 버전을 선택하면 매칭 점수와
              <br />
              다음 성장 방향을 확인할 수 있어요.
            </p>
            <ul>
              <li>
                <Check size={15} />
                JD 기반 매칭 분석
              </li>
              <li>
                <Check size={15} />
                지원서 근거로 확인하는 강점
              </li>
              <li>
                <Check size={15} />
                바로 실천하는 개선 가이드
              </li>
            </ul>
            <Button asChild className="w-full">
              <Link href={`/jobs/${jobId}/apply`}>
                지원하고 분석받기
                <ArrowRight size={16} />
              </Link>
            </Button>
            <Link className="text-link mt-4" href="/resumes">
              내 지원서 버전 관리
              <ArrowRight size={14} />
            </Link>
            <small>
              {db.resumes.length
                ? `선택 가능한 지원서 ${db.resumes.length}개`
                : '새 지원서를 작성하고 저장할 수도 있어요.'}
            </small>
          </div>
          <div className="info-box mt-4">
            데모 지원서는 이 브라우저에만 저장되며 실제 기업에 전송되지 않습니다.
          </div>
        </aside>
      </div>
    </>
  );
}
