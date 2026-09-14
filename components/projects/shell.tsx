'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { FolderPlus, Home, LogOut, Menu, X, Layers2, ArrowUpRight } from 'lucide-react';
import { useProjects } from '@/lib/projects/store';
import { projectRoute } from '@/lib/projects/domain';
import { Skeleton } from '@/components/ui/states';
export function ProjectShell({ children }: { children: ReactNode }) {
  const { actor, projects, ready, error, logout } = useProjects();
  const path = usePathname();
  const router = useRouter();
  const [mobile, setMobile] = useState(false);
  const [localError, setLocalError] = useState('');
  return (
    <div className="project-shell">
      <aside className={`project-sidebar ${mobile ? 'is-open' : ''}`}>
        <Link
          href="/home"
          className="project-brand"
          onClick={(e) => {
            if (path === '/home' || path === '/') e.preventDefault();
            setMobile(false);
          }}
        >
          <Layers2 size={24} />
          wantedhacker
        </Link>
        <button
          className="project-mobile-close"
          onClick={() => setMobile(false)}
          aria-label="메뉴 닫기"
        >
          <X size={20} />
        </button>
        <nav aria-label="프로젝트 탐색">
          <Link
            href="/home"
            className={path === '/home' ? 'active' : ''}
            onClick={(e) => {
              if (path === '/home' || path === '/') e.preventDefault();
              setMobile(false);
            }}
          >
            <Home size={18} />홈
          </Link>
          <Link
            href="/new-project"
            onClick={() => setMobile(false)}
            className={path === '/new-project' ? 'active' : ''}
          >
            <FolderPlus size={18} />
            프로젝트 생성
          </Link>
        </nav>
        <span className="project-nav-label">{actor ? '내 프로젝트' : '프로젝트'}</span>
        <nav className="project-side-list" aria-label="생성한 프로젝트">
          {actor &&
            projects.map((project) => (
              <Link
                key={project.id}
                href={projectRoute(project)}
                className={path.includes(project.id) ? 'active' : ''}
                onClick={() => setMobile(false)}
              >
                {project.title}
                <small>{project.revisions.length}개 분석 버전</small>
              </Link>
            ))}
          {(!actor || !projects.length) && <p>생성한 프로젝트 없음</p>}
        </nav>
        <div className="project-sidebar-bottom">
          {actor && (
            <Link
              href={actor.role === 'applicant' ? '/resumes' : '/recruiter/jobs'}
              className="project-legacy-link"
            >
              {actor.role === 'applicant' ? '저장한 지원서 관리' : '기존 채용 대시보드'}
              <ArrowUpRight size={14} />
            </Link>
          )}
          <span className="project-demo-label">FRONTEND DEMO</span>
          <p>
            파일의 텍스트와 분석 기록은
            <br />이 브라우저에만 저장됩니다.
          </p>
          {actor ? (
            <>
              <strong>{actor.name}</strong>
              <small>{actor.role === 'recruiter' ? '채용 담당자' : '구직자'} · 데모 로그인</small>
              <button
                onClick={() => {
                  try {
                    logout();
                    router.push('/home');
                  } catch (e) {
                    setLocalError((e as Error).message);
                  }
                }}
              >
                <LogOut size={15} />
                로그아웃
              </button>
            </>
          ) : (
            <Link href="/login">
              로그인 / 회원가입
              <ArrowUpRight size={14} />
            </Link>
          )}
        </div>
      </aside>
      {mobile && (
        <button
          className="project-mobile-overlay"
          onClick={() => setMobile(false)}
          aria-label="메뉴 배경 닫기"
        />
      )}
      <div className="project-main">
        <header className="project-topbar">
          <div>
            <button
              className="project-mobile-menu"
              onClick={() => setMobile(true)}
              aria-label="메뉴 열기"
            >
              <Menu size={20} />
            </button>
            <span>
              {actor
                ? actor.role === 'recruiter'
                  ? '채용 담당자 워크스페이스'
                  : '구직자 워크스페이스'
                : '서류에서 찾는 더 나은 기회'}
            </span>
          </div>
          {!actor && <Link href="/login">로그인 / 회원가입</Link>}
          {actor && <span className="project-demo-label">{actor.provider} · DEMO</span>}
        </header>
        <main className="project-content">
          {error || localError ? (
            <div className="error-banner" role="alert">
              {error || localError}
            </div>
          ) : null}
          {ready ? children : <Skeleton />}
        </main>
        <footer className="project-footer">© 2026 wantedhacker · 근거로 연결하는 다음 기회</footer>
      </div>
    </div>
  );
}
