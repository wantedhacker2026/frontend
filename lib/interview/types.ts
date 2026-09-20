import { z } from 'zod';

const experienceFactSchema = z.object({
  value: z.string().min(1).max(160),
  evidenceId: z.string().min(1).max(240),
});
export const experienceContextSchema = z.object({
  experienceId: z.string().min(1).max(200),
  activityType: z.enum([
    'community-operation',
    'software-development',
    'service-operation',
    'planning',
    'project-management',
    'research',
    'design',
    'collaboration',
    'other',
    'unclear',
  ]),
  status: z.enum(['clear', 'uncertain', 'non-career']),
  target: experienceFactSchema.nullable(),
  action: experienceFactSchema.nullable(),
  role: experienceFactSchema.nullable(),
  participants: experienceFactSchema.nullable(),
  scale: experienceFactSchema.nullable(),
  scaleMeaning: z.enum(['participants', 'team-members', 'users', 'other', 'unknown']),
});
export type ExperienceContext = z.infer<typeof experienceContextSchema>;

export const interviewSourceSchema = z.object({
  documentId: z.string(),
  filename: z.string(),
  page: z.number().int().positive(),
  excerpt: z.string().min(1).max(2000),
});
export const interviewTopicSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  jdEvidence: z.string().max(1500),
  evidence: z.enum(['jd-only', 'confirmed', 'review', 'missing', 'unreadable']),
  sources: z.array(interviewSourceSchema).max(2),
});
// Only job-related context crosses the generation boundary; no scores, names or private notes.
export const interviewInputSchema = z.object({
  sourceScope: z.literal('career'),
  prompt: z.string().max(2000).optional(),
  role: z.enum(['applicant', 'recruiter']),
  topics: z.array(interviewTopicSchema).min(1).max(30),
  experienceTopics: z
    .array(
      interviewTopicSchema.extend({
        careerContext: z.string().max(3000).optional(),
        sources: z.array(interviewSourceSchema).min(1).max(2),
      }),
    )
    .max(12)
    .optional(),
  priorityIds: z.array(z.string()).max(30),
  personalized: z.boolean(),
});
export type InterviewInput = z.infer<typeof interviewInputSchema>;
export const questionSchema = z.object({
  id: z.string(),
  topicId: z.string(),
  topic: z.string(),
  kind: z.enum(['common', 'personal']),
  question: z.string().trim().min(1).max(1000),
  reason: z.string().max(1500),
  jdEvidence: z.string().max(1500),
  sources: z.array(interviewSourceSchema).max(2),
  // Optional for previously saved packets. Original source text is never supplied by AI.
  evidenceIds: z.array(z.string()).max(2).optional(),
  grounding: z.enum(['verified', 'fallback']).optional(),
  context: experienceContextSchema.optional(),
  followups: z.array(z.string().min(1).max(500)).min(1).max(3),
  guide: z.array(z.string().min(1).max(500)).min(1).max(4),
  note: z.string().max(10000),
  prepared: z.boolean(),
  edited: z.boolean(),
  assessment: z.enum(['not-asked', 'confirmed', 'partial', 'follow-up']),
});
export type InterviewQuestion = z.infer<typeof questionSchema>;
export const packetSchema = z.object({
  promptUsed: z.string().max(2000).optional(),
  key: z.string(),
  revisionId: z.string(),
  analysisId: z.string(),
  role: z.enum(['applicant', 'recruiter']),
  version: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string(),
  stage: z.enum(['preparing', 'ready', 'completed']),
  generation: z.enum(['template', 'ai']),
  notice: z.string(),
  questions: z.array(questionSchema).min(1).max(10),
});
export type InterviewPacket = z.infer<typeof packetSchema>;
export const generationSchema = z.object({
  generation: z.enum(['template', 'ai']),
  notice: z.string(),
  questions: z.array(questionSchema).max(10),
});
export type InterviewGeneration = z.infer<typeof generationSchema>;
