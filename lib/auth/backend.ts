import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { actorSchema, type ProjectActor } from '@/lib/projects/types';
import { SESSION_COOKIE, signSession } from './session';

export const TOKEN_COOKIE = 'wantedhacker-credentials';
export class AuthError extends Error {
  constructor(
    message: string,
    public status = 502,
    public retryAfter?: number,
  ) {
    super(message);
  }
}
const credentialsSchema = z.object({
  actor: actorSchema,
  access: z.string().max(2000),
  refresh: z.string().max(2000),
  accessExpires: z.number(),
  refreshExpires: z.number(),
});
export type Credentials = z.infer<typeof credentialsSchema>;
function key() {
  const secret = process.env.INTERVIEW_PROXY_SECRET ?? '';
  if (secret.length < 32) throw new AuthError('로그인 서버 설정을 확인해 주세요.', 503);
  return createHash('sha256').update(`wantedhacker-auth-v1:${secret}`).digest();
}
export function sealCredentials(value: Credentials) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  const token = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
  if (token.length > 3800) throw new AuthError('인증 응답을 저장하지 못했습니다.');
  return token;
}
export function readCredentials(request: Request): Credentials | null {
  try {
    const token = request.headers
      .get('cookie')
      ?.split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith(`${TOKEN_COOKIE}=`))
      ?.slice(TOKEN_COOKIE.length + 1);
    if (!token || token.length > 3800) return null;
    const bytes = Buffer.from(token, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', key(), bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const data = credentialsSchema.parse(
      JSON.parse(
        Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8'),
      ),
    );
    return data.refreshExpires > Date.now() ? data : null;
  } catch {
    return null;
  }
}
export function accessToken(request: Request) {
  const credentials = readCredentials(request);
  return credentials && credentials.accessExpires > Date.now() ? credentials.access : null;
}
function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.SESSION_COOKIE_SECURE === 'true',
    path: '/',
    maxAge,
  };
}
export function credentialsResponse(data: Credentials) {
  const token = sealCredentials(data);
  const seconds = Math.max(1, Math.floor((data.accessExpires - Date.now()) / 1000));
  const response = NextResponse.json(
    { actor: data.actor, expiresAt: data.accessExpires },
    { headers: { 'Cache-Control': 'no-store' } },
  );
  response.cookies.set(
    SESSION_COOKIE,
    signSession(data.actor, process.env.INTERVIEW_PROXY_SECRET!, Date.now(), seconds),
    cookieOptions(seconds),
  );
  response.cookies.set(
    TOKEN_COOKIE,
    token,
    cookieOptions(Math.max(1, Math.floor((data.refreshExpires - Date.now()) / 1000))),
  );
  return response;
}
export function clearCredentials(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, '', cookieOptions(0));
  response.cookies.set(TOKEN_COOKIE, '', cookieOptions(0));
  return response;
}
export async function authRequest(
  path: 'code' | 'login' | 'reissue',
  body?: unknown,
  refresh?: string,
) {
  key();
  const base = process.env.WANTEDHACKER_SERVER_URL;
  if (!base) throw new AuthError('인증 서버 연결이 설정되지 않았습니다.', 503);
  let response: Response;
  try {
    response = await fetch(`${base.replace(/\/$/, '')}/api/auth/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(refresh ? { 'Refresh-Token': refresh } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new AuthError('인증 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }
  if (!response.ok) {
    const retry = Math.min(300, Math.max(1, Number(response.headers.get('retry-after')) || 60));
    if (response.status === 429)
      throw new AuthError('재발송 대기 시간이 남아 있습니다.', 429, retry);
    if (response.status === 401)
      throw new AuthError(
        path === 'login'
          ? '인증 코드가 일치하지 않거나 만료되었습니다. 5회 실패했다면 새 코드를 받아 주세요.'
          : '로그인이 만료되었습니다. 다시 로그인해 주세요.',
        401,
      );
    if (response.status === 400)
      throw new AuthError('이메일과 6자리 인증 코드를 확인해 주세요.', 400);
    throw new AuthError(
      path === 'code'
        ? '인증 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.'
        : '인증을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    );
  }
  return response;
}
/** Claims come only from the configured backend's successful response, never client input. */
export function credentialsFromResponse(
  response: Response,
  profile: Omit<ProjectActor, 'id'>,
  expectedId?: string,
): Credentials {
  try {
    const access = response.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];
    const refresh = response.headers.get('refresh-token');
    if (!access || !refresh) throw new Error();
    const claims = (token: string, type: string) => {
      if (token.split('.').length !== 3) throw new Error();
      const data = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
      if (
        data.type !== type ||
        typeof data.sub !== 'string' ||
        !data.sub ||
        data.sub.length > 100 ||
        !Number.isFinite(data.exp) ||
        data.exp * 1000 <= Date.now()
      )
        throw new Error();
      return { id: data.sub as string, expires: data.exp * 1000 };
    };
    const a = claims(access, 'access'),
      r = claims(refresh, 'refresh');
    if (a.id !== r.id || (expectedId && a.id !== expectedId)) throw new Error();
    return credentialsSchema.parse({
      actor: { ...profile, id: a.id },
      access,
      refresh,
      accessExpires: a.expires,
      refreshExpires: r.expires,
    });
  } catch {
    throw new AuthError('인증 서버 응답을 확인하지 못했습니다. 다시 로그인해 주세요.');
  }
}
const rotations = new Map<string, { expires: number; pending: Promise<Credentials> }>();
export async function reissueCredentials(data: Credentials) {
  for (const [id, item] of rotations) if (item.expires < Date.now()) rotations.delete(id);
  const id = createHash('sha256').update(data.refresh).digest('hex');
  const existing = rotations.get(id);
  if (existing) return existing.pending;
  const pending = authRequest('reissue', undefined, data.refresh).then((response) =>
    credentialsFromResponse(response, data.actor, data.actor.id),
  );
  rotations.set(id, { expires: Date.now() + 30000, pending });
  return pending;
}
