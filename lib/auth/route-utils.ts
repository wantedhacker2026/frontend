import { NextResponse } from 'next/server';
import { sameOrigin } from './session';
import { AuthError } from './backend';
export function authError(error: unknown) {
  const failure =
    error instanceof AuthError ? error : new AuthError('입력 형식을 확인해 주세요.', 400);
  return NextResponse.json(
    { error: failure.message, retryAfter: failure.retryAfter },
    {
      status: failure.status,
      headers: {
        'Cache-Control': 'no-store',
        ...(failure.retryAfter ? { 'Retry-After': String(failure.retryAfter) } : {}),
      },
    },
  );
}
export async function authBody(request: Request) {
  if (!sameOrigin(request)) throw new AuthError('허용되지 않은 요청입니다.', 403);
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw new AuthError('JSON 입력이 필요합니다.', 415);
  const reader = request.body?.getReader();
  if (!reader) throw new AuthError('입력을 확인해 주세요.', 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if ((size += value.byteLength) > 2048) {
      await reader.cancel();
      throw new AuthError('입력이 너무 큽니다.', 413);
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
