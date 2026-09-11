'use client';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCheck, FileText, Sparkles } from 'lucide-react';
import { useStore } from '@/lib/store';
import { reviewLabels, type ReviewStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
import { MatchScore, RequirementChecklist } from '@/components/evaluation/score';
import { EvaluationTable } from '@/components/evaluation/evaluation-table';
import { rowSignals } from '@/lib/candidates';
import { formatDate } from '@/lib/utils';
export function CandidateDetail({ jobId, candidateId }: { jobId: string; candidateId: string }) {
  const { db, setStatus } = useStore();
  const job = db.jobs.find((j) => j.id === jobId);
  const candidate = db.candidates.find((c) => c.id === candidateId);
  const application = db.applications.find(
    (a) => a.jobId === jobId && a.candidateId === candidateId,
  );
  const evaluation = db.evaluations.find((e) => e.applicationId === application?.id);
  if (!job || !candidate || !application || !evaluation)
    return <EmptyState title="지원자 평가를 찾을 수 없습니다" href="/recruiter/jobs" />;
  const criteria = db.criteria.filter((c) => c.jobId === jobId);
  const { strong, gaps } = rowSignals({ candidate, application, evaluation }, criteria);
  const peers = db.applications.filter((a) => a.jobId === jobId);
  const next = peers[(peers.findIndex((a) => a.id === application.id) + 1) % peers.length];
  return (
    <>
      <Link href={`/recruiter/jobs/${jobId}/candidates`} className="back-link">
        <ArrowLeft size={14} />
        {job.title} · 지원자 목록
      </Link>
      <div className="page-heading">
        <div className="flex items-center gap-4">
          <span className="candidate-avatar avatar-0 detail-avatar">{candidate.name.slice(1)}</span>
          <div>
            <h1>
              {candidate.name}
              <span className="heading-tag">지원자 평가</span>
            </h1>
            <p>
              경력 {application.experience}년 · {formatDate(application.createdAt)} 지원
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="form-select"
            aria-label="검토 상태"
            value={application.status}
            onChange={(e) => setStatus(application.id, e.target.value as ReviewStatus)}
          >
            {Object.entries(reviewLabels).map(([v, l]) => (
              <option value={v} key={v}>
                {l}
              </option>
            ))}
          </select>
          {application.status === 'NEW' && (
            <Button onClick={() => setStatus(application.id, 'REVIEWED')}>
              <CheckCheck size={16} />
              검토 완료
            </Button>
          )}
        </div>
      </div>
      <div className="detail-score-panel">
        <MatchScore score={evaluation.totalScore} />
        <div>
          <span className="eyebrow">
            <Sparkles size={13} />
            EVALUATION SUMMARY
          </span>
          <h2>{evaluation.recommendation}</h2>
          <p>{evaluation.summary}</p>
          <small>추천은 검토 보조 정보입니다. 실제 채용 결정은 담당자가 진행합니다.</small>
        </div>
      </div>
      <div className="detail-layout">
        <div>
          <div className="section-heading">
            <h2>JD 평가표</h2>
            <span className="muted text-xs">배점 합계 100점 · 내부 평가 기준</span>
          </div>
          <EvaluationTable criteria={criteria} evaluation={evaluation} />
          <details className="resume-disclosure">
            <summary>
              <FileText size={18} />
              <strong>지원서 보기</strong>
              <span>원문 펼치기 +</span>
            </summary>
            <div className="resume-content">
              <p className="muted">{candidate.email}</p>
              {[
                { label: '기술 스택', value: application.skills },
                { label: '프로젝트 경험', value: application.projects },
                { label: '자기소개', value: application.introduction },
                { label: '지원동기', value: application.motivation },
                { label: '협업 경험', value: application.collaboration },
                { label: '추가 경험', value: application.additionalExperience || '작성하지 않음' },
              ].map((f) => (
                <section key={f.label}>
                  <h3>{f.label}</h3>
                  <p>{f.value}</p>
                </section>
              ))}
            </div>
          </details>
        </div>
        <aside className="detail-aside">
          <section>
            <h2>필수조건 확인</h2>
            <RequirementChecklist
              criteria={criteria}
              evaluation={evaluation}
              experience={application.experience}
              minExperience={job.minExperience}
            />
          </section>
          <section>
            <h2>
              주요 강점 <span className="positive-label">Strengths</span>
            </h2>
            {strong.length ? (
              strong.slice(0, 3).map((s) => (
                <p className="signal-line" key={s}>
                  <CheckCheck size={15} />
                  {s}
                </p>
              ))
            ) : (
              <p className="muted text-sm">구체적인 수행 근거를 추가로 확인해 주세요.</p>
            )}
          </section>
          <section>
            <h2>
              확인할 부분 <span className="warning-label">Check points</span>
            </h2>
            {gaps.slice(0, 3).map((s) => (
              <div className="gap-line" key={s}>
                <strong>{s}</strong>
                <p>직접 수행한 경험의 근거 확인이 필요합니다.</p>
              </div>
            ))}
            {application.experience < job.minExperience && gaps.length < 3 && (
              <div className="gap-line">
                <strong>경력 기간 추가 확인</strong>
                <p>
                  권장 {job.minExperience}년 · 지원자 {application.experience}년
                </p>
              </div>
            )}
            {!gaps.length && application.experience >= job.minExperience && (
              <p className="muted text-sm">주요 확인사항이 없습니다.</p>
            )}
          </section>
        </aside>
      </div>
      {peers.length > 1 && (
        <div className="detail-next">
          <span>지원서를 다시 찾지 않아도 괜찮아요.</span>
          <Button asChild variant="outline">
            <Link href={`/recruiter/jobs/${jobId}/candidates/${next.candidateId}`}>
              다음 지원자 확인
              <ArrowRight size={16} />
            </Link>
          </Button>
        </div>
      )}
    </>
  );
}
