import { readSession, sameOrigin } from '@/lib/auth/session';
import { ImportError, publicUrl } from '@/lib/job-postings/fetch';
import { importJobPosting } from '@/lib/job-postings/import';
import { renderJobPosting } from '@/lib/job-postings/render';

export const runtime = 'nodejs';
export const maxDuration = 30;
const headers = { 'Cache-Control': 'no-store' };
// Per-process guardrails; use a shared limiter when deploying multiple instances.
const windows = new Map<string, { start: number; count: number }>();
let active = 0;
export async function POST(request: Request) {
  const reply = (error: string, status: number, code?: string) =>
    Response.json({ error, code }, { status, headers });
  if (!sameOrigin(request)) return reply('허용되지 않은 요청입니다.', 403);
  const actor = readSession(request);
  if (!actor) return reply('로그인 후 공고를 가져와 주세요.', 401);
  if (!request.headers.get('content-type')?.includes('application/json'))
    return reply('JSON 입력이 필요합니다.', 415);
  const now = Date.now();
  for (const [id, window] of windows) if (now - window.start > 60000) windows.delete(id);
  const window = windows.get(actor.id) ?? { start: now, count: 0 };
  if (active >= 3 || window.count >= 10) return reply('잠시 후 다시 시도해 주세요.', 429);
  windows.set(actor.id, { start: window.start, count: window.count + 1 });
  active++;
  try {
    const reader = request.body?.getReader();
    if (!reader) return reply('공고 주소를 입력해 주세요.', 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if ((size += value.byteLength) > 4096) {
        await reader.cancel();
        return reply('입력이 너무 큽니다.', 413);
      }
      chunks.push(value);
    }
    let data;
    try {
      data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      return reply('입력 형식을 확인해 주세요.', 400);
    }
    if (typeof data?.url !== 'string' || data.url.length > 2000)
      return reply('공고 주소를 확인해 주세요.', 400);
    const url = publicUrl(data.url.trim());
    const result = await importJobPosting(url.href, {
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(25000)]),
      renderer: process.env.JOB_IMPORT_RENDER_ENABLED === 'true' ? renderJobPosting : undefined,
    });
    return Response.json(result, { headers });
  } catch (error) {
    if (error instanceof ImportError) return reply(error.message, error.status, error.code);
    return reply(
      '공고를 가져오지 못했습니다. 잠시 후 다시 시도하거나 본문을 직접 붙여넣어 주세요.',
      422,
      'FETCH_FAILED',
    );
  } finally {
    active--;
  }
}
