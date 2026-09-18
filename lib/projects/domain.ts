import { containsKeyword, generateCriteria } from '@/data/mock/criteria';
import {
  deriveJobCriteria,
  allocateProfileWeights,
  getJobProfile,
  JOB_PROFILE_CATALOG_VERSION,
  type JobProfileId,
} from '@/lib/evaluation/job-profiles';
import type { CandidateEvaluator } from '@/lib/evaluation/interface';
import { MockCandidateEvaluator } from '@/lib/evaluation/mock-evaluator';
import { ServerKeywordEvaluator } from '@/lib/evaluation/server-keyword-evaluator';
import { MAX_ANALYSIS_CRITERIA } from '@/lib/evaluation/limits';
import type { Application, EvaluationCriterion, Job } from '@/types';
import { evidenceLines } from './evidence';
import { sectionHeading, type SectionKey } from '@/lib/job-postings/types';
import {
  projectDBSchema,
  type AnalysisProject,
  type ProjectActor,
  type ProjectCriterion,
  type ProjectDB,
  type ProjectDraft,
  type ProjectResult,
  type ProjectRevision,
} from './types';
export const PROJECT_STORAGE_KEY = 'wantedhacker-projects-v1';
export function projectRoute(project: AnalysisProject) {
  return `/projects/${project.id}/${project.role === 'recruiter' ? 'applicants' : 'my-analysis'}`;
}
export function ownedProjects(projects: AnalysisProject[], actor: ProjectActor | null) {
  return projects
    .filter((p) => actor && p.ownerId === actor.id && p.role === actor.role)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
}
export function parseProjects(raw: string): ProjectDB {
  return projectDBSchema.parse(JSON.parse(raw));
}
export function deriveCriteria(
  text: string,
  jobProfile?: JobProfileId,
  sectionAware = false,
): ProjectCriterion[] {
  if (sectionAware) {
    const criteria = deriveCriteria(text, jobProfile);
    let section: SectionKey = 'other';
    const requiredLines = text.split('\n').filter((line) => {
      const heading = sectionHeading(line);
      if (heading) {
        section = heading;
        return false;
      }
      return section === 'requirements';
    });
    return criteria.map((criterion) => ({
      ...criterion,
      required: requiredLines.some((line) =>
        criterion.keywords.some((keyword) => containsKeyword(line, keyword)),
      ),
    }));
  }
  if (jobProfile) return deriveJobCriteria(text, jobProfile);
  const base = generateCriteria('project', text)
    .filter((c) => c.keywords.some((k) => containsKeyword(text, k)))
    .map((c) => ({
      id: crypto.randomUUID(),
      name: c.name,
      description: c.description,
      keywords: c.keywords.filter((k) => containsKeyword(text, k)),
      required: c.required,
    }));
  const additions = [
    { name: '학사 이상', keywords: ['학사', '대학교', '대졸'] },
    { name: '컴퓨터활용능력 2급', keywords: ['컴퓨터활용능력 2급', '컴활 2급'] },
    { name: '데이터 분석 경험', keywords: ['데이터 분석', '설문', '분석 방법'] },
    { name: '마케팅 경험', keywords: ['마케팅', '캠페인', '전환율'] },
  ];
  for (const c of additions)
    if (c.keywords.some((k) => containsKeyword(text, k)))
      base.push({
        ...c,
        id: crypto.randomUUID(),
        required: true,
        description: `JD의 ${c.name} 조건과 직접 연결되는 근거를 확인합니다.`,
      });
  return base;
}
export function validateDraft(draft: ProjectDraft, actor: ProjectActor) {
  if (draft.jobProfile && !getJobProfile(draft.jobProfile))
    throw new Error('분석 직무를 확인해 주세요.');
  if (!draft.title.trim()) throw new Error('프로젝트 이름을 입력해 주세요.');
  if (draft.jd.text.trim().length < 20)
    throw new Error('분석할 JD 본문을 20자 이상 입력해 주세요.');
  if (draft.jd.mode === 'url') {
    try {
      const u = new URL(draft.jd.reference);
      if (!['https:', 'http:'].includes(u.protocol)) throw new Error();
    } catch {
      throw new Error('올바른 채용공고 URL을 입력해 주세요.');
    }
  }
  if (draft.jd.mode === 'image' && !draft.jd.imageName)
    throw new Error('JD 이미지를 선택해 주세요.');
  if (
    !draft.criteria.length ||
    draft.criteria.some((c) => !c.name.trim() || !c.keywords.some((k) => k.trim()))
  )
    throw new Error('JD 평가 기준과 확인할 키워드를 입력해 주세요.');
  if (draft.criteria.length > MAX_ANALYSIS_CRITERIA)
    throw new Error(`평가 기준은 최대 ${MAX_ANALYSIS_CRITERIA}개까지 등록할 수 있습니다.`);
  if (!draft.documents.some((d) => d.status === 'ready' && d.pages.some((p) => p.text.trim())))
    throw new Error('텍스트를 읽을 수 있는 서류를 한 개 이상 등록해 주세요.');
  if (draft.documents.length > 20) throw new Error('한 번에 최대 20개 파일을 등록할 수 있습니다.');
  if (
    draft.documents.some((d) => !draft.people.some((p) => p.id === d.applicantId && p.name.trim()))
  )
    throw new Error('각 서류의 지원자를 지정해 주세요.');
  if (actor.role === 'applicant' && new Set(draft.documents.map((d) => d.applicantId)).size !== 1)
    throw new Error('구직자는 본인의 서류만 하나의 묶음으로 분석할 수 있습니다.');
}
export async function processDraft(
  draft: ProjectDraft,
  actor: ProjectActor,
  previous: AnalysisProject | undefined,
  onStage: (stage: number) => void,
  evaluate: CandidateEvaluator = actor.role === 'recruiter' || draft.jobProfile
    ? new ServerKeywordEvaluator()
    : new MockCandidateEvaluator(),
): Promise<AnalysisProject> {
  validateDraft(draft, actor);
  if (previous && (previous.ownerId !== actor.id || previous.role !== actor.role))
    throw new Error('접근할 수 없는 프로젝트입니다.');
  if (previous && JSON.stringify(previous.jd) !== JSON.stringify(draft.jd))
    throw new Error('재분석은 기존 JD를 사용합니다. 다른 공고는 새 프로젝트로 만들어 주세요.');
  if (
    previous &&
    (previous.jobProfile !== draft.jobProfile ||
      previous.profileCatalogVersion !== draft.profileCatalogVersion)
  )
    throw new Error(
      '재분석은 기존 직무와 평가 목록 버전을 사용합니다. 다른 직무는 새 프로젝트로 만들어 주세요.',
    );
  if (
    previous &&
    (previous.id !== draft.id ||
      JSON.stringify(previous.criteria) !== JSON.stringify(draft.criteria))
  )
    throw new Error(
      '기존 프로젝트의 기준으로 재분석해 주세요. 기준이 다른 분석은 새 프로젝트로 만드세요.',
    );
  onStage(0);
  await new Promise((resolve) => setTimeout(resolve, 150));
  const weights = draft.jobProfile
    ? allocateProfileWeights(draft.criteria.map((c) => c.weight ?? 10))
    : draft.criteria.map(
        (_, i) =>
          Math.floor(100 / draft.criteria.length) + (i < 100 % draft.criteria.length ? 1 : 0),
      );
  const criteria: EvaluationCriterion[] = draft.criteria.map((c, i) => ({
    ...c,
    jobId: draft.id,
    category: '기술 역량',
    weight: weights[i],
  }));
  const job: Job = {
    id: draft.id,
    title: draft.title,
    companyName: '',
    role: draft.jobProfile ?? '',
    profileCatalogVersion:
      draft.profileCatalogVersion ?? (draft.jobProfile ? JOB_PROFILE_CATALOG_VERSION : undefined),
    description: draft.jd.text,
    createdAt: new Date().toISOString(),
    location: '',
    employmentType: '',
    minExperience: 0,
  };
  onStage(1);
  const analyses = [];
  const people = draft.people.filter((p) => draft.documents.some((d) => d.applicantId === p.id));
  for (const person of people) {
    const documents = draft.documents.filter((d) => d.applicantId === person.id);
    const readable = documents.filter((d) => d.status === 'ready');
    const text = readable.flatMap((d) => d.pages.flatMap((p) => evidenceLines(p.text))).join('\n');
    const application: Application = {
      id: crypto.randomUUID(),
      candidateId: person.id,
      jobId: draft.id,
      experience: person.experience,
      skills: text,
      projects: text,
      introduction: text,
      motivation: '',
      collaboration: text,
      additionalExperience: '',
      createdAt: new Date().toISOString(),
      status: 'NEW',
    };
    const evaluation = await evaluate.evaluate(job, criteria, application);
    const results: ProjectResult[] = draft.criteria.map((c) => {
      const item = evaluation.items.find((i) => i.criterionId === c.id)!;
      const evidenceRank = (excerpt: string) =>
        (excerpt === item.evidence ? 100 : 0) +
        (/구현|개발|담당|설계|개선|운영|수행|분석했|검증/.test(excerpt) ? 10 : 0) +
        (/\d|%/.test(excerpt) ? 1 : 0);
      const sources = readable
        .flatMap((d) =>
          d.pages.flatMap((page) =>
            evidenceLines(page.text)
              .filter((line) =>
                item.keywordMatches
                  ? item.keywordMatches.some((m) => m.relation !== 'NONE' && m.evidence === line)
                  : c.keywords.some((k) => containsKeyword(line, k)),
              )
              .map((excerpt) => ({
                documentId: d.id,
                filename: d.filename,
                page: page.number,
                excerpt: excerpt.trim(),
              })),
          ),
        )
        .sort((a, b) => evidenceRank(b.excerpt) - evidenceRank(a.excerpt))
        .slice(0, 5);
      const confirmed = draft.jobProfile
        ? (item.evidenceLevel !== undefined
            ? item.evidenceLevel / 4
            : item.score / item.maxScore) >= (c.minimumRatio ?? 0.5)
        : ['Strong', 'Good'].includes(item.level);
      const incomplete = documents.some(
        (d) => d.status === 'failed' || Boolean(d.unreadablePages?.length),
      );
      const status =
        !readable.length || (!sources.length && incomplete)
          ? 'unreadable'
          : !sources.length
            ? 'missing'
            : confirmed
              ? 'confirmed'
              : 'review';
      return {
        criterionId: c.id,
        ...(item.keywordMatches ? { keywordMatches: item.keywordMatches } : {}),
        score: item.score,
        maxScore: item.maxScore,
        ...(item.evidenceLevel !== undefined ? { evidenceLevel: item.evidenceLevel } : {}),
        mentioned: sources.length > 0,
        reading: item.keywordMatches
          ? item.keywordMatches.some((m) => m.relation !== 'NONE')
            ? 'O'
            : '-'
          : status === 'confirmed'
            ? 'O'
            : '-',
        status,
        sources,
        reason:
          status === 'unreadable'
            ? '읽지 못한 서류가 있어 이 항목을 확인할 수 없습니다. 파일을 교체해 주세요.'
            : status === 'missing'
              ? item.keywordMatches
                ? item.reason
                : '읽은 서류에서 해당 내용의 기재를 찾지 못했습니다. 능력이 없다는 뜻은 아닙니다.'
              : item.reason,
      };
    });
    const confirmed = results
      .filter((r) => r.status === 'confirmed')
      .map((r) => draft.criteria.find((c) => c.id === r.criterionId)!.name);
    const unclear = results
      .filter((r) => r.status !== 'confirmed')
      .map((r) => draft.criteria.find((c) => c.id === r.criterionId)!.name);
    analyses.push({
      id: application.id,
      evaluatorVersion: evaluation.evaluatorVersion,
      personId: person.id,
      registeredAt:
        documents
          .map((d) => d.registeredAt ?? '')
          .sort()
          .at(-1) ?? '',
      name: person.name,
      birthDate: person.birthDate,
      score: evaluation.totalScore,
      results,
      summary: `${confirmed.length ? `${confirmed.slice(0, 2).join(', ')}의 ${actor.role === 'recruiter' ? '관련 키워드' : '수행 근거'}가 확인됩니다.` : '관련 경험의 근거를 추가로 확인해 주세요.'} ${unclear.length ? `${unclear.slice(0, 2).join(', ')}는 추가 확인이 필요합니다.` : '등록된 기준마다 관련 근거가 있습니다.'}`,
    });
  }
  onStage(2);
  const revision: ProjectRevision = {
    id: crypto.randomUUID(),
    number: (previous?.revisions.length ?? 0) + 1,
    createdAt: new Date().toISOString(),
    status: draft.documents.some((d) => d.status === 'failed' || Boolean(d.unreadablePages?.length))
      ? 'partial'
      : 'success',
    documents: structuredClone(draft.documents),
    people: structuredClone(people),
    analyses,
    taskType: actor.role === 'recruiter' ? 'summary' : 'analysis',
  };
  await new Promise((resolve) => setTimeout(resolve, 150));
  return {
    interviewPrompt: draft.interviewPrompt ?? '',
    id: draft.id,
    title: draft.title.trim(),
    ownerId: actor.id,
    role: actor.role,
    ...(draft.jobProfile
      ? { jobProfile: draft.jobProfile, profileCatalogVersion: job.profileCatalogVersion }
      : {}),
    createdAt: previous?.createdAt ?? new Date().toISOString(),
    jd: structuredClone(draft.jd),
    criteria: structuredClone(draft.criteria),
    revisions: [...(previous?.revisions ?? []), revision],
  };
}
export function saveProject(
  db: ProjectDB,
  project: AnalysisProject,
  expectedRevisionCount: number,
): ProjectDB {
  if (!db.actor || db.actor.id !== project.ownerId || db.actor.role !== project.role)
    throw new Error('로그인 정보를 다시 확인해 주세요.');
  const current = db.projects.find((p) => p.id === project.id);
  if (current && (current.ownerId !== db.actor.id || current.role !== db.actor.role))
    throw new Error('접근할 수 없는 프로젝트입니다.');
  if ((current?.revisions.length ?? 0) !== expectedRevisionCount)
    throw new Error('다른 분석이 먼저 저장됐습니다. 최신 결과를 열고 다시 시도해 주세요.');
  const saved = { ...project, ...(current?.interviews ? { interviews: current.interviews } : {}) };
  return { ...db, projects: [...db.projects.filter((p) => p.id !== project.id), saved] };
}
export function revisionDraft(project: AnalysisProject): ProjectDraft {
  const revision = project.revisions.at(-1)!;
  return structuredClone({
    interviewPrompt: project.interviewPrompt ?? '',
    id: project.id,
    title: project.title,
    jd: project.jd,
    criteria: project.criteria,
    ...(project.jobProfile
      ? { jobProfile: project.jobProfile, profileCatalogVersion: project.profileCatalogVersion }
      : {}),
    documents: revision.documents,
    people: revision.people,
  });
}
