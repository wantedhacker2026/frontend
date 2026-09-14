'use client';
import Link from 'next/link';
import { FolderPlus, ArrowUpRight, Files, ChevronRight } from 'lucide-react';
import { useProjects } from '@/lib/projects/store';
import { projectRoute } from '@/lib/projects/domain';
import { Button } from '@/components/ui/button';
export function ProjectHome() {
  const { actor, projects } = useProjects();
  return (
    <div className="project-home">
      <div className="project-page-heading">
        <div>
          <span className="eyebrow">A CLEARER NEXT STEP</span>
          <h1>
            {actor
              ? actor.role === 'recruiter'
                ? '프로젝트 리스트'
                : '채용공고 리스트'
              : '서류에서 기회를 발견하세요.'}
          </h1>
          <p>
            {actor
              ? 'JD와 서류를 연결한 분석을 한 곳에서 관리하세요.'
              : 'JD와 서류를 등록하고, 다음 결정을 위한 근거를 확인하세요.'}
          </p>
        </div>
        {actor && (
          <Button asChild>
            <Link href="/new-project">
              <FolderPlus size={17} />새 프로젝트 생성
            </Link>
          </Button>
        )}
      </div>
      {!actor || !projects.length ? (
        <div className="project-empty">
          <Link href="/new-project" className="project-empty-icon" aria-label="새 프로젝트 등록">
            <Files size={50} />
            <span>+</span>
          </Link>
          <h2>{actor ? '첫 번째 프로젝트를 만들어 보세요.' : '아직 프로젝트가 없어요.'}</h2>
          <p>
            채용 담당자는 지원자 서류를 요약하고,
            <br />
            구직자는 내 서류의 근거와 개선 방향을 확인합니다.
          </p>
          <Button asChild>
            <Link href="/new-project">
              새 프로젝트 만들기
              <ArrowUpRight size={16} />
            </Link>
          </Button>
        </div>
      ) : (
        <div
          className="project-list-scroll"
          aria-label={actor.role === 'recruiter' ? '프로젝트 리스트' : '채용공고 리스트'}
        >
          {projects.map((project) => (
            <Link href={projectRoute(project)} className="project-list-row" key={project.id}>
              <span className="project-list-icon">
                <Files size={20} />
              </span>
              <div>
                <h2>{project.title}</h2>
                <p>
                  {project.role === 'recruiter'
                    ? `${project.revisions.at(-1)!.analyses.length}명 서류 요약`
                    : '내 서류 분석'}{' '}
                  · 버전 {project.revisions.length}
                </p>
              </div>
              <time dateTime={project.createdAt}>
                {new Date(project.createdAt).toLocaleDateString('ko-KR')}
              </time>
              <ChevronRight size={18} />
            </Link>
          ))}
        </div>
      )}
      <div className="project-home-bottom">
        <span>기존의 지원서 버전과 채용 데모도 계속 사용할 수 있어요.</span>
        <Link href="/about">
          서비스 소개
          <ArrowUpRight size={14} />
        </Link>
      </div>
    </div>
  );
}
