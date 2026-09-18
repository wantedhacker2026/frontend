'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowUpRight,
  BriefcaseBusiness,
  ChevronDown,
  CircleHelp,
  Compass,
  FileCheck2,
  FileText,
  FolderOpen,
  Layers2,
  LayoutDashboard,
  Menu,
  Sparkles,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useStore } from '@/lib/store';
import { useProjects } from '@/lib/projects/store';
import { Skeleton } from './ui/states';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className={`logo ${light ? 'logo-light' : ''}`} aria-label="wantedhacker 홈">
      <span className="logo-symbol">
        <Layers2 size={21} strokeWidth={2.5} />
      </span>
      <span className="logo-wordmark">wantedhacker</span>
    </Link>
  );
}
export function PublicNav() {
  return (
    <header className="public-nav">
      <Logo />
      <nav className="flex items-center gap-3">
        <Link href="/jobs" className="nav-text">
          채용공고 둘러보기
        </Link>
        <Button asChild variant="outline" size="sm">
          <Link href="/recruiter/jobs">
            채용담당자 체험
            <ArrowUpRight size={14} />
          </Link>
        </Button>
      </nav>
    </header>
  );
}
export function Shell({
  children,
  role = 'recruiter',
}: {
  children: ReactNode;
  role?: 'recruiter' | 'applicant';
}) {
  const path = usePathname();
  const { db, ready, error, dismissError, reset } = useStore();
  const { actor, ready: authReady } = useProjects();
  const [mobile, setMobile] = useState(false);
  const [help, setHelp] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const recruiter = role === 'recruiter';
  const privatePage = /^\/(resumes|applications|recruiter)(\/|$)/.test(path);
  if (privatePage && !authReady) return <Skeleton />;
  if (privatePage && (!actor || actor.role !== role))
    return (
      <main className="project-auth-existing">
        <h1>{actor ? '이용 유형을 확인해 주세요.' : '로그인 후 이용해 주세요.'}</h1>
        <p>
          {actor
            ? '현재 로그인한 이용 유형의 작업 공간에서 계속할 수 있습니다.'
            : '이메일 인증 후 내 지원서와 채용 작업 공간을 사용할 수 있습니다.'}
        </p>
        <Button asChild>
          <Link href={actor ? '/home' : '/login'}>{actor ? '내 홈으로' : '이메일로 로그인'}</Link>
        </Button>
      </main>
    );
  return (
    <div className="app-shell framer-workspace">
      <aside className={`sidebar ${mobile ? 'sidebar-open' : ''}`}>
        <div className="sidebar-logo">
          <Logo />
          <button className="mobile-close" onClick={() => setMobile(false)} aria-label="메뉴 닫기">
            <X size={20} />
          </button>
        </div>
        <div className="workspace-switch">
          <span className="workspace-avatar">W</span>
          <div>
            <strong>wantedhacker</strong>
            <small>{recruiter ? '채용 워크스페이스' : '지원자 워크스페이스'}</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <p className="nav-section">WORKSPACE</p>
        <nav className="sidebar-nav">
          {(recruiter
            ? [
                { href: '/recruiter/jobs', icon: LayoutDashboard, label: '채용 대시보드' },
                {
                  href: '/recruiter/jobs/backend/candidates',
                  icon: BriefcaseBusiness,
                  label: '지원자 관리',
                },
              ]
            : [
                { href: '/jobs', icon: Compass, label: '채용공고 탐색' },
                { href: '/resumes', icon: FileText, label: '내 지원서' },
                { href: '/applications', icon: FileCheck2, label: '내 지원 현황' },
              ]
          ).map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobile(false)}
              className={
                path === href ||
                (href === '/resumes' && path.startsWith('/resumes/')) ||
                (label === '지원자 관리' && path.includes('/candidates'))
                  ? 'active'
                  : ''
              }
            >
              <Icon size={18} />
              {label}
              {label === '지원자 관리' && (
                <span className="nav-count">
                  {db.applications.filter((a) => a.jobId === 'backend').length}
                </span>
              )}
            </Link>
          ))}
        </nav>
        {recruiter && (
          <>
            <p className="nav-section mt-8">
              <FolderOpen size={14} /> 채용 프로젝트
            </p>
            <nav className="job-nav">
              {db.jobs.slice(0, 5).map((job, i) => (
                <Link
                  key={job.id}
                  href={`/recruiter/jobs/${job.id}/candidates`}
                  onClick={() => setMobile(false)}
                  className={path.includes(`/jobs/${job.id}/`) ? 'selected' : ''}
                >
                  <span className={`job-dot dot-${i % 3}`} />
                  <span>{job.title}</span>
                </Link>
              ))}
            </nav>
          </>
        )}
        {!recruiter && (
          <>
            <p className="nav-section mt-8">
              <FolderOpen size={14} /> 나의 프로젝트
            </p>
            <nav className="job-nav" aria-label="공고별 프로젝트">
              {db.jobs.map((job, i) => {
                const latest = db.applications
                  .filter((a) => a.jobId === job.id && db.ownApplicationIds.includes(a.id))
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
                const current = db.applications.find((a) =>
                  path.startsWith(`/applications/${a.id}`),
                );
                const active =
                  path === `/jobs/${job.id}` ||
                  path.startsWith(`/jobs/${job.id}/`) ||
                  current?.jobId === job.id;
                return (
                  <Link
                    key={job.id}
                    href={latest ? `/applications/${latest.id}` : `/jobs/${job.id}`}
                    onClick={() => setMobile(false)}
                    className={active ? 'selected' : ''}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span className={`job-dot dot-${i % 3}`} />
                    <span>
                      {job.title}
                      <small>{latest ? '내 분석 결과' : '공고 살펴보기'}</small>
                    </span>
                  </Link>
                );
              })}
            </nav>
          </>
        )}
        <div className="sidebar-bottom">
          <div className="demo-note">
            <Sparkles size={17} />
            <strong>가능성을 발견하는 채용</strong>
            <p>
              같은 기준으로 비교하고,
              <br />
              다음 기회를 함께 만드세요.
            </p>
            <span className="demo-pill">DEMO WORKSPACE</span>
          </div>
          <button className="help-link" onClick={() => setHelp(true)}>
            <CircleHelp size={17} />
            데모 이용 가이드
            <ArrowUpRight size={15} />
          </button>
          <Link href={actor ? '/home' : '/login'} className="role-switch">
            {actor ? '내 프로젝트 홈으로' : '이메일로 로그인'}
            <ArrowUpRight size={15} />
          </Link>
          <div className="sidebar-user">
            <span className="user-avatar">{recruiter ? '채' : '나'}</span>
            <div>
              <strong>{actor?.name ?? '공고 둘러보기'}</strong>
              <small>{actor ? '이메일 인증' : '로그인 후 내 서류를 저장하세요'}</small>
            </div>
            <span className="online-dot" />
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          className="mobile-backdrop"
          onClick={() => setMobile(false)}
          aria-label="메뉴 닫기"
        />
      )}
      <div className="main-column">
        <header className="topbar">
          <div className="flex items-center gap-3">
            <button className="mobile-menu" onClick={() => setMobile(true)} aria-label="메뉴 열기">
              <Menu size={20} />
            </button>
            <span>워크스페이스</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{recruiter ? '채용 관리' : '나의 커리어'}</strong>
          </div>
          <div className="flex items-center gap-3">
            <span className="local-indicator">
              <span />
              {error ? '저장 확인 필요' : '브라우저에 저장됨'}
            </span>
            <span className="topbar-demo">Demo</span>
          </div>
        </header>
        <main className="main-content">
          {error && (
            <div className="error-banner" role="alert">
              {error}
              <button onClick={dismissError} aria-label="안내 닫기">
                <X size={16} />
              </button>
            </div>
          )}
          {ready ? children : <Skeleton />}
        </main>
        <footer className="app-footer">
          <span>© 2026 wantedhacker · Better signals. Better decisions.</span>
          <span>근거를 통해 가능성을 발견합니다.</span>
        </footer>
      </div>
      <Dialog
        open={help}
        onOpenChange={setHelp}
        title="wantedhacker 데모 이용 가이드"
        description="샘플 공고 3개와 서로 다른 지원서 20개로 전체 흐름을 체험할 수 있습니다."
      >
        <ol className="guide-list">
          <li>채용담당자: 공고 → 지원자 비교 → 근거 확인 → 검토 상태 변경</li>
          <li>지원자: 내 지원서 버전 저장 → 공고에서 버전 선택 → 매칭 분석 → 개선 계획</li>
          <li>채용 기준을 수정하면 지원서가 모두 다시 평가됩니다.</li>
        </ol>
        <p className="info-box my-5">
          키워드 기반 데모 평가이며 실제 채용 판단을 대신하지 않습니다. 입력 내용은 이 브라우저에만
          저장됩니다. 실제 개인정보 대신 예시를 사용해 주세요.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setHelp(false);
            setConfirmReset(true);
          }}
        >
          데모 데이터 초기화
        </Button>
      </Dialog>
      <Dialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="데모 데이터를 초기화할까요?"
        description="이 브라우저에서 추가한 공고, 저장한 지원서 버전, 제출 내역, 검토 상태, 완료한 액션을 지우고 처음 상태로 되돌립니다."
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirmReset(false)}>
            취소
          </Button>
          <Button
            onClick={() => {
              reset();
              setConfirmReset(false);
              window.location.href = recruiter ? '/recruiter/jobs' : '/jobs';
            }}
          >
            초기화하기
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
