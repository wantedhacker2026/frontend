import { interviewInputSchema } from '@/lib/interview/types';
import { generateInterview } from '@/lib/interview/generator';

import { readSession } from '@/lib/auth/session';
import { accessToken } from '@/lib/auth/backend';

export const runtime = 'nodejs';
export const maxDuration = 30;
const MAX_BODY = 180_000;
// Local demo guardrails. Production requires authenticated users and a shared rate limiter.
let windowStart = 0;
let requests = 0;
let active = 0;
const headers = { 'Cache-Control': 'no-store' };
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  // Standalone Next uses its container hostname in request.url; Host is the browser-facing host.
  const host = request.headers.get('host') ?? new URL(request.url).host;
  let allowedOrigin = !origin;
  try {
    if (origin) {
      const url = new URL(origin);
      allowedOrigin = ['http:', 'https:'].includes(url.protocol) && url.host === host;
    }
  } catch {
    allowedOrigin = false;
  }
  if (!allowedOrigin)
    return Response.json({ error: '허용되지 않은 요청입니다.' }, { status: 403, headers });
  const actor = readSession(request);
  const token = accessToken(request);
  if (!actor || !token)
    return Response.json(
      { error: '로그인 후 면접 질문을 생성해 주세요.' },
      { status: 401, headers },
    );
  if (!request.headers.get('content-type')?.includes('application/json'))
    return Response.json({ error: 'JSON 입력이 필요합니다.' }, { status: 415, headers });
  if (Date.now() - windowStart > 60_000) {
    windowStart = Date.now();
    requests = 0;
  }
  if (active >= 3 || requests >= 20)
    return Response.json({ error: '잠시 후 다시 시도해 주세요.' }, { status: 429, headers });
  requests++;
  active++;
  try {
    const reader = request.body?.getReader();
    if (!reader) return Response.json({ error: '입력이 없습니다.' }, { status: 400, headers });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) {
        await reader.cancel();
        return Response.json({ error: '입력이 너무 큽니다.' }, { status: 413, headers });
      }
      chunks.push(value);
    }
    const parsed = interviewInputSchema.safeParse(
      JSON.parse(Buffer.concat(chunks).toString('utf8')),
    );
    if (
      !parsed.success ||
      parsed.data.priorityIds.some((id) => !parsed.data.topics.some((t) => t.id === id)) ||
      new Set(parsed.data.topics.map((t) => t.id)).size !== parsed.data.topics.length
    )
      return Response.json({ error: '질문 생성 기준을 확인해 주세요.' }, { status: 400, headers });
    if (parsed.data.role !== actor.role)
      return Response.json({ error: '로그인 역할을 확인해 주세요.' }, { status: 403, headers });
    const result = await generateInterview(parsed.data, {
      serverUrl: process.env.WANTEDHACKER_SERVER_URL,
      proxySecret: process.env.INTERVIEW_PROXY_SECRET,
      accessToken: token,
    });
    return Response.json(result, { headers });
  } catch {
    return Response.json(
      { error: '질문 생성 요청을 처리하지 못했습니다. 다시 시도해 주세요.' },
      { status: 400, headers },
    );
  } finally {
    active--;
  }
}
