'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowRight,
  Check,
  ChevronDown,
  CircleDashed,
  GitCompareArrows,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { MatchScore, CriterionProgress } from '@/components/evaluation/score';
import { Button } from '@/components/ui/button';
import { CandidateComparison } from './candidate-comparison';
import { rowSignals } from '@/lib/candidates';
import { EmptyState } from '@/components/ui/states';
import { formatDate } from '@/lib/utils';
import { reviewLabels, type CandidateRow, type ReviewStatus } from '@/types';
export function CandidateTable({ jobId }: { jobId: string }) {
  const { db, setStatus } = useStore();
  const [search, setSearch] = useState('');
  const [score, setScore] = useState('all');
  const [required, setRequired] = useState('all');
  const [stack, setStack] = useState('all');
  const [experience, setExperience] = useState('all');
  const [status, setFilterStatus] = useState('all');
  const [sort, setSort] = useState('score');
  const [selected, setSelected] = useState<string[]>([]);
  const [compare, setCompare] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [tab, setTab] = useState('all');
  const criteria = db.criteria.filter((c) => c.jobId === jobId);
  const rows: CandidateRow[] = db.applications
    .filter((a) => a.jobId === jobId)
    .map((application) => ({
      application,
      candidate: db.candidates.find((c) => c.id === application.candidateId)!,
      evaluation: db.evaluations.find((e) => e.applicationId === application.id)!,
    }));
  const stacks = Array.from(
    new Set(rows.flatMap((r) => r.application.skills.split(',').map((s) => s.trim()))),
  ).sort();
  const filtered = rows
    .filter(
      (r) =>
        (!search ||
          `${r.candidate.name} ${r.application.skills}`
            .toLowerCase()
            .includes(search.toLowerCase())) &&
        (score === 'all' ||
          (score === '85'
            ? r.evaluation.totalScore >= 85
            : score === '70'
              ? r.evaluation.totalScore >= 70
              : score === '50'
                ? r.evaluation.totalScore >= 50 && r.evaluation.totalScore < 70
                : r.evaluation.totalScore < 50)) &&
        (required === 'all' || r.evaluation.requiredMet === (required === 'yes')) &&
        (stack === 'all' ||
          r.application.skills
            .split(',')
            .map((s) => s.trim())
            .includes(stack)) &&
        (experience === 'all' ||
          (experience === 'junior'
            ? r.application.experience < 1
            : experience === 'mid'
              ? r.application.experience >= 1 && r.application.experience < 3
              : r.application.experience >= 3)) &&
        (status === 'all' || r.application.status === status) &&
        (tab === 'all' || r.application.status === tab),
    )
    .sort((a, b) =>
      sort === 'score'
        ? b.evaluation.totalScore - a.evaluation.totalScore
        : sort === 'date'
          ? b.application.createdAt.localeCompare(a.application.createdAt)
          : a.candidate.name.localeCompare(b.candidate.name, 'ko'),
    );
  const chosen = rows.filter((r) => selected.includes(r.application.id));
  const filterCount = [score, required, stack, experience, status].filter(
    (v) => v !== 'all',
  ).length;
  function reset() {
    setSearch('');
    setScore('all');
    setRequired('all');
    setStack('all');
    setExperience('all');
    setFilterStatus('all');
    setTab('all');
  }
  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((s) => s !== id)
        : current.length < 3
          ? [...current, id]
          : current,
    );
  }
  return (
    <>
      <div className="list-tabs">
        {[
          { id: 'all', label: '전체 지원자', count: rows.length },
          {
            id: 'NEW',
            label: '검토 전',
            count: rows.filter((r) => r.application.status === 'NEW').length,
          },
          {
            id: 'SHORTLISTED',
            label: '면접 검토',
            count: rows.filter((r) => r.application.status === 'SHORTLISTED').length,
          },
        ].map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
            <span>{t.count}</span>
          </button>
        ))}
      </div>
      <div className="table-toolbar">
        <label className="search-field">
          <Search size={17} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름 또는 기술 스택 검색"
            aria-label="지원자 검색"
          />
          {search && (
            <button onClick={() => setSearch('')} aria-label="검색 초기화">
              <X size={14} />
            </button>
          )}
        </label>
        <div className="toolbar-filters">
          <label className="select-wrap">
            <select
              aria-label="매칭 점수 필터"
              value={score}
              onChange={(e) => setScore(e.target.value)}
            >
              <option value="all">Match Score</option>
              <option value="85">85점 이상</option>
              <option value="70">70점 이상</option>
              <option value="50">50–69점</option>
              <option value="low">50점 미만</option>
            </select>
            <ChevronDown size={14} />
          </label>
          <label className="select-wrap">
            <select
              aria-label="필수조건 필터"
              value={required}
              onChange={(e) => setRequired(e.target.value)}
            >
              <option value="all">필수조건</option>
              <option value="yes">근거 충족</option>
              <option value="no">추가 확인</option>
            </select>
            <ChevronDown size={14} />
          </label>
          <Button
            variant={advanced ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setAdvanced(!advanced)}
            aria-expanded={advanced}
          >
            <SlidersHorizontal size={15} />
            필터{filterCount > 0 && <span className="filter-count">{filterCount}</span>}
          </Button>
        </div>
        <label className="sort-select">
          <ArrowDown size={14} />
          <select aria-label="지원자 정렬" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="score">Match 높은 순</option>
            <option value="date">최근 지원순</option>
            <option value="name">이름순</option>
          </select>
        </label>
      </div>
      {advanced && (
        <div className="advanced-filters">
          <label>
            기술 스택
            <select value={stack} onChange={(e) => setStack(e.target.value)}>
              <option value="all">전체 기술</option>
              {stacks.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            경력
            <select value={experience} onChange={(e) => setExperience(e.target.value)}>
              <option value="all">전체 경력</option>
              <option value="junior">1년 미만</option>
              <option value="mid">1–3년 미만</option>
              <option value="senior">3년 이상</option>
            </select>
          </label>
          <label>
            검토 상태
            <select value={status} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="all">전체 상태</option>
              {Object.entries(reviewLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <Button variant="ghost" size="sm" onClick={reset}>
            초기화
          </Button>
        </div>
      )}
      <div className="table-caption">
        <span>
          <strong>{filtered.length}</strong>명의 지원자 <span className="caption-separator">·</span>{' '}
          동일한 JD 기준으로 평가했어요
        </span>
        <span>최대 3명을 선택해 비교하세요</span>
      </div>
      {filtered.length ? (
        <>
          <div className="candidate-table-wrap">
            <table className="candidate-table">
              <thead>
                <tr>
                  <th className="check-cell">
                    <GitCompareArrows size={15} />
                  </th>
                  <th>지원자</th>
                  <th>
                    Match Score <ArrowDown size={12} />
                  </th>
                  <th>필수조건</th>
                  <th>기술 / 경험</th>
                  <th>주요 강점</th>
                  <th>확인할 부분</th>
                  <th>검토 상태</th>
                  <th>
                    <span className="sr-only">상세</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, index) => {
                  const { strong, gaps } = rowSignals(r, criteria);
                  return (
                    <tr
                      key={r.application.id}
                      className={selected.includes(r.application.id) ? 'row-selected' : ''}
                    >
                      <td className="check-cell">
                        <input
                          type="checkbox"
                          aria-label={`${r.candidate.name} 비교 선택`}
                          checked={selected.includes(r.application.id)}
                          disabled={selected.length >= 3 && !selected.includes(r.application.id)}
                          onChange={() => toggle(r.application.id)}
                        />
                      </td>
                      <td>
                        <Link
                          href={`/recruiter/jobs/${jobId}/candidates/${r.candidate.id}`}
                          className="candidate-identity"
                        >
                          <span className={`candidate-avatar avatar-${index % 5}`}>
                            {r.candidate.name.slice(1)}
                          </span>
                          <span>
                            <strong>{r.candidate.name}</strong>
                            <small>
                              {r.application.experience === 0
                                ? '신입'
                                : `경력 ${r.application.experience}년`}
                              <span>·</span>
                              {formatDate(r.application.createdAt).replace('2026. ', '')}
                            </small>
                          </span>
                        </Link>
                      </td>
                      <td>
                        <MatchScore score={r.evaluation.totalScore} compact />
                      </td>
                      <td>
                        <span
                          className={`requirement-badge ${r.evaluation.requiredMet ? 'met' : ''}`}
                        >
                          {r.evaluation.requiredMet ? (
                            <Check size={13} />
                          ) : (
                            <CircleDashed size={13} />
                          )}{' '}
                          {r.evaluation.requiredMet ? '충족' : '추가 확인'}
                        </span>
                      </td>
                      <td className="mini-progress-cell">
                        <CriterionProgress
                          label="기술"
                          value={r.evaluation.categoryScores['기술 역량']}
                          subtle
                        />
                        <CriterionProgress
                          label="경험"
                          value={r.evaluation.categoryScores['경험']}
                          subtle
                        />
                      </td>
                      <td>
                        <div className="strength-tags">
                          {strong.length ? (
                            strong.slice(0, 2).map((s) => <span key={s}>{s}</span>)
                          ) : (
                            <span className="muted">근거 확인 필요</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="risk-text">
                          {gaps.length ? (
                            <>
                              <span className="risk-dot" />
                              {gaps[0]}
                              <small>경험 근거 보완</small>
                            </>
                          ) : (
                            <span className="muted">주요 확인사항 없음</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <select
                          className={`status-select status-${r.application.status.toLowerCase()}`}
                          value={r.application.status}
                          aria-label={`${r.candidate.name} 검토 상태`}
                          onChange={(e) =>
                            setStatus(r.application.id, e.target.value as ReviewStatus)
                          }
                        >
                          {Object.entries(reviewLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <Link
                          href={`/recruiter/jobs/${jobId}/candidates/${r.candidate.id}`}
                          className="row-arrow"
                          aria-label={`${r.candidate.name} 평가 상세`}
                        >
                          <ArrowRight size={17} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mobile-candidates">
            {filtered.map((r) => {
              const { strong, gaps } = rowSignals(r, criteria);
              return (
                <article key={r.application.id}>
                  <div className="flex justify-between gap-4">
                    <div>
                      <Link
                        href={`/recruiter/jobs/${jobId}/candidates/${r.candidate.id}`}
                        className="font-semibold"
                      >
                        {r.candidate.name} <ArrowRight size={14} className="inline" />
                      </Link>
                      <p className="muted text-xs mt-1">
                        경력 {r.application.experience}년 · {reviewLabels[r.application.status]}
                      </p>
                    </div>
                    <MatchScore score={r.evaluation.totalScore} compact />
                  </div>
                  <p className="mt-4 text-sm">
                    {r.evaluation.requiredMet ? '✓ 필수조건 충족' : '◌ 필수조건 추가 확인'}
                  </p>
                  <p className="muted text-xs mt-2">
                    강점 {strong.slice(0, 2).join(' · ') || '추가 확인'}
                    <br />
                    확인 {gaps.slice(0, 2).join(' · ') || '주요 확인사항 없음'}
                  </p>
                  <label className="mobile-compare">
                    <input
                      type="checkbox"
                      checked={selected.includes(r.application.id)}
                      disabled={selected.length >= 3 && !selected.includes(r.application.id)}
                      onChange={() => toggle(r.application.id)}
                    />
                    비교에 추가
                  </label>
                </article>
              );
            })}
          </div>
          <div className="table-bottom">
            <span>
              전체 {rows.length}명 중 {filtered.length}명 표시
            </span>
            <span>
              <span className="tiny-green-dot" />
              평가 완료 · 지원서 근거 기반
            </span>
          </div>
        </>
      ) : (
        <EmptyState
          title={rows.length ? '조건에 맞는 지원자가 없습니다' : '아직 지원자가 없습니다'}
          description={
            rows.length
              ? '검색어나 필터를 조정해 보세요.'
              : '공고를 확인하고 첫 번째 데모 지원서를 작성해 보세요.'
          }
          onReset={rows.length ? reset : undefined}
          href={rows.length ? undefined : `/jobs/${jobId}`}
          label="공고 확인하기"
        />
      )}
      {selected.length > 0 && (
        <div className="compare-bar">
          <span>
            <strong>{selected.length}명</strong> 선택됨
          </span>
          <span className="compare-names">{chosen.map((r) => r.candidate.name).join(' · ')}</span>
          <Button size="sm" disabled={selected.length < 2} onClick={() => setCompare(true)}>
            <GitCompareArrows size={16} />
            지원자 비교
          </Button>
          <button onClick={() => setSelected([])} aria-label="선택 해제">
            <X size={17} />
          </button>
        </div>
      )}
      <CandidateComparison
        open={compare}
        onOpenChange={setCompare}
        chosen={chosen}
        criteria={criteria}
        jobId={jobId}
      />
    </>
  );
}
