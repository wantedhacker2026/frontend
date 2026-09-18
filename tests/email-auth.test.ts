import test from 'node:test';
import assert from 'node:assert/strict';
import { POST as send } from '../app/api/auth/code/route';
import { POST as login } from '../app/api/auth/login/route';
import { POST as reissue } from '../app/api/auth/reissue/route';
import { GET, DELETE, POST as demo } from '../app/api/session/route';
import {
  TOKEN_COOKIE,
  readCredentials,
  sealCredentials,
  credentialsResponse,
  type Credentials,
} from '../lib/auth/backend';
import { authFixture, authSecret } from './auth-fixture';
import { readSession } from '../lib/auth/session';
const actor = {
  id: 'backend-user-id',
  name: '담당자',
  role: 'recruiter' as const,
  provider: '이메일 인증',
};
function request(path: string, body: unknown = {}, cookie = '', origin = 'http://localhost:3000') {
  return new Request(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: { origin, 'Content-Type': 'application/json', cookie },
    body: JSON.stringify(body),
  });
}
function jwt(type: string, subject = actor.id, seconds = 1800) {
  return `header.${Buffer.from(JSON.stringify({ sub: subject, type, exp: Math.floor(Date.now() / 1000) + seconds })).toString('base64url')}.signature`;
}
function pair(subject = actor.id) {
  return new Response(null, {
    headers: {
      Authorization: `Bearer ${jwt('access', subject)}`,
      'Refresh-Token': jwt('refresh', subject, 1209600),
    },
  });
}
function cookies(response: Response) {
  return response.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
}
function configure() {
  process.env.INTERVIEW_PROXY_SECRET = authSecret;
  process.env.WANTEDHACKER_SERVER_URL = 'http://backend:8080';
}

test('email code request normalizes input, maps cooldown, and rejects CSRF or invalid email', async (t) => {
  configure();
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    calls++;
    assert.equal(url, 'http://backend:8080/api/auth/code');
    assert.deepEqual(JSON.parse(String(init.body)), { email: 'person@example.com' });
    return new Response(null);
  });
  assert.equal((await send(request('/api/auth/code', { email: 'bad' }))).status, 400);
  assert.equal(
    (
      await send(
        request('/api/auth/code', { email: 'person@example.com' }, '', 'https://evil.example'),
      )
    ).status,
    403,
  );
  assert.equal(calls, 0);
  const response = await send(request('/api/auth/code', { email: ' Person@Example.com ' }));
  assert.deepEqual(await response.json(), { sent: true, retryAfter: 60, expiresIn: 300 });
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response(null, { status: 429, headers: { 'Retry-After': '37' } }),
  );
  const limited = await send(request('/api/auth/code', { email: 'person@example.com' }));
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('retry-after'), '37');
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 502 }));
  assert.equal(
    (await send(request('/api/auth/code', { email: 'person@example.com' }))).status,
    502,
  );
});
test('verification uses backend subject, stores encrypted HttpOnly tokens, and exposes no raw tokens', async (t) => {
  configure();
  process.env.SESSION_COOKIE_SECURE = 'true';
  t.after(() => {
    delete process.env.SESSION_COOKIE_SECURE;
  });
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    assert.equal(url, 'http://backend:8080/api/auth/login');
    assert.deepEqual(JSON.parse(String(init.body)), {
      email: 'person@example.com',
      code: '012345',
    });
    return pair();
  });
  const response = await login(
    request('/api/auth/login', {
      email: 'Person@example.com',
      code: '012345',
      role: 'recruiter',
      name: '담당자',
      id: 'spoofed',
    }),
  );
  assert.equal(response.status, 200);
  const value = await response.json();
  assert.deepEqual(value.actor, actor);
  assert.ok(!JSON.stringify(value).includes('signature'));
  assert.match(response.headers.get('set-cookie')!, /HttpOnly/);
  assert.match(response.headers.get('set-cookie')!, /Secure/);
  const cookie = cookies(response);
  const req = request('/api/session', {}, cookie);
  assert.equal(readCredentials(req)?.access, jwt('access'));
  assert.deepEqual(readSession(req), actor);
  assert.deepEqual((await (await GET(req)).json()).actor, actor);
  assert.equal(
    readCredentials(
      request('/api/session', {}, cookie.replace(`${TOKEN_COOKIE}=`, `${TOKEN_COOKIE}=broken`)),
    ),
    null,
  );
  const logout = await DELETE(req);
  assert.equal(logout.headers.getSetCookie().length, 2);
  assert.ok(logout.headers.getSetCookie().every((v) => v.includes('Max-Age=0')));
  assert.equal((await demo()).status, 403);
});
test('wrong code and malformed token response never issue session cookies', async (t) => {
  configure();
  const input = { email: 'person@example.com', code: '123456', role: 'applicant' };
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 401 }));
  const denied = await login(request('/api/auth/login', input));
  assert.equal(denied.status, 401);
  assert.equal(denied.headers.get('set-cookie'), null);
  t.mock.method(globalThis, 'fetch', async () => new Response(null));
  assert.equal((await login(request('/api/auth/login', input))).status, 502);
});
test('concurrent refresh rotates once, preserves identity, and clears invalid refresh sessions', async (t) => {
  configure();
  const { data } = authFixture(actor);
  const expired: Credentials = {
    ...data,
    accessExpires: Date.now() - 1000,
    refresh: 'concurrent-refresh-test',
  };
  const cookie = `${TOKEN_COOKIE}=${sealCredentials(expired)}`;
  let count = 0;
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    count++;
    assert.equal(url, 'http://backend:8080/api/auth/reissue');
    assert.equal(new Headers(init.headers).get('Refresh-Token'), 'concurrent-refresh-test');
    return pair();
  });
  const results = await Promise.all([
    reissue(request('/api/auth/reissue', {}, cookie)),
    reissue(request('/api/auth/reissue', {}, cookie)),
  ]);
  assert.equal(count, 1);
  assert.ok(results.every((r) => r.status === 200));
  assert.deepEqual(readCredentials(request('/', {}, cookies(results[0])))?.actor, actor);
  const valid = credentialsResponse({ ...data, refresh: 'fresh-token' });
  assert.equal((await reissue(request('/', {}, cookies(valid)))).status, 200);
  assert.equal(count, 1);
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 401 }));
  const bad = `${TOKEN_COOKIE}=${sealCredentials({ ...expired, refresh: 'invalid-token-test' })}`;
  const failed = await reissue(request('/', {}, bad));
  assert.equal(failed.status, 401);
  assert.match(failed.headers.get('set-cookie')!, /Max-Age=0/);
});
test('refresh transport failure retains cookie and changed subject is rejected', async (t) => {
  configure();
  const { data } = authFixture(actor);
  const make = (refresh: string) =>
    request(
      '/',
      {},
      `${TOKEN_COOKIE}=${sealCredentials({ ...data, refresh, accessExpires: Date.now() - 1 })}`,
    );
  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('network');
  });
  const failed = await reissue(make('network-failure-test'));
  assert.equal(failed.status, 502);
  assert.equal(failed.headers.get('set-cookie'), null);
  t.mock.method(globalThis, 'fetch', async () => pair('different-user'));
  const changed = await reissue(make('changed-user-test'));
  assert.equal(changed.status, 502);
});
