'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleCheck,
  FilePenLine,
  Flag,
  Sparkles,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { categories } from '@/types';
import {
  MatchScore,
  CriterionProgress,
  EvidenceCard,
  RequirementChecklist,
} from '@/components/evaluation/score';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
import { ActionCard, ImprovementRoadmap, NoGaps } from './actions';
export function ApplicationResult({
  applicationId,
  improvement = false,
}: {
  applicationId: string;
  improvement?: boolean;
}) {
  const { db } = useStore();
  const params = useSearchParams();
  const app = db.applications.find((a) => a.id === applicationId);
  const candidate = db.candidates.find((c) => c.id === app?.candidateId);
  const job = db.jobs.find((j) => j.id === app?.jobId);
  const evaluation = db.evaluations.find((e) => e.applicationId === applicationId);
  if (!app || !job || !evaluation || !candidate)
    return (
      <EmptyState
        title="분석 결과를 찾을 수 없습니다"
        description="이 브라우저에서 지원서를 제출한 뒤 결과를 확인해 주세요."
        href="/jobs"
        label="채용공고 탐색"
      />
    );
  const criteria = db.criteria.filter((c) => c.jobId === job.id);
  const strengths = evaluation.items.filter((i) => i.score / i.maxScore >= 0.85).slice(0, 3);
  const done = evaluation.actions.filter((a) => db.completedActionIds.includes(a.id)).length;
  return (
    <div className="applicant-result">
      <Link
        className="back-link"
        href={improvement ? `/applications/${applicationId}` : '/applications'}
      >
        <ArrowLeft size={14} />
        {improvement ? '매칭 분석 결과' : '내 지원 현황'}
      </Link>
      {(params.has('submitted') || params.has('updated')) && !improvement && (
        <div className="success-banner" role="status">
          <CircleCheck size={17} />
          {params.has('updated')
            ? '지원서가 저장되었고 새 내용으로 다시 분석했어요.'
            : '지원이 완료되었어요. 당신의 경험과 연결되는 기회를 살펴보세요.'}
        </div>
      )}
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            {improvement ? 'SMALL STEPS, NEXT OPPORTUNITY' : 'YOUR NEXT CHAPTER'}
          </div>
          <h1>
            {improvement
              ? '오늘의 한 걸음, 내일의 가능성.'
              : `${candidate.name}님의 경험을 연결했어요.`}
          </h1>
          <p>
            {job.companyName} · {job.title}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/applications/${applicationId}/edit`}>
            <FilePenLine size={15} />
            지원서 보강하기
          </Link>
        </Button>
      </div>
      {app.resumeSource && (
        <div className="resume-submission-label">
          <FilePenLine size={15} />
          <span>
            제출한 버전: <strong>{app.resumeSource.title}</strong> · v{app.resumeSource.revision}
          </span>
          <small>제출 당시 내용으로 분석</small>
        </div>
      )}
      {db.ownApplicationIds.includes(applicationId) && !improvement && (
        <Link className="text-link mb-4" href={`/resumes/new?applicationId=${applicationId}`}>
          이 지원서로 새 버전 만들기
          <ArrowRight size={14} />
        </Link>
      )}
      <nav className="result-tabs">
        <Link className={!improvement ? 'active' : ''} href={`/applications/${applicationId}`}>
          <Sparkles size={16} />
          매칭 분석
        </Link>
        <Link
          className={improvement ? 'active' : ''}
          href={`/applications/${applicationId}/improvement`}
        >
          <Flag size={16} />
          나의 다음 단계<span>{evaluation.actions.length}</span>
        </Link>
      </nav>
      {improvement ? (
        <>
          <div className="roadmap-header">
            <div>
              <h2>Your next steps</h2>
              <p>
                효과가 큰 항목부터 시작해 보세요. 작고 구체적인 실천이 다음 지원의 근거가 됩니다.
              </p>
            </div>
            <div className="roadmap-completion">
              <strong>
                {done}
                <small> / {evaluation.actions.length}</small>
              </strong>
              <span>실천 완료</span>
            </div>
          </div>
          <div className="roadmap-progress">
            <div
              style={{
                width: `${evaluation.actions.length ? (done / evaluation.actions.length) * 100 : 100}%`,
              }}
            />
          </div>
          {evaluation.actions.length ? (
            <ImprovementRoadmap actions={evaluation.actions} applicationId={applicationId} />
          ) : (
            <NoGaps />
          )}
          <div className="info-box mt-6">
            우선순위와 예상 증가 점수는 현재 지원서에서 보완할 수 있는 근거를 기준으로 한 데모
            추정치입니다. 실제 점수 상승을 보장하지 않으며 항목 간 영향이 겹칠 수 있습니다. 완료
            체크는 실천 기록이며 점수에 직접 반영되지 않습니다.
          </div>
          <div className="bottom-cta">
            <div>
              <h3>새로운 경험을 만들었다면</h3>
              <p>지원서에 반영하고 달라진 매칭 결과를 확인하세요.</p>
            </div>
            <Button asChild>
              <Link href={`/applications/${applicationId}/edit`}>
                지원서 수정 및 재분석
                <ArrowRight size={16} />
              </Link>
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="applicant-score-panel">
            <div className="applicant-score-main">
              <span className="eyebrow">YOUR JD MATCH</span>
              <MatchScore score={evaluation.totalScore} />
              <p>
                점수는 현재 지원서와 공고의 연결 정도예요.
                <br />
                당신의 가능성 전체를 의미하지 않아요.
              </p>
            </div>
            <div className="category-scores">
              <h2>경험이 어떻게 연결되었나요?</h2>
              {categories
                .filter((cat) => criteria.some((c) => c.category === cat))
                .map((cat) => (
                  <CriterionProgress key={cat} label={cat} value={evaluation.categoryScores[cat]} />
                ))}
              <small>지원서에서 확인된 근거를 바탕으로 분석했어요.</small>
            </div>
          </div>
          <section className="result-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">STRONG POINTS</span>
                <h2>이미 잘하고 있는 부분</h2>
              </div>
              <span className="positive-label">
                <Check size={14} />
                근거로 확인했어요
              </span>
            </div>
            {strengths.length ? (
              <div className="evidence-grid">
                {strengths.map((item) => (
                  <EvidenceCard
                    key={item.id}
                    name={criteria.find((c) => c.id === item.criterionId)!.name}
                    evidence={item.evidence}
                    reason="직접 수행한 경험이 JD와 높은 수준으로 연결됩니다."
                  />
                ))}
              </div>
            ) : (
              <div className="info-box">
                관련 기술과 학습 경험은 좋은 시작이에요. 아래 가이드에 따라 직접 수행한 과정과
                결과를 추가하면 강점을 더 잘 보여줄 수 있습니다.
              </div>
            )}
          </section>
          <section className="result-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">ROOM TO GROW</span>
                <h2>다음 기회를 위한 성장 포인트</h2>
              </div>
              <Link className="text-link" href={`/applications/${applicationId}/improvement`}>
                전체 {evaluation.actions.length}개 보기
                <ArrowRight size={15} />
              </Link>
            </div>
            <p className="section-description">
              무엇이 부족한지보다, 지금 무엇을 할 수 있는지에 집중해 보세요.
            </p>
            {evaluation.actions.length ? (
              <div className="action-preview">
                {evaluation.actions.slice(0, 3).map((a) => (
                  <ActionCard key={a.id} action={a} applicationId={applicationId} compact />
                ))}
              </div>
            ) : (
              <NoGaps />
            )}
          </section>
          <details className="public-requirements">
            <summary>
              지원 자격 충족도 자세히 보기 <span>+</span>
            </summary>
            <RequirementChecklist
              criteria={criteria}
              evaluation={evaluation}
              experience={app.experience}
              minExperience={job.minExperience}
            />
          </details>
          <section className="result-section">
            <div className="section-heading">
              <h2>역량별 분석 근거</h2>
              <span className="muted text-xs">항목을 눌러 확인하세요</span>
            </div>
            <div className="public-item-list">
              {evaluation.items.map((item) => {
                const c = criteria.find((c) => c.id === item.criterionId)!;
                return (
                  <details key={item.id}>
                    <summary>
                      <span>{c.name}</span>
                      <span className={`level-badge ${item.level.toLowerCase()}`}>
                        {item.level === 'Unverified' ? '근거 보완' : item.level}
                      </span>
                      <span>+</span>
                    </summary>
                    <div>
                      <p>{item.reason}</p>
                      {item.evidence && <blockquote>“{item.evidence}”</blockquote>}
                    </div>
                  </details>
                );
              })}
            </div>
          </section>
          <div className="bottom-cta">
            <div>
              <h3>다음 지원을 더 자신 있게.</h3>
              <p>나에게 필요한 액션부터 하나씩 시작해 보세요.</p>
            </div>
            <Button asChild>
              <Link href={`/applications/${applicationId}/improvement`}>
                나의 개선 계획 보기
                <ArrowRight size={16} />
              </Link>
            </Button>
          </div>
          <p className="evaluation-footnote">
            <Sparkles size={15} />
            키워드 기반 데모 분석입니다. 실제 채용 결과가 아니며 기업의 내부 배점은 표시하지
            않습니다.
          </p>
        </>
      )}
    </div>
  );
}
export function ApplicationsList() {
  const { db } = useStore();
  const mine = db.applications
    .filter((a) => db.ownApplicationIds.includes(a.id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">MY APPLICATIONS</div>
          <h1>기회로 이어지는 나의 경험.</h1>
          <p>지원 현황을 확인하고 다음 단계를 준비하세요.</p>
        </div>
        <Button asChild>
          <Link href="/jobs">
            채용공고 탐색
            <ArrowRight size={16} />
          </Link>
        </Button>
      </div>
      {mine.length ? (
        <div className="my-applications">
          {mine.map((a) => {
            const j = db.jobs.find((j) => j.id === a.jobId)!;
            const e = db.evaluations.find((e) => e.applicationId === a.id)!;
            return (
              <Link key={a.id} href={`/applications/${a.id}`}>
                <div>
                  <span className="job-company">{j.companyName}</span>
                  <h2>{j.title}</h2>
                  <p className="muted text-sm mt-2">지원 완료 · 매칭 분석 완료</p>
                  <p className="resume-history-label">
                    {a.resumeSource
                      ? `${a.resumeSource.title} · v${a.resumeSource.revision}`
                      : '직접 작성한 지원서'}{' '}
                    · {new Date(a.createdAt).toLocaleDateString('ko-KR')}
                  </p>
                </div>
                <MatchScore score={e.totalScore} compact />
                <ArrowRight size={20} />
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="첫 번째 기회를 만나보세요"
          description="아직 작성한 지원서가 없습니다. 예시를 채우면 빠르게 전체 흐름을 체험할 수 있어요."
          href="/jobs/backend/apply"
          label="예시 지원서로 시작하기"
        />
      )}
      <div className="demo-result-link">
        <Sparkles size={18} />
        <div>
          <strong>먼저 결과를 둘러보고 싶다면</strong>
          <p>샘플 지원자의 매칭 분석과 개선 가이드를 확인해 보세요.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/applications/application-4">
            샘플 결과 보기
            <ArrowRight size={14} />
          </Link>
        </Button>
      </div>
    </>
  );
}
