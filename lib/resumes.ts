import { z } from 'zod';
import type {
  Application,
  ApplicationInput,
  Candidate,
  Database,
  Evaluation,
  ResumeSource,
  ResumeVersion,
} from '@/types';
import { uid } from './utils';

const requiredText = (max: number) =>
  z.string().trim().min(1, '필수 항목을 입력해 주세요.').max(max);
export const applicationInputSchema = z.object({
  name: requiredText(50),
  email: z.union([z.literal(''), z.email()]),
  experience: z.number().finite().min(0).max(60),
  skills: requiredText(500),
  projects: requiredText(8000),
  introduction: requiredText(8000),
  motivation: requiredText(8000),
  collaboration: requiredText(8000),
  additionalExperience: z.string().max(8000),
});

export const blankApplication: ApplicationInput = {
  name: '',
  email: '',
  experience: 0,
  skills: '',
  projects: '',
  introduction: '',
  motivation: '',
  collaboration: '',
  additionalExperience: '',
};

// Explicit field selection prevents submission metadata leaking into a reusable version.
export function applicationContent(
  application: Application,
  candidate: Candidate,
): ApplicationInput {
  return {
    name: candidate.name,
    email: candidate.email,
    experience: application.experience,
    skills: application.skills,
    projects: application.projects,
    introduction: application.introduction,
    motivation: application.motivation,
    collaboration: application.collaboration,
    additionalExperience: application.additionalExperience,
  };
}

export function saveResumeVersion(
  db: Database,
  title: string,
  input: ApplicationInput,
  existingId?: string,
): { db: Database; resume: ResumeVersion } {
  const name = title.trim();
  if (!name || name.length > 80) throw new Error('버전 이름을 1~80자로 입력해 주세요.');
  const parsed = applicationInputSchema.safeParse({ ...input, email: input.email.trim() });
  if (!parsed.success) throw new Error('이름, 경력, 이메일과 필수 경험 항목을 확인해 주세요.');
  const previous = existingId ? db.resumes.find((r) => r.id === existingId) : undefined;
  if (existingId && !previous) throw new Error('수정할 지원서 버전을 찾을 수 없습니다.');
  const now = new Date().toISOString();
  const resume: ResumeVersion = {
    id: previous?.id ?? uid('resume'),
    title: name,
    content: parsed.data,
    revision: (previous?.revision ?? 0) + 1,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
  return {
    db: { ...db, resumes: [resume, ...db.resumes.filter((r) => r.id !== resume.id)] },
    resume,
  };
}

export function duplicateResumeVersion(db: Database, id: string) {
  const source = db.resumes.find((r) => r.id === id);
  if (!source) throw new Error('복제할 지원서 버전을 찾을 수 없습니다.');
  const base = source.title.slice(0, 64);
  let title = `${base} · 복사본`;
  let number = 2;
  while (db.resumes.some((r) => r.title === title)) title = `${base} · 복사본 ${number++}`;
  return saveResumeVersion(db, title, source.content);
}

export function removeResumeVersion(db: Database, id: string): Database {
  // Submitted contents and labels are snapshots and survive deleting the reusable source.
  return { ...db, resumes: db.resumes.filter((r) => r.id !== id) };
}

export function prepareSubmission(
  db: Database,
  jobId: string,
  input: ApplicationInput,
  existingId?: string,
  resumeSource?: ResumeSource,
) {
  const job = db.jobs.find((j) => j.id === jobId);
  if (!job) throw new Error('공고를 찾을 수 없습니다.');
  const parsed = applicationInputSchema.safeParse({ ...input, email: input.email.trim() });
  if (!parsed.success) throw new Error('필수 입력값과 이메일 형식을 확인해 주세요.');
  const existing = existingId
    ? db.applications.find((a) => a.id === existingId && a.jobId === jobId)
    : undefined;
  if (existingId && !existing) throw new Error('수정할 지원서를 찾을 수 없습니다.');
  const { name, email, ...content } = parsed.data;
  const candidate: Candidate = { id: existing?.candidateId ?? uid('candidate'), name, email };
  const application: Application = {
    ...content,
    id: existing?.id ?? uid('application'),
    candidateId: candidate.id,
    jobId,
    status: 'NEW',
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    ...(resumeSource ? { resumeSource: { ...resumeSource } } : {}),
  };
  return { job, candidate, application };
}

export function prepareResumeSubmission(db: Database, jobId: string, resumeId: string) {
  const resume = db.resumes.find((r) => r.id === resumeId);
  if (!resume)
    throw new Error('지원서 버전이 삭제되었거나 존재하지 않습니다. 다른 버전을 선택해 주세요.');
  return prepareSubmission(db, jobId, resume.content, undefined, {
    versionId: resume.id,
    title: resume.title,
    revision: resume.revision,
  });
}

export function recordSubmission(
  db: Database,
  candidate: Candidate,
  application: Application,
  evaluation: Evaluation,
): Database {
  const previousActionIds =
    db.evaluations.find((e) => e.applicationId === application.id)?.actions.map((a) => a.id) ?? [];
  return {
    ...db,
    candidates: [...db.candidates.filter((c) => c.id !== candidate.id), candidate],
    applications: [...db.applications.filter((a) => a.id !== application.id), application],
    evaluations: [...db.evaluations.filter((e) => e.applicationId !== application.id), evaluation],
    completedActionIds: db.completedActionIds.filter((id) => !previousActionIds.includes(id)),
    ownApplicationIds: Array.from(new Set([...db.ownApplicationIds, application.id])),
  };
}
