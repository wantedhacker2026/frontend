import type { ProjectRevision } from '../projects/types';
import type { InterviewInput, InterviewQuestion } from './types';

export type InterviewSource = InterviewQuestion['sources'][number];
export type EvidenceContext = { revision: ProjectRevision; personId: string };

// Do not resolve a stored citation against another applicant or an unreadable page.
export function resolveInterviewSource(context: EvidenceContext, source: InterviewSource) {
  const document = context.revision.documents.find(
    (doc) =>
      doc.id === source.documentId &&
      doc.applicantId === context.personId &&
      doc.status === 'ready',
  );
  if (!document || document.unreadablePages?.includes(source.page) || !source.excerpt.trim())
    return null;
  const page = document.pages.find((p) => p.number === source.page);
  if (!page) return null;
  const start = page.text.indexOf(source.excerpt);
  if (start < 0) return null;
  return {
    source: { ...source, filename: document.filename },
    before: page.text.slice(0, start),
    excerpt: source.excerpt,
    after: page.text.slice(start + source.excerpt.length),
  };
}

export function interviewSourceKey(source: InterviewSource) {
  return JSON.stringify([source.documentId, source.page, source.excerpt]);
}

export function careerEvidenceRows(
  context: EvidenceContext,
  topics: NonNullable<InterviewInput['experienceTopics']>,
  questions: InterviewQuestion[],
) {
  const rows = new Map<
    string,
    {
      key: string;
      source: InterviewSource;
      questions: { number: number; question: InterviewQuestion }[];
    }
  >();
  for (const topic of topics) {
    for (const source of topic.sources) {
      const resolved = resolveInterviewSource(context, source);
      if (!resolved) continue;
      const key = interviewSourceKey(resolved.source);
      if (rows.has(key)) continue;
      rows.set(key, {
        key,
        source: resolved.source,
        // Match the actual cited source, not just a topic ID or a keyword overlap.
        questions: questions.flatMap((question, i) =>
          question.sources.some((s) => interviewSourceKey(s) === key)
            ? [{ number: i + 1, question }]
            : [],
        ),
      });
    }
  }
  return [...rows.values()];
}
