import { z } from 'zod';
import { templateQuestions } from './domain';
import type { InterviewGeneration, InterviewInput } from './types';
const rewritesSchema = z.object({
  questions: z
    .array(
      z.object({
        id: z.string(),
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
        signal: AbortSignal.timeout(28_000),
        body: JSON.stringify({
          role: input.role,
          prompt: input.prompt ?? '',
          questions: editable.map((q) => ({
            id: q.id,
            topic: q.topic,
            question: q.question,
            jdEvidence: q.jdEvidence,
            evidence: q.sources.map((s) => s.excerpt),
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
    return {
      generation: 'ai',
      notice: '이력서 경력 기반 AI 질문 · 경력 항목에 작성한 업무 경험만 사용한 초안입니다.',
      questions: fallback.questions.map((q) => {
        const rewrite = parsed.questions.find((r) => r.id === q.id);
        return rewrite
          ? { ...q, question: rewrite.question, followups: rewrite.followups, guide: rewrite.guide }
          : q;
      }),
    };
  } catch {
    return {
      ...fallback,
      notice:
        'AI 질문을 생성하지 못해 기본 질문을 표시합니다. 입력과 메모는 유지되며 다시 시도할 수 있습니다.',
    };
  }
}
