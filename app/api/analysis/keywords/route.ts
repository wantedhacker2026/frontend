import { keywordRequestSchema, keywordResponseSchema } from '@/lib/evaluation/keyword-contract';

export async function POST(request: Request) {
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    });
    if (!upstream.ok) {
      return Response.json(
        { error: '분석 서버가 요청을 처리하지 못했습니다. 다시 시도해 주세요.' },
        { status: upstream.status === 400 ? 400 : 502 },
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
