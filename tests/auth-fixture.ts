import { sealCredentials, TOKEN_COOKIE, type Credentials } from '../lib/auth/backend';
import { signSession, SESSION_COOKIE } from '../lib/auth/session';
import type { ProjectActor } from '../lib/projects/types';
export const authSecret = 'test-auth-secret-at-least-thirty-two-characters';
export function authFixture(
  actor: ProjectActor = {
    id: 'real-user-id',
    name: '테스트',
    role: 'recruiter',
    provider: '이메일 인증',
  },
) {
  process.env.INTERVIEW_PROXY_SECRET = authSecret;
  const data: Credentials = {
    actor,
    access: 'test-access',
    refresh: 'test-refresh',
    accessExpires: Date.now() + 1800000,
    refreshExpires: Date.now() + 86400000,
  };
  const cookie = `${SESSION_COOKIE}=${signSession(actor, authSecret)}; ${TOKEN_COOKIE}=${sealCredentials(data)}`;
  return { data, cookie };
}
