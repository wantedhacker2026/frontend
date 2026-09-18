import { keywordRequestSchema, keywordResponseSchema } from '@/lib/evaluation/keyword-contract';
import { readSession, sameOrigin } from '@/lib/auth/session';
import { accessToken } from '@/lib/auth/backend';

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: '허용되지 않은 요청입니다.' }, { status: 403 });
  const token = accessToken(request);
  if (!readSession(request) || !token)
    return Response.json({ error: '로그인 후 분석해 주세요.' }, { status: 401 });
  let body;
  try {
    body = keywordRequestSchema.parse(await request.json());
  } catch {
    return Response.json({ error: '분석 기준과 서류 분량을 확인해 주세요.' }, { status: 400 });
  }
  const base =
    process.env.WANTEDHACKER_SERVER_URL ??
    (process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:8080' : '');
  if (!base) {
    return Response.json({ error: '분석 서버 연결이 설정되지 않았습니다.' }, { status: 503 });
  }
  try {
    const upstream = await fetch(`${base.replace(/\/$/, '')}/api/analysis/keywords`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    });
    if (!upstream.ok) {
      return Response.json(
        { error: '분석 서버가 요청을 처리하지 못했습니다. 다시 시도해 주세요.' },
        { status: [400, 401].includes(upstream.status) ? upstream.status : 502 },
      );
    }
    return Response.json(keywordResponseSchema.parse(await upstream.json()), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return Response.json(
      { error: '분석 서버에 연결하지 못했습니다. 입력을 유지했으니 다시 시도해 주세요.' },
      { status: 502 },
    );
  }
}
