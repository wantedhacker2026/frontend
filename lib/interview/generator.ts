import { z } from 'zod';
import { templateQuestions } from './domain';
import { experienceContextSchema, type InterviewGeneration, type InterviewInput } from './types';
import { validExperienceContext } from './context';
const rewritesSchema = z.object({
  questions: z
    .array(
      z.object({
        id: z.string(),
        experienceId: z.string(),
        evidenceIds: z.array(z.string()).min(1).max(2),
        title: z
          .string()
          .trim()
          .min(2)
          .max(30)
          .refine((v) => !/[\r\n?!。]/u.test(v)),
        reason: z.string().trim().min(1).max(300),
        grounding: z.enum(['verified', 'fallback', 'excluded']),
        context: experienceContextSchema.nullable().optional(),
        question: z.string().trim().min(1).max(1000),
        followups: z.array(z.string().trim().min(1).max(500)).min(1).max(3),
        guide: z.array(z.string().trim().min(1).max(500)).min(1).max(4),
      }),
    )
    .min(1)
    .max(7),
});

// Only Kotlin owns the OpenAI credentials, model and system prompt.
export async function generateInterview(
  input: InterviewInput,
  options: {
    serverUrl?: string;
    proxySecret?: string;
    accessToken?: string;
    fetch?: typeof fetch;
  } = {},
): Promise<InterviewGeneration> {
  const fallback = templateQuestions(input);
  if (!fallback.questions.length) return fallback;
  if (!options.serverUrl || !options.proxySecret)
    return { ...fallback, notice: 'AI 서버 연결 설정이 필요해 기본 질문을 표시합니다.' };
  const editable = fallback.questions;
  if (!editable.length) return fallback;
  try {
    const response = await (options.fetch ?? fetch)(
      `${options.serverUrl.replace(/\/$/, '')}/api/interviews`,
      {
        method: 'POST',
        headers: {
          'X-Interview-Proxy-Secret': options.proxySecret,
          'Content-Type': 'application/json',
          ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
        },
        cache: 'no-store',
        // Backend generation + independent review share a 50 second budget.
        signal: AbortSignal.timeout(55_000),
        body: JSON.stringify({
          role: input.role,
          prompt: input.prompt ?? '',
          questions: editable.map((q) => ({
            id: q.id,
            experienceId: q.topicId,
            evidenceIds: q.evidenceIds,
            topic: q.topic,
            question: q.question,
            jdEvidence: q.jdEvidence,
            evidence: q.sources.map((s) => s.excerpt),
            careerContext:
              input.experienceTopics?.find((topic) => topic.id === q.topicId)?.careerContext ?? '',
          })),
        }),
      },
    );
    if (response.status === 503)
      return {
        ...fallback,
        notice: '백엔드의 OpenAI 키와 모델 설정을 확인해 주세요. 현재는 기본 질문을 표시합니다.',
      };
    if (!response.ok) throw new Error('generation');
    const parsed = rewritesSchema.parse(await response.json());
    if (
      parsed.questions.length !== editable.length ||
      new Set(parsed.questions.map((q) => q.id)).size !== editable.length ||
      parsed.questions.some((q) => !editable.some((e) => e.id === q.id))
    )
      throw new Error('ids');
    let excluded = 0;
    const questions = fallback.questions.flatMap((q) => {
      const rewrite = parsed.questions.find((r) => r.id === q.id);
      if (
        rewrite?.grounding === 'excluded' &&
        rewrite.experienceId === q.topicId &&
        rewrite.evidenceIds.length === q.evidenceIds?.length &&
        new Set(rewrite.evidenceIds).size === rewrite.evidenceIds.length &&
        rewrite.evidenceIds.every((id) => q.evidenceIds?.includes(id))
      ) {
        excluded++;
        return [];
      }
      // Resolve citations only within this experience. Never use provider source text.
      if (
        !rewrite ||
        rewrite.grounding !== 'verified' ||
        !rewrite.context ||
        !validExperienceContext(rewrite.context, q, rewrite.evidenceIds) ||
        rewrite.experienceId !== q.topicId ||
        new Set(rewrite.evidenceIds).size !== rewrite.evidenceIds.length ||
        rewrite.evidenceIds.some((id) => !q.evidenceIds?.includes(id))
      )
        return [q];
      return [
        {
          ...q,
          topic: rewrite.title,
          reason: rewrite.reason,
          question: rewrite.question,
          followups: rewrite.followups,
          guide: rewrite.guide,
          grounding: rewrite.grounding,
          evidenceIds: rewrite.evidenceIds,
          context: rewrite.context,
          sources: rewrite.evidenceIds.map((id) => q.sources[q.evidenceIds!.indexOf(id)]),
        },
      ];
    });
    const verified = questions.filter((q) => q.grounding === 'verified').length;
    return {
      generation: verified ? 'ai' : 'template',
      notice:
        (!questions.length
          ? '선택된 근거가 경력 업무로 확인되지 않아 질문을 생성하지 않았습니다.'
          : verified === questions.length
            ? '경험의 유형·대상·역할·규모를 해석하고 원문과 대조한 AI 질문입니다. 해석한 내용도 함께 확인해 주세요.'
            : `경력 기반 질문 · AI 질문 ${verified}개, 경험의 맥락을 확인하지 못해 대체한 기본 질문 ${questions.length - verified}개입니다.`) +
        (excluded ? ` 개인 활동 등 경력 범위 밖 근거의 질문 ${excluded}개를 제외했습니다.` : ''),
      questions,
    };
  } catch {
    return {
      ...fallback,
      notice:
        'AI 질문을 생성하지 못해 기본 질문을 표시합니다. 입력과 메모는 유지되며 다시 시도할 수 있습니다.',
    };
  }
}
