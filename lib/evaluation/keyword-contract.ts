import { z } from 'zod';
import { MAX_ANALYSIS_CRITERIA } from './limits';
import { jobProfileIdSchema } from './job-profiles';

export const keywordMatchSchema = z.object({
  jdKeyword: z.string(),
  relation: z.enum(['DIRECT', 'RELATED', 'NONE']),
  matchedKeyword: z.string().nullable(),
  evidence: z.string().nullable(),
});
export type KeywordMatch = z.infer<typeof keywordMatchSchema>;
export const keywordRequestSchema = z.object({
  jobProfile: jobProfileIdSchema.optional(),
  catalogVersion: z.string().max(100).optional(),
  criteria: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(200),
        catalogCriterionId: z.string().min(1).max(100).optional(),
        keywords: z.array(z.string().trim().min(1).max(100)).min(1).max(30),
      }),
    )
    .min(1)
    .max(MAX_ANALYSIS_CRITERIA)
    .refine((items) => new Set(items.map((i) => i.id)).size === items.length),
  text: z.string().max(500_000),
});
export const keywordResponseSchema = z.object({
  version: z.string().min(1),
  results: z.array(
    z.object({
      criterionId: z.string(),
      related: z.boolean(),
      evidenceLevel: z.number().int().min(0).max(4).nullable().optional(),
      evidence: z.string().nullable().optional(),
      matches: z.array(keywordMatchSchema),
    }),
  ),
});
