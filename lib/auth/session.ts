import { createHmac, timingSafeEqual } from 'node:crypto';
import { actorSchema, type ProjectActor } from '@/lib/projects/types';
export const SESSION_COOKIE = 'wantedhacker-session';
export const SESSION_SECONDS = 8 * 60 * 60;
function signature(value: string, secret: string) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}
export function signSession(
  actor: ProjectActor,
  secret: string,
  now = Date.now(),
  seconds = SESSION_SECONDS,
) {
  if (secret.length < 32) throw new Error('세션 설정이 필요합니다.');
  const value = Buffer.from(
    JSON.stringify({ version: 2, actor, expires: now + seconds * 1000 }),
  ).toString('base64url');
  return `${value}.${signature(value, secret)}`;
}
export function readSession(
  request: Request,
  secret = process.env.INTERVIEW_PROXY_SECRET ?? '',
  now = Date.now(),
): ProjectActor | null {
  if (secret.length < 32) return null;
  const token = request.headers
    .get('cookie')
    ?.split(';')
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  if (!token || token.length > 3000) return null;
  try {
    const [value, sig, extra] = token.split('.');
    if (extra || !sig) return null;
    const expected = Buffer.from(signature(value, secret));
    const received = Buffer.from(sig);
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
    const data = JSON.parse(Buffer.from(value, 'base64url').toString());
    if (data.version !== 2 || typeof data.expires !== 'number' || data.expires <= now) return null;
    return actorSchema.parse(data.actor);
  } catch {
    return null;
  }
}
export function sameOrigin(request: Request) {
  try {
    const origin = request.headers.get('origin');
    const url = origin ? new URL(origin) : null;
    return Boolean(
      url &&
      ['http:', 'https:'].includes(url.protocol) &&
      url.host === (request.headers.get('host') ?? new URL(request.url).host),
    );
  } catch {
    return false;
  }
}
