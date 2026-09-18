'use client';
import { getJobProfile } from '@/lib/evaluation/job-profiles';
import { fitSummary, sortAnalyses } from '@/lib/projects/fit';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, FilePlus2, FileText, Search, Copy, History } from 'lucide-react';
import { useProjects } from '@/lib/projects/store';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/states';
import { MatchScore } from '@/components/evaluation/score';
import { InterviewPanel } from './interview';
import { packetKey, stageNames } from '@/lib/interview/domain';
import type {
  AnalysisProject,
  ProjectAnalysis,
  ProjectResult,
  ProjectRevision,
} from '@/lib/projects/types';
const statusNames = {
  confirmed: '확인',
  review: '추가 확인',
  missing: '근거 없음',
  unreadable: '판독 불가',
};
function highlight(text: string, keywords: string[]) {
  const escaped = keywords.filter(Boolean).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!escaped.length) return text;
  const regexp = new RegExp(`(${escaped.join('|')})`, 'ig');
  return text.split(regexp).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
}
export function ProjectResults({
  projectId,
  role,
}: {
  projectId: string;
  role: 'recruiter' | 'applicant';
}) {
  const { actor, projects } = useProjects();
  const project = projects.find((p) => p.id === projectId);
  if (!actor || !project || actor.role !== role || project.role !== role)
    return (
      <EmptyState
        title="프로젝트에 접근할 수 없습니다"
        description="이메일 인증한 계정과 현재 이용 유형에 속한 프로젝트만 열 수 있습니다. 프로젝트 데이터는 생성한 브라우저에 저장됩니다."
        href={actor ? '/home' : '/login'}
        label={actor ? '내 홈으로' : '로그인'}
      />
    );
  return <ProjectResultContent key={project.id} project={project} />;
}
function ProjectResultContent({ project }: { project: AnalysisProject }) {
  const [revisionId, setRevisionId] = useState(project.revisions.at(-1)!.id);
  const revision = project.revisions.find((r) => r.id === revisionId) ?? project.revisions.at(-1)!;
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [order, setOrder] = useState('balanced');
  const [tab, setTab] = useState<'analysis' | 'interview'>('analysis');
  const recruiter = project.role === 'recruiter';
  const chosen = revision.analyses.find((a) => a.id === selected);
  const sorted = sortAnalyses(revision.analyses, project.criteria, order);
  return (
    <div className="project-result">
      <Link href="/home" className="back-link">
        <ArrowLeft size={15} />홈
      </Link>
      <div className="project-page-heading">
        <div>
          <span className="eyebrow">
            {recruiter ? 'CANDIDATE DOCUMENT SUMMARY' : 'YOUR DOCUMENT ANALYSIS'}
          </span>
          <h1>{project.title}</h1>
          <p>
            {recruiter
              ? '지원자의 경험을 같은 기준으로 빠르게 확인하세요.'
              : '서류에서 확인한 근거와 다음에 보완할 내용을 살펴보세요.'}
          </p>
        </div>
        <label className="project-version">
          <History size={16} />
          <select
            aria-label="분석 버전"
            value={revision.id}
            onChange={(e) => {
              setRevisionId(e.target.value);
              setSelected(null);
            }}
          >
            {[...project.revisions].reverse().map((r) => (
              <option value={r.id} key={r.id}>
                v{r.number} · {new Date(r.createdAt).toLocaleString('ko-KR')}
                {r.id === project.revisions.at(-1)!.id ? ' · 최신' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
      <section className="project-jd-summary">
        <div>
          <FileText size={22} />
          <h2>JD 분석 핵심 키워드</h2>
          {project.jobProfile && (
            <small>분석 직무: {getJobProfile(project.jobProfile)?.name}</small>
          )}
          <small>
            JD v1 ·{' '}
            {project.jd.mode === 'text'
              ? '본문 입력'
              : project.jd.mode === 'image'
                ? project.jd.imageName
                : 'URL · 본문 확인'}
          </small>
        </div>
        <div className="project-keywords">
          {project.criteria.map((c) => (
            <span key={c.id}>{c.name}</span>
          ))}
        </div>
        <details>
          <summary>분석에 사용한 JD 보기</summary>
          {project.jd.mode === 'url' && <p>공고 주소: {project.jd.reference}</p>}
          <pre>{project.jd.text}</pre>
        </details>
      </section>
      {revision.status === 'partial' && (
        <div className="project-warning" role="status">
          <strong>일부 서류를 읽지 못했습니다.</strong>
          <p>성공한 서류의 결과를 보존했습니다. 읽지 못한 파일은 미기재로 판단하지 않습니다.</p>
          {revision.documents
            .filter((d) => d.status === 'failed' || d.unreadablePages?.length)
            .map((d) => (
              <p key={d.id}>
                {d.filename} · {d.error}
              </p>
            ))}
          <Link href={`/new-project?projectId=${project.id}`}>
            실패 파일 교체 후 다시 분석
            <ArrowRight size={14} />
          </Link>
        </div>
      )}
      <div className="project-section-heading">
        <h2>{recruiter ? `지원자 리스트 · ${revision.analyses.length}명` : '내 서류 분석 결과'}</h2>
        <Button asChild>
          <Link href={`/new-project?projectId=${project.id}`}>
            <FilePlus2 size={16} />
            {recruiter ? '지원자 서류 추가 등록' : '서류 수정 등록'}
          </Link>
        </Button>
      </div>
      {recruiter ? (
        <>
          <label className="project-search">
            <Search size={16} />
            <input
              placeholder="지원자 이름 검색"
              aria-label="지원자 이름 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="project-sort">
            지원자 정렬
            <select
              aria-label="지원자 정렬"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
            >
              <option value="balanced">균형순</option>
              <option value="score">종합점수순</option>
              <option value="recent">최근 등록순</option>
              {project.criteria.map((c) => (
                <option key={c.id} value={`criterion:${c.id}`}>
                  {c.name} 중심
                </option>
              ))}
            </select>
          </label>
          <p className="project-notice">
            균형순: 핵심 충족 수 → 전체 항목 충족률 → 총점. 충족률은 배점 크기와 관계없이 항목 수로
            계산합니다. 미기재·판독 불가는 추가 확인 대상이며 자동 탈락 기준이 아닙니다.
          </p>
          <div className="project-applicant-list">
            {sorted
              .filter((a) => a.name.includes(search))
              .map((a) => (
                <button
                  key={a.id}
                  className="project-applicant-row"
                  onClick={() => {
                    setSelected(a.id);
                    setTab('analysis');
                  }}
                  aria-haspopup="dialog"
                >
                  <span className="project-person-avatar" aria-hidden="true">
                    {a.name.slice(0, 1)}
                  </span>
                  <span>
                    <strong>{a.name}</strong>
                    <small>생년월일 {a.birthDate || '미기재'}</small>
                  </span>
                  <span className="project-row-summary">{a.summary}</span>
                  <span className="project-fit-row">
                    <FitMetrics project={project} analysis={a} />
                  </span>
                  <span className="project-row-status">
                    {(() => {
                      const packet = project.interviews?.find(
                        (p) => p.key === packetKey(revision.id, a.id),
                      );
                      return packet
                        ? stageNames[packet.stage]
                        : a.results.every((r) => r.status === 'unreadable')
                          ? '판독 불가'
                          : '요약 완료';
                    })()}
                  </span>
                  <ArrowRight size={16} />
                </button>
              ))}
          </div>
          {!sorted.some((a) => a.name.includes(search)) && (
            <p className="project-empty-search">
              일치하는 지원자가 없습니다.<button onClick={() => setSearch('')}>검색 초기화</button>
            </p>
          )}
          <Dialog
            open={Boolean(chosen)}
            onOpenChange={(open) => {
              if (!open) setSelected(null);
            }}
            title={`${chosen?.name ?? ''} · 지원자 서류 요약`}
            description={`생년월일 ${chosen?.birthDate || '미기재'} · 분석 v${revision.number}`}
            wide
          >
            {chosen && (
              <>
                <div className="project-table-filters" aria-label="지원자 상세 메뉴">
                  <button aria-pressed={tab === 'analysis'} onClick={() => setTab('analysis')}>
                    서류 분석
                  </button>
                  <button aria-pressed={tab === 'interview'} onClick={() => setTab('interview')}>
                    면접 준비
                  </button>
                </div>
                {tab === 'interview' ? (
                  <InterviewPanel
                    key={`${revision.id}:${chosen.id}`}
                    project={project}
                    revision={revision}
                    analysis={chosen}
                  />
                ) : (
                  <>
                    <ProjectAnalysisTable project={project} revision={revision} analysis={chosen} />
                    <section className="project-one-line">
                      <h3>지원자 서류 한 줄 요약</h3>
                      <p>{chosen.summary}</p>
                    </section>
                    <Button onClick={() => setTab('interview')}>면접 준비 열기</Button>
                  </>
                )}
              </>
            )}
          </Dialog>
        </>
      ) : revision.analyses[0] ? (
        <>
          <InterviewPanel
            key={`${revision.id}:${revision.analyses[0].id}`}
            project={project}
            revision={revision}
            analysis={revision.analyses[0]}
          />
          <div className="project-analysis-score">
            <MatchScore score={revision.analyses[0].score} compact />
            <p>{revision.analyses[0].summary}</p>
          </div>
          <ProjectAnalysisTable
            project={project}
            revision={revision}
            analysis={revision.analyses[0]}
          />
        </>
      ) : (
        <EmptyState
          title="분석 가능한 서류가 없습니다"
          href={`/new-project?projectId=${project.id}`}
          label="서류 등록"
        />
      )}
      <p className="project-footnote">
        {recruiter
          ? '연관 O는 직접 키워드 또는 등록된 연관 기술의 언급이 있다는 뜻입니다. 실제 숙련도나 합격 여부를 뜻하지 않습니다. 기존 분석은 당시 규칙을 유지하며, 다시 분석하면 현재 서버 규칙이 적용됩니다.'
          : '규칙 기반 데모입니다. 기재 O / X는 서류에 해당 내용이 있는지를 뜻하며, 능력이나 합격 여부를 의미하지 않습니다.'}
      </p>
    </div>
  );
}
function FitMetrics({
  project,
  analysis,
}: {
  project: AnalysisProject;
  analysis: ProjectAnalysis;
}) {
  const fit = fitSummary(project.criteria, analysis);
  if (!fit.available) return <span>충족률 산출 불가 · 항목 점수 또는 판독 결과 확인 필요</span>;
  return (
    <>
      <span>종합 {analysis.score}점</span>
      <span>핵심 {fit.coreTotal ? `${fit.coreMet}/${fit.coreTotal}` : '미지정'}</span>
      <span>
        항목 충족 {fit.met}/{fit.total} · {fit.coverage}%
      </span>
      <span>추가 확인: {fit.weak.join(', ') || '없음'}</span>
      {fit.unknown.length > 0 && <span>판정 불가: {fit.unknown.join(', ')}</span>}
      {fit.legacy && <span>이전 키워드 방식 · 저장 당시 점수 기준</span>}
    </>
  );
}
function ProjectAnalysisTable({
  project,
  revision,
  analysis,
}: {
  project: AnalysisProject;
  revision: ProjectRevision;
  analysis: ProjectAnalysis;
}) {
  const [selected, setSelected] = useState<ProjectResult | null>(null);
  const [filter, setFilter] = useState('all');
  const [copyState, setCopyState] = useState('');
  const recruiter = project.role === 'recruiter';
  const keywordAnalysis = analysis.results.some((r) => r.keywordMatches);
  const scored = analysis.results.some((r) => r.score !== undefined);
  const evidenceLabels = ['미확인', '언급', '역할', '판단', '결과'];
  const fit = fitSummary(project.criteria, analysis);
  const criterion = project.criteria.find((c) => c.id === selected?.criterionId);
  const suggestion = criterion
    ? selected?.sources.length
      ? `[상황과 목표]에서 ${criterion.name}과 관련하여 [직접 맡은 역할]을 수행했습니다. [사용한 방법과 도구]로 문제를 해결하고 [실제 확인한 결과]를 검증했습니다.`
      : `${criterion.name}에 관한 직접 수행한 경험이 있다면 [프로젝트 또는 업무], [본인의 역할], [수행 과정], [검증한 결과]를 순서대로 작성해 주세요. 경험이 없다면 학습·실습 계획부터 정리해 보세요.`
    : '';
  return (
    <div className="project-analysis">
      {scored && (
        <p className="project-notice">
          직무 기준 점수 {analysis.score}/100 · JD에 해당하는 항목의 배점을 100점으로 환산했습니다.
          근거 수준은 서류 표현에 대한 규칙 판독이며, 실제 역량이나 성과의 검증 결과가 아닙니다.
        </p>
      )}
      {recruiter && (
        <div className="project-fit-summary">
          <FitMetrics project={project} analysis={analysis} />
        </div>
      )}
      <div className="project-table-filters" aria-label="분석표 필터">
        {[
          { id: 'all', label: '전체' },
          { id: 'confirmed', label: '확인' },
          { id: 'gap', label: '추가 확인 필요' },
        ].map((f) => (
          <button key={f.id} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>
      <div className="project-comparison-wrap">
        <table className="project-comparison">
          <caption className="sr-only">JD 기준별 기재 여부와 근거</caption>
          <thead>
            <tr>
              <th scope="col">JD 기준</th>
              <th scope="col">{keywordAnalysis ? '인정 근거' : '지원서'}</th>
              <th scope="col">{keywordAnalysis ? '키워드 연관' : '규칙 판독'}</th>
              {scored && <th scope="col">점수·근거 수준</th>}
              <th scope="col">근거 요약</th>
              <th scope="col">상태</th>
            </tr>
          </thead>
          <tbody>
            {analysis.results
              .filter(
                (r) =>
                  filter === 'all' ||
                  (filter === 'confirmed' ? r.status === 'confirmed' : r.status !== 'confirmed'),
              )
              .map((r) => (
                <tr key={r.criterionId}>
                  <th scope="row">
                    <button
                      aria-haspopup="dialog"
                      onClick={() => {
                        setSelected(r);
                        setCopyState('');
                      }}
                    >
                      {project.criteria.find((c) => c.id === r.criterionId)?.name}
                      {project.criteria.find((c) => c.id === r.criterionId)?.core && ' · 핵심'}
                      <ArrowRight size={13} />
                    </button>
                    {recruiter && (
                      <small>
                        충족 기준{' '}
                        {(project.criteria.find((c) => c.id === r.criterionId)?.minimumRatio ??
                          0.5) * 100}
                        % ·{' '}
                        {fit.items.find((i) => i.criterion.id === r.criterionId)?.ratio === null
                          ? '판정 불가'
                          : fit.items.find((i) => i.criterion.id === r.criterionId)?.met
                            ? '충족'
                            : '추가 확인'}
                      </small>
                    )}
                  </th>
                  <td data-label={keywordAnalysis ? '인정 근거' : '지원서'}>
                    {r.status === 'unreadable'
                      ? '판독 불가'
                      : r.mentioned
                        ? keywordAnalysis
                          ? 'O · 있음'
                          : 'O · 기재'
                        : keywordAnalysis
                          ? 'X · 미확인'
                          : 'X · 미기재'}
                  </td>
                  <td data-label={keywordAnalysis ? '키워드 연관' : '규칙 판독'}>
                    {r.keywordMatches ? (
                      <div className="project-keyword-matches">
                        <strong>
                          {r.status === 'unreadable'
                            ? '판독 불가'
                            : r.reading === 'O'
                              ? 'O · 연관 있음'
                              : 'X · 미확인'}
                        </strong>
                        {r.keywordMatches.map((match, index) => (
                          <div key={`${match.jdKeyword}-${index}`}>
                            {match.jdKeyword}:{' '}
                            {match.relation === 'NONE'
                              ? r.status === 'unreadable'
                                ? '판독 불가'
                                : '미확인'
                              : `${match.matchedKeyword} · ${match.relation === 'DIRECT' ? '직접 일치' : '연관 일치'}`}
                          </div>
                        ))}
                      </div>
                    ) : (
                      r.reading
                    )}
                  </td>
                  {scored && (
                    <td data-label="점수·근거 수준">
                      {r.status === 'unreadable' ? (
                        '판독 불가'
                      ) : (
                        <div>
                          <strong>
                            {r.score} / {r.maxScore}
                          </strong>
                          {r.evidenceLevel !== undefined && (
                            <p>
                              {evidenceLabels[r.evidenceLevel]} · {r.evidenceLevel}/4
                            </p>
                          )}
                        </div>
                      )}
                    </td>
                  )}
                  <td data-label="근거 요약">
                    <p>{r.sources[0]?.excerpt ?? r.reason}</p>
                  </td>
                  <td data-label="상태">
                    <span className={`project-status project-status-${r.status}`}>
                      <i />
                      {statusNames[r.status]}
                    </span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {!analysis.results.some(
          (r) =>
            filter === 'all' ||
            (filter === 'confirmed' ? r.status === 'confirmed' : r.status !== 'confirmed'),
        ) && <p className="project-empty-search">해당하는 항목이 없습니다.</p>}
      </div>
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={`${criterion?.name ?? ''} · ${recruiter ? '지원자 서류 원문' : '내 서류 분석'}`}
        description={`${analysis.name} · 분석 v${revision.number} · 제출 당시 원문`}
        wide
      >
        {selected && criterion && (
          <div className="project-evidence">
            <div className="project-evidence-jd">
              <strong>연결된 JD 기준</strong>
              <p>{criterion.description}</p>
            </div>
            <h3>관련 서류 원문</h3>
            {selected.sources.length ? (
              selected.sources.map((source, index) => {
                const doc = revision.documents.find((d) => d.id === source.documentId);
                return (
                  <section
                    key={`${source.documentId}-${source.page}-${index}`}
                    className="project-source"
                  >
                    <div>
                      <FileText size={15} />
                      <strong>{source.filename}</strong>
                      <small>
                        {doc?.source === 'pdf' ? `${source.page}페이지` : '텍스트 원문'}
                      </small>
                    </div>
                    <blockquote>
                      {highlight(source.excerpt, [
                        ...criterion.keywords,
                        ...(selected.keywordMatches?.flatMap((m) =>
                          m.matchedKeyword ? [m.matchedKeyword] : [],
                        ) ?? []),
                      ])}
                    </blockquote>
                    <details>
                      <summary>
                        {doc?.source === 'pdf'
                          ? '해당 페이지의 추출 텍스트 보기'
                          : '전체 텍스트 보기'}
                      </summary>
                      <pre>{doc?.pages.find((p) => p.number === source.page)?.text}</pre>
                    </details>
                  </section>
                );
              })
            ) : (
              <div className="project-no-evidence">
                {selected.status === 'unreadable'
                  ? '서류 판독에 실패했습니다. 파일을 교체해 주세요.'
                  : '관련 원문을 찾지 못했습니다.'}
                <p>출처를 확인할 수 없는 원문이나 페이지를 만들지 않습니다.</p>
              </div>
            )}
            <section>
              <h3>해당 JD 항목에 관한 설명</h3>
              <p>{selected.reason}</p>
              {keywordAnalysis && <small>적용 규칙: {analysis.evaluatorVersion}</small>}
            </section>
            {!recruiter && (
              <>
                <section className="project-rewrite">
                  <h3>첨삭 제안 · 작성 가이드</h3>
                  <p>
                    원문을 바꾸지 않고 작성 틀을 제안합니다. 대괄호는 직접 확인해 채워야 할
                    정보입니다.
                  </p>
                  <textarea aria-label="첨삭 제안" readOnly value={suggestion} rows={5} />
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(suggestion);
                        setCopyState('복사했습니다.');
                      } catch {
                        setCopyState('복사하지 못했습니다. 위 텍스트를 직접 선택해 주세요.');
                      }
                    }}
                  >
                    <Copy size={15} />
                    첨삭 틀 복사
                  </Button>
                  <span role="status">{copyState}</span>
                </section>
                <section className="project-recommendation-empty">
                  <h3>관련 공모전·해커톤</h3>
                  <p>
                    현재 연결된 검색 결과가 없습니다. 확인되지 않은 행사나 외부 링크를 추천하지
                    않습니다.
                  </p>
                </section>
                <Button asChild>
                  <Link href={`/new-project?projectId=${project.id}`}>
                    서류 수정 등록
                    <ArrowRight size={15} />
                  </Link>
                </Button>
              </>
            )}
            {recruiter && (
              <Button variant="outline" onClick={() => setSelected(null)}>
                <ArrowLeft size={15} />
                지원자 분석으로 돌아가기
              </Button>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
