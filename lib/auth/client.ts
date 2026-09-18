import { actorSchema, type ProjectActor } from '@/lib/projects/types';
export type BrowserSession = {
  actor: ProjectActor | null;
  expiresAt?: number;
  renewable?: boolean;
};
let pending: Promise<BrowserSession> | null = null;
export async function withAuthLock<T>(action: () => Promise<T>) {
  return typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request('wantedhacker-auth', action)
    : action();
}
export function publishSession(session: BrowserSession) {
  if (typeof window !== 'undefined')
    window.dispatchEvent(new CustomEvent('wantedhacker-auth', { detail: session }));
}
export async function readBrowserSession(): Promise<BrowserSession> {
  if (pending) return pending;
  pending = withAuthLock(async () => {
    const response = await fetch('/api/session', {
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok)
      throw new Error('로그인 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    let session = await response.json();
    if (session.renewable && (!session.actor || session.expiresAt <= Date.now() + 60000)) {
      const refreshed = await fetch('/api/auth/reissue', {
        method: 'POST',
        signal: AbortSignal.timeout(20000),
      });
      if (refreshed.status === 401) session = { actor: null };
      else if (!refreshed.ok)
        throw new Error('로그인 상태를 갱신하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      else session = await refreshed.json();
    }
    const safe = { ...session, actor: session.actor ? actorSchema.parse(session.actor) : null };
    publishSession(safe);
    return safe;
  });
  try {
    return await pending;
  } finally {
    pending = null;
  }
}
export const authenticatedFetch: typeof fetch = async (input, init) => {
  if (typeof window === 'undefined') return fetch(input, init);
  const session = await readBrowserSession();
  if (!session.actor)
    throw new Error('로그인이 만료되었습니다. 입력은 유지되니 다시 로그인해 주세요.');
  const response = await fetch(input, init);
  if (response.status === 401) {
    publishSession({ actor: null });
    throw new Error('인증을 확인하지 못했습니다. 다시 로그인해 주세요.');
  }
  return response;
};
