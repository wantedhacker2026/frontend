import { z } from 'zod';
import type { Database } from '@/types';
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
  version: z.literal(1),
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
  const db = schema.parse(JSON.parse(raw));
  for (const job of db.jobs) {
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
  return db;
}
