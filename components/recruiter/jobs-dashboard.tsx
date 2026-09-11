'use client';
import Link from 'next/link';
import {
  ArrowDownRight,
  ArrowRight,
  BriefcaseBusiness,
  CheckCheck,
  Plus,
  Sparkles,
  Users,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
export function JobsDashboard() {
  const { db } = useStore();
  const reviewed = db.applications.filter((a) => a.status !== 'NEW').length;
  const avg = Math.round(
    db.evaluations.reduce((s, e) => s + e.totalScore, 0) / (db.evaluations.length || 1),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">HIRING OVERVIEW</div>
          <h1>좋은 채용의 시작, 한눈에.</h1>
          <p>지원서를 읽기 전에, 가능성부터 확인하세요.</p>
        </div>
        <Button asChild>
          <Link href="/recruiter/jobs/new">
            <Plus size={17} />새 채용공고
          </Link>
        </Button>
      </div>
      <div className="overview-banner">
        <div>
          <span className="banner-icon">
            <Sparkles size={23} />
          </span>
          <div>
            <h2>지원자의 가능성에 더 가까이.</h2>
            <p>동일한 JD 기준과 지원서 근거로, 더 빠르고 명확하게 검토하세요.</p>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href="/recruiter/jobs/backend/candidates">
            지원자 살펴보기
            <ArrowRight size={16} />
          </Link>
        </Button>
        <div className="banner-decoration">
          <span />
          <span />
          <span />
        </div>
      </div>
      <div className="stats-grid dashboard-stats">
        {[
          {
            label: '진행 중인 채용',
            value: db.jobs.length,
            unit: '개',
            icon: BriefcaseBusiness,
            note: '좋은 동료를 찾고 있어요',
          },
          {
            label: '전체 지원자',
            value: db.applications.length,
            unit: '명',
            icon: Users,
            note: '모든 지원서 평가 완료',
          },
          {
            label: '평균 Match Score',
            value: avg,
            unit: '/ 100',
            icon: Sparkles,
            note: '지원서와 JD의 연결 정도',
          },
          {
            label: '검토 완료',
            value: reviewed,
            unit: `/ ${db.applications.length}`,
            icon: CheckCheck,
            note: `${db.applications.length - reviewed}명의 지원자가 검토를 기다려요`,
          },
        ].map((s) => (
          <div className="stat-block" key={s.label}>
            <div className="stat-label">
              {s.label}
              <s.icon size={17} />
            </div>
            <div className="stat-value">
              {s.value}
              <small>{s.unit}</small>
            </div>
            <p>{s.note}</p>
          </div>
        ))}
      </div>
      <div className="section-heading">
        <h2>
          채용공고 <span>{db.jobs.length}</span>
        </h2>
        <span className="muted text-xs">최근 등록순</span>
      </div>
      <div className="jobs-table-wrap">
        <table className="jobs-table">
          <thead>
            <tr>
              <th>채용공고</th>
              <th>지원자</th>
              <th>평균 Match</th>
              <th>검토 완료</th>
              <th>등록일</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {db.jobs.map((job, index) => {
              const apps = db.applications.filter((a) => a.jobId === job.id);
              const evals = db.evaluations.filter((e) =>
                apps.some((a) => a.id === e.applicationId),
              );
              const count = apps.filter((a) => a.status !== 'NEW').length;
              return (
                <tr key={job.id}>
                  <td>
                    <Link className="job-identity" href={`/recruiter/jobs/${job.id}/candidates`}>
                      <span className={`job-icon job-icon-${index % 3}`}>
                        <BriefcaseBusiness size={21} />
                      </span>
                      <span>
                        <strong>{job.title}</strong>
                        <small>
                          {job.role} <span>·</span> {job.employmentType}
                        </small>
                      </span>
                    </Link>
                  </td>
                  <td>
                    <strong>{apps.length}</strong>
                    <small> 명</small>
                  </td>
                  <td>
                    <span className="job-average">
                      {evals.length
                        ? Math.round(evals.reduce((s, e) => s + e.totalScore, 0) / evals.length)
                        : '—'}
                    </span>
                    <small> / 100</small>
                  </td>
                  <td>
                    <div className="review-progress">
                      <span>
                        {count}
                        <small> / {apps.length}</small>
                      </span>
                      <div className="progress-track">
                        <span
                          style={{ width: `${apps.length ? (count / apps.length) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="muted text-xs">{formatDate(job.createdAt)}</td>
                  <td>
                    <Link href={`/recruiter/jobs/${job.id}/candidates`} className="table-link">
                      지원자 보기
                      <ArrowRight size={15} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="insight-note">
        <span>
          <ArrowDownRight size={19} />
        </span>
        <p>
          <strong>점수는 대화의 시작입니다.</strong> 지원서에서 확인된 경험과 근거를 함께
          살펴보세요. 점수만으로 합격이나 탈락을 결정하지 않습니다.
        </p>
      </div>
    </>
  );
}
