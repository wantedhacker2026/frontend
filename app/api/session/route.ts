import { NextResponse } from 'next/server';
import { readSession, sameOrigin } from '@/lib/auth/session';
import { clearCredentials, readCredentials } from '@/lib/auth/backend';
export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'no-store' };
export async function GET(request: Request) {
  const credentials = readCredentials(request);
  const actor = credentials && readSession(request);
  return NextResponse.json(
    {
      actor: actor || null,
      renewable: Boolean(credentials),
      expiresAt: credentials?.accessExpires,
    },
    { headers },
  );
}
// Old demo identity submissions must never mint a real session.
export async function POST() {
  return NextResponse.json(
    { error: '이메일 인증 코드로 로그인해 주세요.' },
    { status: 403, headers },
  );
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: '허용되지 않은 요청입니다.' }, { status: 403, headers });
  return clearCredentials(NextResponse.json({ ok: true }, { headers }));
}
