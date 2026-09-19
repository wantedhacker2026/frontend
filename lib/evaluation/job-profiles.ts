import { z } from 'zod';
import catalog from '@/data/evaluation/job-profiles.json';
import { containsKeyword } from '@/data/mock/criteria';

export const jobProfileIdSchema = z.enum([
  'backend',
  'frontend',
  'mobile',
  'data-ai',
  'infra-devops',
  'qa',
  'product-pm',
  'project-pm',
  'service-planning',
  'product-design',
  'presales',
  'customer-success',
]);
export type JobProfileId = z.infer<typeof jobProfileIdSchema>;
const catalogSchema = z.object({
  version: z.string(),
  profiles: z.array(
    z.object({
      id: jobProfileIdSchema,
      name: z.string(),
      scoringMode: z.enum(['keyword', 'technical-evidence', 'evidence']),
      criteria: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          weight: z.number().int().positive(),
          keywords: z.array(z.string()),
          relatedKeywords: z.array(z.string()),
          keywordRelations: z.record(z.string(), z.array(z.string())).optional(),
          evidenceGuide: z.string(),
        }),
      ),
    }),
  ),
});
const parsed = catalogSchema.parse(catalog);
export const JOB_PROFILE_CATALOG_VERSION = parsed.version;
export const jobProfiles = parsed.profiles;
export function getJobProfile(id?: string) {
  return jobProfiles.find((profile) => profile.id === id);
}

export function allocateProfileWeights(weights: number[]): number[] {
  if (!weights.length || weights.length > 50 || weights.some((w) => !Number.isFinite(w) || w <= 0))
    throw new Error('직무 평가 배점을 확인해 주세요.');
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const scaled = weights.map((weight) => (weight * 100) / total);
  const assigned = scaled.map((weight) => Math.max(1, Math.floor(weight)));
  let remaining = 100 - assigned.reduce((sum, weight) => sum + weight, 0);
  while (remaining !== 0) {
    const direction = remaining > 0 ? 1 : -1;
    const candidates = assigned.map((_, i) => i).filter((i) => direction > 0 || assigned[i] > 1);
    const index = candidates.reduce((best, i) =>
      direction * (scaled[i] - assigned[i]) > direction * (scaled[best] - assigned[best])
        ? i
        : best,
    );
    assigned[index] += direction;
    remaining -= direction;
  }
  return assigned;
}

export function deriveJobCriteria(text: string, profileId: JobProfileId) {
  const profile = getJobProfile(profileId)!;
  return profile.criteria.flatMap((criterion) => {
    const keywords = [...new Set([...criterion.keywords, ...criterion.relatedKeywords])].filter(
      (keyword) => containsKeyword(text, keyword),
    );
    if (!keywords.length) return [];
    let section: 'required' | 'preferred' | undefined;
    let required = false;
    let preferred = false;
    const sections: { kind: typeof section; lines: string[] }[] = [];
    for (const line of text.split('\n')) {
      if (/우대\s*사항|우대\s*조건|preferred/i.test(line)) section = 'preferred';
      else if (/자격\s*요건|지원\s*자격|필수\s*조건|필수\s*역량|requirements/i.test(line))
        section = 'required';
      else if (/주요\s*업무|기술\s*스택|일하는\s*방식/.test(line)) section = undefined;
      if (!sections.length || sections.at(-1)!.kind !== section)
        sections.push({ kind: section, lines: [] });
      sections.at(-1)!.lines.push(line);
    }
    for (const block of sections) {
      if (keywords.some((keyword) => containsKeyword(block.lines.join('\n'), keyword))) {
        if (block.kind === 'required') required = true;
        if (block.kind === 'preferred') preferred = true;
      }
    }
    return [
      {
        id: crypto.randomUUID(),
        catalogCriterionId: criterion.id,
        name: criterion.name,
        description: criterion.evidenceGuide,
        keywords,
        weight: criterion.weight,
        required: required || !preferred,
      },
    ];
  });
}
