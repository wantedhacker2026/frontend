import test from 'node:test';
import assert from 'node:assert/strict';
import { signSession, readSession, SESSION_COOKIE, SESSION_SECONDS } from '../lib/auth/session';
import { projectLoginPath, safeProjectDestination } from '../lib/auth/navigation';
import { POST, DELETE } from '../app/api/session/route';
const secret = 'test-session-secret-at-least-thirty-two-characters';
const actor = {
  id: 'demo-applicant',
  role: 'applicant' as const,
  name: '지원자',
  provider: 'demo',
};
test('signed sessions reject tampering and expiry', () => {
  const token = signSession(actor, secret, 1000);
  const request = (value: string) =>
    new Request('http://localhost', { headers: { cookie: `${SESSION_COOKIE}=${value}` } });
  assert.deepEqual(readSession(request(token), secret, 2000), actor);
  assert.equal(readSession(request(token + 'x'), secret, 2000), null);
  assert.equal(readSession(request(token), secret, 1001 + SESSION_SECONDS * 1000), null);
  assert.equal(readSession(request(token), 'wrong-key', 2000), null);
});
test('login destination preserves project creation and rejects external redirects', () => {
  assert.equal(projectLoginPath(), '/login?next=%2Fnew-project');
  assert.equal(safeProjectDestination('/new-project?projectId=a'), '/new-project?projectId=a');
  for (const value of [
    '//evil.example',
    'https://evil.example/new-project',
    '/home',
    '/new-project/../other',
  ])
    assert.equal(safeProjectDestination(value), '/home');
});
test('demo identity submissions are rejected and logout clears cookies with origin protection', async () => {
  process.env.INTERVIEW_PROXY_SECRET = secret;
  const make = (origin = 'http://localhost:3000') =>
    new Request('http://localhost:3000/api/session', {
      method: 'POST',
      headers: { origin },
      body: JSON.stringify(actor),
    });
  process.env.DEMO_LOGIN_ENABLED = 'false';
  assert.equal((await POST()).status, 403);
  process.env.DEMO_LOGIN_ENABLED = 'true';
  assert.equal((await POST()).status, 403);
  assert.equal((await DELETE(make('https://evil.example'))).status, 403);
  const response = await DELETE(make());
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie')!, /HttpOnly/);
  assert.match((await DELETE(make())).headers.get('set-cookie')!, /Max-Age=0/);
});
