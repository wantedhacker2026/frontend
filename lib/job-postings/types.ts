import { z } from 'zod';

export const sectionLabels = {
  responsibilities: '주요 업무',
  requirements: '자격요건',
  preferred: '우대사항',
  techStack: '기술 스택',
  other: '기타 공고 내용',
} as const;
export type SectionKey = keyof typeof sectionLabels;
export const sectionsSchema = z.object({
  responsibilities: z.string().max(30000),
  requirements: z.string().max(30000),
  preferred: z.string().max(30000),
  techStack: z.string().max(30000),
  other: z.string().max(30000),
});
export const postingSchema = z.object({
  title: z.string().max(300),
  company: z.string().max(300),
  sourceUrl: z.string().url(),
  fetchedAt: z.string(),
  method: z.enum(['structured-data', 'html', 'rendered']),
  sections: sectionsSchema,
  warnings: z.array(z.string()),
});
export type JobPosting = z.infer<typeof postingSchema>;
export function emptySections(): JobPosting['sections'] {
  return { responsibilities: '', requirements: '', preferred: '', techStack: '', other: '' };
}
export function postingText(sections: JobPosting['sections']) {
  return (Object.keys(sectionLabels) as SectionKey[])
    .filter((key) => sections[key].trim())
    .map((key) => `${sectionLabels[key]}\n${sections[key].trim()}`)
    .join('\n\n');
}

/** Recognize headings, not incidental words in a sentence. Shared by import and evaluation. */
export function sectionHeading(line: string): SectionKey | undefined {
  const label = line.replace(/^[\s#•*\-\[【]+|[\s\]】:：]+$/g, '').trim();
  if (label.length > 90) return;
  if (
    /^(?:우대\s*(?:사항|조건)|이런\s*분이면\s*더\s*좋|preferred(?:\s+qualifications)?|nice\s+to\s+have|bonus)(?:\s|$|[!:：])/i.test(
      label,
    )
  )
    return 'preferred';
  if (
    /^(?:자격\s*요건|지원\s*자격|필수\s*(?:조건|역량|자격)|이런\s*분을\s*찾|requirements|(?:minimum|required|basic)\s+qualifications|qualifications|what\s+you(?:'|’)ll\s+bring)(?:\s|$|[!:：])/i.test(
      label,
    )
  )
    return 'requirements';
  if (
    /^(?:주요\s*업무|담당\s*업무|업무\s*내용|합류하면\s*함께|responsibilities|what\s+you(?:'|’)ll\s+do|the\s+role)(?:\s|$|[!:：])/i.test(
      label,
    )
  )
    return 'responsibilities';
  if (
    /(?:기술\s*스택|tech(?:nology)?\s*stack|기술\s*환경|개발\s*환경)$/i.test(label) ||
    /^(?:technical\s+)?skills?$/i.test(label)
  )
    return 'techStack';
  if (
    /^(?:기타\s*공고\s*내용|회사\s*소개|팀\s*소개|복리\s*후생|혜택|채용\s*절차|근무\s*조건|전형\s*절차|benefits|about\s+us|how\s+to\s+apply)(?:\s|$|[!:：])/i.test(
      label,
    )
  )
    return 'other';
}
