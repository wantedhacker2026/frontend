import { z } from 'zod';
import { keywordMatchSchema } from '@/lib/evaluation/keyword-contract';
import { jobProfileIdSchema } from '@/lib/evaluation/job-profiles';
export const actorSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  role: z.enum(['recruiter', 'applicant']),
  provider: z.string(),
});
export type ProjectActor = z.infer<typeof actorSchema>;
export const documentSchema = z.object({
  id: z.string(),
  applicantId: z.string(),
  registeredAt: z.string().optional(),
  filename: z.string(),
  size: z.number().nonnegative(),
  status: z.enum(['ready', 'failed']),
  error: z.string().optional(),
  unreadablePages: z.array(z.number().int().positive()).optional(),
  pages: z
    .array(z.object({ number: z.number().int().positive(), text: z.string().max(100000) }))
    .max(30),
  source: z.enum(['pdf', 'text', 'resume', 'demo']),
});
export type ProjectDocument = z.infer<typeof documentSchema>;
export const personSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(80),
  birthDate: z.string(),
  experience: z.number().min(0).max(80),
});
export type ProjectPerson = z.infer<typeof personSchema>;
export const criterionSchema = z.object({
  core: z.boolean().optional(),
  minimumRatio: z
    .union([z.literal(0.25), z.literal(0.5), z.literal(0.75), z.literal(1)])
    .optional(),
  catalogCriterionId: z.string().optional(),
  weight: z.number().int().min(1).max(100).optional(),
  id: z.string(),
  name: z.string().min(1),
  keywords: z.array(z.string().min(1)).min(1),
  required: z.boolean(),
  description: z.string(),
});
export type ProjectCriterion = z.infer<typeof criterionSchema>;
export const sourceSchema = z.object({
  documentId: z.string(),
  filename: z.string(),
  page: z.number(),
  excerpt: z.string(),
});
export type ProjectSource = z.infer<typeof sourceSchema>;
const resultSchema = z.object({
  score: z.number().optional(),
  maxScore: z.number().optional(),
  evidenceLevel: z.number().int().min(0).max(4).optional(),
  keywordMatches: z.array(keywordMatchSchema).optional(),
  criterionId: z.string(),
  mentioned: z.boolean(),
  reading: z.enum(['O', '-']),
  status: z.enum(['confirmed', 'review', 'missing', 'unreadable']),
  reason: z.string(),
  sources: z.array(sourceSchema),
});
export type ProjectResult = z.infer<typeof resultSchema>;
const analysisSchema = z.object({
  evaluatorVersion: z.string().optional(),
  id: z.string(),
  personId: z.string(),
  registeredAt: z.string().optional(),
  name: z.string(),
  birthDate: z.string(),
  score: z.number(),
  summary: z.string(),
  results: z.array(resultSchema),
});
export type ProjectAnalysis = z.infer<typeof analysisSchema>;
export const revisionSchema = z.object({
  id: z.string(),
  number: z.number().int().positive(),
  createdAt: z.string(),
  status: z.enum(['success', 'partial']),
  documents: z.array(documentSchema),
  people: z.array(personSchema),
  analyses: z.array(analysisSchema),
  taskType: z.enum(['summary', 'analysis']),
});
export type ProjectRevision = z.infer<typeof revisionSchema>;
export const jdSchema = z.object({
  mode: z.enum(['text', 'url', 'image']),
  reference: z.string(),
  text: z.string().max(30000),
  imageName: z.string().optional(),
});
export type ProjectJD = z.infer<typeof jdSchema>;
export const projectSchema = z.object({
  jobProfile: jobProfileIdSchema.optional(),
  profileCatalogVersion: z.string().optional(),
  id: z.string(),
  ownerId: z.string(),
  role: z.enum(['recruiter', 'applicant']),
  title: z.string(),
  createdAt: z.string(),
  jd: jdSchema,
  criteria: z.array(criterionSchema).min(1),
  revisions: z.array(revisionSchema).min(1),
});
export type AnalysisProject = z.infer<typeof projectSchema>;
export interface ProjectDraft {
  jobProfile?: z.infer<typeof jobProfileIdSchema>;
  profileCatalogVersion?: string;
  id: string;
  title: string;
  jd: ProjectJD;
  criteria: ProjectCriterion[];
  documents: ProjectDocument[];
  people: ProjectPerson[];
}
export const projectDBSchema = z.object({
  version: z.literal(1),
  actor: actorSchema.nullable(),
  projects: z.array(projectSchema),
});
export type ProjectDB = z.infer<typeof projectDBSchema>;
