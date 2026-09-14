'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, LoaderCircle, Plus, X } from 'lucide-react';
import { useProjects } from '@/lib/projects/store';
import {
  deriveCriteria,
  processDraft,
  projectRoute,
  revisionDraft,
  validateDraft,
} from '@/lib/projects/domain';
import { demoDraft } from '@/lib/projects/demo';
import type { AnalysisProject, ProjectActor, ProjectDraft } from '@/lib/projects/types';
import { documentSchema, personSchema, criterionSchema, jdSchema } from '@/lib/projects/types';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/states';
import { DocumentUpload } from './document-upload';
const draftSchema = z.object({
  id: z.string(),
  title: z.string(),
  jd: jdSchema,
  criteria: z.array(criterionSchema.extend({ name: z.string(), keywords: z.array(z.string()) })),
  documents: z.array(documentSchema),
  people: z.array(personSchema.extend({ name: z.string() })),
});
export function NewProject() {
  const { actor, projects } = useProjects();
  const query = useSearchParams();
  const projectId = query.get('projectId');
  const project = projects.find((p) => p.id === projectId);
  if (projectId && !project)
    return (
      <EmptyState
        title="프로젝트에 접근할 수 없습니다"
        description="로그인한 계정과 프로젝트의 소유자를 확인해 주세요."
        href={actor ? '/home' : '/login'}
        label={actor ? '내 홈으로' : '로그인'}
      />
    );
  return (
    <ProjectForm
      key={`${actor?.id ?? 'guest'}-${projectId ?? 'new'}`}
      actor={actor}
      previous={project}
    />
  );
}
function ProjectForm({
  actor,
  previous,
}: {
  actor: ProjectActor | null;
  previous?: AnalysisProject;
}) {
  const { commitProject } = useProjects();
  const router = useRouter();
  const storageKey = `wantedhacker-project-draft:${actor?.id ?? 'guest'}:${previous?.id ?? 'new'}`;
  const [draft, setDraft] = useState<ProjectDraft>(() =>
    previous
      ? revisionDraft(previous)
      : {
          id: crypto.randomUUID(),
          title: '',
          jd: { mode: 'text', reference: '직접 입력', text: '' },
          criteria: [],
          documents: [],
          people: [],
        },
  );
  const [error, setError] = useState('');
  const [storageWarning, setStorageWarning] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [reading, setReading] = useState(false);
  const [stage, setStage] = useState<number | null>(null);
  const [leave, setLeave] = useState(false);
  const [grouped, setGrouped] = useState(false);
  const [dirty, setDirty] = useState(false);
  const lock = useRef(false);
  const completed = useRef(false);
  const [imageURL, setImageURL] = useState('');
  const imageRef = useRef<HTMLInputElement>(null);
  /* eslint-disable react-hooks/set-state-in-effect -- Restore and report external browser draft storage after hydration. */
  useEffect(() => {
    try {
      const raw =
        sessionStorage.getItem(storageKey) ??
        (!previous ? sessionStorage.getItem('wantedhacker-project-draft:guest:new') : null);
      if (raw) {
        setDraft(draftSchema.parse(JSON.parse(raw)));
        setDirty(true);
      }
    } catch {
      setStorageWarning('임시 입력을 복원하지 못했습니다. 파일을 다시 확인해 주세요.');
    }
    setLoaded(true);
  }, [storageKey, previous]);
  useEffect(() => {
    if (!loaded || !dirty || completed.current) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(draft));
      setStorageWarning('');
    } catch {
      setStorageWarning(
        '현재 탭의 임시 저장 공간이 부족합니다. 탭을 닫기 전에 분석을 완료해 주세요.',
      );
    }
  }, [draft, loaded, storageKey, dirty]);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    const listener = (event: BeforeUnloadEvent) => {
      if (dirty && !completed.current) {
        event.preventDefault();
      }
    };
    window.addEventListener('beforeunload', listener);
    return () => window.removeEventListener('beforeunload', listener);
  }, [dirty]);
  useEffect(
    () => () => {
      if (imageURL) URL.revokeObjectURL(imageURL);
    },
    [imageURL],
  );
  function update(patch: Partial<ProjectDraft>) {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  }
  function changeText(text: string) {
    update({ jd: { ...draft.jd, text }, criteria: deriveCriteria(text) });
  }
  let validation = '';
  try {
    if (actor) validateDraft(draft, actor);
    else validation = '분석하려면 로그인해 주세요.';
  } catch (e) {
    validation = (e as Error).message;
  }
  const canAnalyze = !validation && !reading && (actor?.role !== 'recruiter' || grouped);
  async function run() {
    if (lock.current || !actor || !canAnalyze) return;
    lock.current = true;
    setError('');
    setStage(0);
    try {
      const result = await processDraft(draft, actor, previous, setStage);
      commitProject(result, previous?.revisions.length ?? 0);
      completed.current = true;
      try {
        sessionStorage.removeItem(storageKey);
        sessionStorage.removeItem('wantedhacker-project-draft:guest:new');
      } catch {
        /* The successful analysis is already persisted; draft cleanup must not turn it into failure. */
      }
      router.push(projectRoute(result));
    } catch (e) {
      setError((e as Error).message);
      setStage(null);
      lock.current = false;
    }
  }
  return (
    <div className="project-editor">
      <button
        type="button"
        className="back-link"
        onClick={() => (dirty ? setLeave(true) : router.push('/home'))}
      >
        <ArrowLeft size={15} />
        뒤로가기
      </button>
      <div className="project-page-heading">
        <div>
          <span className="eyebrow">
            {previous ? 'A NEW VERSION, THE SAME OPPORTUNITY' : 'START A NEW PROJECT'}
          </span>
          <h1>
            {previous
              ? actor?.role === 'recruiter'
                ? '지원자 서류 추가 등록'
                : '서류 수정 등록'
              : 'JD와 서류를 연결하세요.'}
          </h1>
          <p>
            {actor
              ? `${actor.role === 'recruiter' ? '채용 담당자' : '구직자'} · ${actor.name}님`
              : '비로그인 · 작성 후 로그인하면 분석할 수 있어요.'}
          </p>
        </div>
        {!previous && (
          <Button
            variant="outline"
            disabled={reading || stage !== null}
            onClick={() => {
              const sample = demoDraft(
                actor ?? { id: 'guest', name: '지원자', role: 'applicant', provider: '데모' },
              );
              setDraft(sample);
              setDirty(true);
              setGrouped(false);
            }}
          >
            예시로 채우기{actor?.role === 'recruiter' ? ' · 20명' : ''}
          </Button>
        )}
      </div>
      {previous && (
        <div className="project-notice">
          기존 {previous.revisions.length}개 분석은 보존됩니다. 이번 분석이 성공했을 때 새 버전으로
          표시합니다.
        </div>
      )}
      <fieldset disabled={stage !== null || reading} className="project-form-body">
        <section className="project-form-section">
          <div className="project-section-title">
            <span>01</span>
            <h2>채용공고 JD</h2>
          </div>
          <label className="project-field">
            프로젝트 이름
            <input
              maxLength={100}
              value={draft.title}
              onChange={(e) => update({ title: e.target.value })}
              placeholder="예: 마케팅 직무 신입"
              readOnly={Boolean(previous)}
            />
          </label>
          {!previous && (
            <div className="project-input-tabs" aria-label="JD 입력 방식">
              {(
                [
                  { mode: 'text', label: '본문 입력' },
                  { mode: 'url', label: '공고 URL' },
                  { mode: 'image', label: 'JD 이미지' },
                ] as const
              ).map((option) => (
                <button
                  type="button"
                  key={option.mode}
                  aria-pressed={draft.jd.mode === option.mode}
                  onClick={() => update({ jd: { ...draft.jd, mode: option.mode, reference: '' } })}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
          {draft.jd.mode === 'url' && (
            <>
              <label className="project-field">
                채용공고 URL
                <input
                  type="url"
                  value={draft.jd.reference}
                  onChange={(e) => update({ jd: { ...draft.jd, reference: e.target.value } })}
                  placeholder="https://company.com/careers/position"
                  readOnly={Boolean(previous)}
                />
              </label>
              <p className="project-notice">
                URL 자동 수집은 연동 전입니다. 아래에 공고 본문을 붙여넣으면 해당 텍스트를
                분석합니다. 접근 제한된 공고는 JD 이미지를 선택하고 본문을 입력할 수 있어요.
              </p>
            </>
          )}
          {draft.jd.mode === 'image' && (
            <div className="project-jd-image">
              <input
                className="sr-only"
                ref={imageRef}
                type="file"
                accept="image/png,image/jpeg"
                aria-label="JD 이미지 선택"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (
                    !['image/png', 'image/jpeg'].includes(file.type) ||
                    file.size > 10 * 1024 * 1024
                  ) {
                    setError('JD 이미지는 10MB 이하 PNG 또는 JPG로 선택해 주세요.');
                    return;
                  }
                  setError('');
                  setImageURL(URL.createObjectURL(file));
                  update({ jd: { ...draft.jd, imageName: file.name, reference: file.name } });
                  e.target.value = '';
                }}
              />
              {!previous && (
                <Button variant="outline" type="button" onClick={() => imageRef.current?.click()}>
                  {draft.jd.imageName ? 'JD 이미지 교체' : 'JD 이미지 선택'}
                </Button>
              )}
              {draft.jd.imageName && (
                <p>
                  {draft.jd.imageName}
                  {!previous && (
                    <button
                      aria-label="JD 이미지 제거"
                      type="button"
                      onClick={() => {
                        setImageURL('');
                        update({ jd: { ...draft.jd, imageName: undefined, reference: '' } });
                      }}
                    >
                      <X size={15} />
                    </button>
                  )}
                </p>
              )}
              {imageURL && (
                <div
                  className="project-image-preview"
                  role="img"
                  aria-label="선택한 JD 이미지 미리보기"
                  style={{ backgroundImage: `url("${imageURL}")` }}
                />
              )}
              <p>
                이미지 OCR은 연동 전입니다. 아래에 이미지의 JD 내용을 입력해 확인해 주세요. 원본
                이미지는 현재 탭에서만 미리 볼 수 있습니다.
              </p>
            </div>
          )}
          <label className="project-field">
            분석할 JD 본문
            <textarea
              rows={7}
              maxLength={30000}
              value={draft.jd.text}
              readOnly={Boolean(previous)}
              onChange={(e) => changeText(e.target.value)}
              placeholder="지원 자격, 필수 역량, 우대사항을 입력하세요."
            />
          </label>
          <details className="project-criteria-editor" open={draft.criteria.length === 0}>
            <summary>추출한 평가 기준 확인 · {draft.criteria.length}개</summary>
            <p>키워드 기반 초안입니다. 공고에 맞게 기준과 검색 키워드를 수정한 뒤 분석해 주세요.</p>
            {draft.criteria.map((c) => (
              <div className="project-criterion-edit" key={c.id}>
                <input
                  aria-label="평가 기준 이름"
                  value={c.name}
                  readOnly={Boolean(previous)}
                  onChange={(e) =>
                    update({
                      criteria: draft.criteria.map((v) =>
                        v.id === c.id
                          ? {
                              ...v,
                              name: e.target.value,
                              description: `JD의 ${e.target.value} 조건을 확인합니다.`,
                            }
                          : v,
                      ),
                    })
                  }
                />
                <input
                  aria-label={`${c.name} 검색 키워드`}
                  value={c.keywords.join(', ')}
                  readOnly={Boolean(previous)}
                  onChange={(e) =>
                    update({
                      criteria: draft.criteria.map((v) =>
                        v.id === c.id
                          ? { ...v, keywords: e.target.value.split(',').map((s) => s.trim()) }
                          : v,
                      ),
                    })
                  }
                />
                {!previous && (
                  <button
                    aria-label={`${c.name} 기준 제거`}
                    type="button"
                    onClick={() =>
                      update({ criteria: draft.criteria.filter((v) => v.id !== c.id) })
                    }
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            ))}
            {!previous && (
              <button
                type="button"
                className="project-text-button"
                disabled={draft.criteria.length >= 20}
                onClick={() =>
                  update({
                    criteria: [
                      ...draft.criteria,
                      {
                        id: crypto.randomUUID(),
                        name: '새 기준',
                        keywords: ['새 키워드'],
                        required: true,
                        description: 'JD에서 확인할 조건을 입력해 주세요.',
                      },
                    ],
                  })
                }
              >
                <Plus size={15} />
                평가 기준 추가
              </button>
            )}
          </details>
        </section>
        <section className="project-form-section">
          <div className="project-section-title">
            <span>02</span>
            <h2>
              {actor?.role === 'recruiter'
                ? '지원자 서류 등록'
                : `${actor?.name ?? '지원자'}님의 서류를 등록해주세요`}
            </h2>
          </div>
          <DocumentUpload
            actor={actor}
            documents={draft.documents}
            people={draft.people}
            onBusy={setReading}
            onChange={(documents, people) => {
              update({ documents, people });
              setGrouped(false);
            }}
          />
          {actor?.role === 'recruiter' && draft.documents.length > 0 && (
            <label className="project-group-confirm">
              <input
                type="checkbox"
                checked={grouped}
                onChange={(e) => setGrouped(e.target.checked)}
              />
              파일별 지원자 이름과 묶음을 확인했습니다.
            </label>
          )}
        </section>
      </fieldset>
      {storageWarning && (
        <p className="project-notice" role="status">
          {storageWarning}
        </p>
      )}
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <br />
          입력한 서류와 직전 분석 결과는 유지됩니다.
        </div>
      )}
      <div className="project-submit-bar">
        <div>
          <strong>
            {draft.documents.filter((d) => d.status === 'ready').length}개 서류 준비 완료
          </strong>
          <p>
            {validation ||
              (!grouped && actor?.role === 'recruiter'
                ? '지원자별 파일 묶음을 확인해 주세요.'
                : '원문을 바탕으로 한 규칙 기반 데모 분석입니다.')}
          </p>
        </div>
        {actor ? (
          <Button onClick={run} disabled={!canAnalyze || stage !== null}>
            {actor.role === 'recruiter' ? '지원자 서류 요약하기' : `${actor.name}님 서류 분석하기`}
            <ArrowRight size={17} />
          </Button>
        ) : (
          <Button asChild>
            <Link href="/login">
              로그인 후 분석하기
              <ArrowRight size={17} />
            </Link>
          </Button>
        )}
      </div>
      <Dialog
        open={leave}
        onOpenChange={setLeave}
        title="등록 화면을 나갈까요?"
        description="현재 탭에 임시 저장된 입력은 다시 등록 화면을 열면 복원됩니다."
      >
        <div className="flex gap-3">
          <Button onClick={() => router.push('/home')}>홈으로 이동</Button>
          <Button variant="outline" onClick={() => setLeave(false)}>
            계속 작성
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={stage !== null}
        onOpenChange={() => {}}
        title={
          actor?.role === 'recruiter'
            ? '지원자 서류를 요약하고 있어요'
            : '내 서류를 분석하고 있어요'
        }
        description="로그인한 역할에 맞춰 처리하며 완료되면 결과 화면으로 자동 이동합니다."
        dismissible={false}
      >
        <ol className="project-processing" aria-live="polite">
          {['JD 핵심 기준 확인', '서류 처리', '분석 결과 저장'].map((label, i) => (
            <li key={label}>
              {i < (stage ?? 0) ? (
                <Check size={19} />
              ) : i === stage ? (
                <LoaderCircle className="animate-spin" size={19} />
              ) : (
                <span>{i + 1}</span>
              )}
              <strong>{label}</strong>
              <small>{i < (stage ?? 0) ? '완료' : i === stage ? '진행 중' : '대기'}</small>
            </li>
          ))}
        </ol>
      </Dialog>
    </div>
  );
}
