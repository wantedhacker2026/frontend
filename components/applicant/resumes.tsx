'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowRight, Copy, FilePenLine, FileText, Plus, Trash2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/states';
import { ResumePreview } from './resume-preview';

export function ResumesList() {
  const { db, duplicateResume, deleteResume } = useStore();
  const router = useRouter();
  const [deleting, setDeleting] = useState<string>();
  const [applying, setApplying] = useState<string>();
  const [error, setError] = useState('');
  const resumes = [...db.resumes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const selected = db.resumes.find((r) => r.id === applying);
  const remove = db.resumes.find((r) => r.id === deleting);
  function copy(id: string) {
    try {
      router.push(`/resumes/${duplicateResume(id)}/edit`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '복제하지 못했습니다.');
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">MY RESUME VERSIONS</div>
          <h1>공고마다, 나를 보여주는 다른 방법.</h1>
          <p>경험은 한 번 정리하고, 공고에 맞는 지원서 버전을 선택하세요.</p>
        </div>
        <Button asChild>
          <Link href="/resumes/new">
            <Plus size={16} />새 지원서 만들기
          </Link>
        </Button>
      </div>
      <div className="resume-library-intro">
        <FileText size={22} />
        <div>
          <strong>내 지원서 {resumes.length}개</strong>
          <p>
            저장한 버전을 복제해 강조점을 바꿔보세요. 버전을 수정하거나 삭제해도 이미 제출한 내용과
            분석 결과는 유지됩니다.
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {resumes.length ? (
        <div className="resume-library">
          {resumes.map((resume) => (
            <article key={resume.id} className="panel resume-library-item">
              <div className="resume-card-heading">
                <div>
                  <h2>{resume.title}</h2>
                  <p>
                    v{resume.revision} · {formatDate(resume.updatedAt)} 수정
                  </p>
                </div>
                <FileText size={22} />
              </div>
              <ResumePreview content={resume.content} />
              <div className="resume-card-actions">
                <div className="resume-button-row">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/resumes/${resume.id}/edit`}>
                      <FilePenLine size={14} />
                      수정
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copy(resume.id)}
                    aria-label={`${resume.title} 복제`}
                  >
                    <Copy size={14} />
                    복제
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setError('');
                      setDeleting(resume.id);
                    }}
                    aria-label={`${resume.title} 삭제`}
                  >
                    <Trash2 size={14} />
                    삭제
                  </Button>
                </div>
                <Button size="sm" onClick={() => setApplying(resume.id)}>
                  이 버전으로 지원하기
                  <ArrowRight size={14} />
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="첫 번째 지원서 버전을 만들어보세요"
          description="백엔드 기본형, 프로젝트 강조형처럼 이름을 붙여 저장할 수 있어요."
          href="/resumes/new"
          label="지원서 작성하기"
        />
      )}
      <p className="muted text-xs mt-5">
        지원서 버전은 현재 브라우저에 저장됩니다. 다른 기기와 동기화되지 않습니다.
      </p>
      <Dialog
        open={!!remove}
        onOpenChange={(open) => {
          if (!open) setDeleting(undefined);
        }}
        title="지원서 버전을 삭제할까요?"
        description={`‘${remove?.title ?? ''}’ 버전을 목록에서 삭제합니다. 이미 제출한 지원서와 분석 결과는 그대로 남습니다.`}
      >
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="resume-button-row justify-end">
          <Button variant="outline" onClick={() => setDeleting(undefined)}>
            취소
          </Button>
          <Button
            onClick={() => {
              try {
                if (deleting) deleteResume(deleting);
                setDeleting(undefined);
              } catch (e) {
                setError(e instanceof Error ? e.message : '삭제하지 못했습니다.');
              }
            }}
          >
            삭제하기
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setApplying(undefined);
        }}
        title="어떤 공고에 지원할까요?"
        description={`‘${selected?.title ?? ''}’ 버전으로 지원할 공고를 선택하세요. 다음 화면에서 내용을 확인한 뒤 제출합니다.`}
      >
        <div className="resume-job-options">
          {db.jobs.map((job) => (
            <Link key={job.id} href={`/jobs/${job.id}/apply?resumeId=${applying}`}>
              <div>
                <strong>{job.title}</strong>
                <p>
                  {job.companyName} · {job.location}
                </p>
              </div>
              <ArrowRight size={18} />
            </Link>
          ))}
        </div>
      </Dialog>
    </>
  );
}
