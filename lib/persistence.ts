import { z } from 'zod';
import type { Database } from '@/types';
import { applicationContent, applicationInputSchema } from './resumes';
const str = z.string();
const num = z.number().finite();
const category = z.enum(['기술 역량', '경험', '협업', '우대사항']);
const actionType = z.enum([
  'CERTIFICATION',
  'INTERNSHIP',
  'PROJECT',
  'TEAM_PROJECT',
  'RESUME_IMPROVEMENT',
  'PORTFOLIO',
  'LEARNING',
]);
const schema = z.object({
  version: z.union([z.literal(1), z.literal(2)]),
  resumes: z
    .array(
      z.object({
        id: str,
        title: str.trim().min(1).max(80),
        content: applicationInputSchema,
        revision: num.int().min(1),
        createdAt: z.iso.datetime(),
        updatedAt: z.iso.datetime(),
      }),
    )
    .optional(),
  jobs: z.array(
    z.object({
      id: str,
      companyName: str,
      title: str,
      role: str,
      description: str,
      createdAt: z.iso.datetime(),
      location: str,
      employmentType: str,
      minExperience: num.min(0),
    }),
  ),
  criteria: z.array(
    z.object({
      id: str,
      jobId: str,
      category,
      name: str,
      description: str,
      weight: num.int().min(1).max(100),
      required: z.boolean(),
      keywords: z.array(str),
    }),
  ),
  candidates: z.array(z.object({ id: str, name: str, email: str })),
  applications: z.array(
    z.object({
      id: str,
      candidateId: str,
      jobId: str,
      experience: num.min(0),
      skills: str,
      projects: str,
      introduction: str,
      motivation: str,
      collaboration: str,
      additionalExperience: str,
      createdAt: z.iso.datetime(),
      status: z.enum(['NEW', 'REVIEWED', 'SHORTLISTED']),
      resumeSource: z.object({ versionId: str, title: str, revision: num.int().min(1) }).optional(),
    }),
  ),
  evaluations: z.array(
    z.object({
      id: str,
      applicationId: str,
      totalScore: num.min(0).max(100),
      summary: str,
      recommendation: str,
      requiredMet: z.boolean(),
      categoryScores: z.object({ '기술 역량': num, 경험: num, 협업: num, 우대사항: num }),
      items: z.array(
        z.object({
          id: str,
          evaluationId: str,
          criterionId: str,
          score: num,
          maxScore: num,
          level: z.enum(['Strong', 'Good', 'Partial', 'Unverified']),
          evidence: str.nullable(),
          reason: str,
        }),
      ),
      actions: z.array(
        z.object({
          id: str,
          evaluationId: str,
          criterionId: str,
          type: actionType,
          title: str,
          description: str,
          reason: str,
          priority: num,
          estimatedScoreImpact: num,
          links: z.array(z.object({ label: str, resourceType: actionType })),
        }),
      ),
      evaluatedAt: z.iso.datetime(),
      evaluatorVersion: str,
    }),
  ),
  completedActionIds: z.array(str),
  ownApplicationIds: z.array(str),
});
export const STORAGE_KEY = 'shortlist-demo-v1';
export function parseDatabase(raw: string): Database {
  const saved = schema.parse(JSON.parse(raw));
  if (saved.version === 2 && !saved.resumes)
    throw new Error('지원서 버전 데이터를 찾을 수 없습니다.');
  const db: Database = { ...saved, version: 2, resumes: saved.resumes ?? [] };
  for (const job of db.jobs) {
    // Rename only legacy demo branding; keep user-authored jobs and submissions intact.
    if (
      ['backend', 'frontend', 'data'].includes(job.id) &&
      job.companyName === 'Shortlist Studio'
    ) {
      job.companyName = 'wantedhacker';
      job.description = job.description.replace('Shortlist Studio에서', 'wantedhacker에서');
    }
    const criteria = db.criteria.filter((c) => c.jobId === job.id);
    if (!criteria.length || criteria.reduce((sum, c) => sum + c.weight, 0) !== 100)
      throw new Error('평가 기준 데이터가 올바르지 않습니다.');
  }
  for (const app of db.applications) {
    if (
      !db.jobs.some((j) => j.id === app.jobId) ||
      !db.candidates.some((c) => c.id === app.candidateId) ||
      !db.evaluations.some((e) => e.applicationId === app.id)
    )
      throw new Error('지원서 데이터 연결을 확인할 수 없습니다.');
  }
  if (saved.version === 1) {
    // Keep the same storage key and migrate only the user's submissions, never seeded candidates.
    for (const app of db.applications.filter((a) => db.ownApplicationIds.includes(a.id))) {
      const candidate = db.candidates.find((c) => c.id === app.candidateId)!;
      const content = applicationContent(app, candidate);
      // Older releases allowed optional email text. Preserve the original submission in all cases.
      const valid = applicationInputSchema.safeParse(content);
      if (!valid.success) continue;
      const job = db.jobs.find((j) => j.id === app.jobId)!;
      const id = `resume-import-${app.id}`;
      const title = `${job.title} · 기존 지원서`.slice(0, 80);
      db.resumes.push({
        id,
        title,
        content: valid.data,
        revision: 1,
        createdAt: app.createdAt,
        updatedAt: app.createdAt,
      });
      app.resumeSource = { versionId: id, title, revision: 1 };
    }
  }
  if (new Set(db.resumes.map((r) => r.id)).size !== db.resumes.length)
    throw new Error('중복된 지원서 버전이 있습니다.');
  return db;
}
