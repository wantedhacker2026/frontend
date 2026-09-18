import assert from 'node:assert/strict';
import type { ProjectActor } from '../lib/projects/types';

// Only use with compose.auth-test.yaml: all emails remain in the local Mailpit container.
export async function emailAuthFixture(origin: string, role: 'applicant' | 'recruiter') {
  const mailpit = process.env.AUTH_TEST_MAILPIT_URL;
  assert.ok(mailpit, 'Set AUTH_TEST_MAILPIT_URL and start compose.auth-test.yaml first.');
  assert.ok(
    ['localhost', '127.0.0.1', 'mailpit'].includes(new URL(mailpit).hostname),
    'Local mailbox only',
  );
  const mailbox = await fetch(`${mailpit}/api/v1/messages`);
  assert.equal(
    mailbox.status,
    200,
    'Local test mailbox must be available before requesting a code',
  );
  const email = `auth-${role}-${crypto.randomUUID()}@example.test`;
  const headers = { 'Content-Type': 'application/json', Origin: new URL(origin).origin };
  const sent = await fetch(new URL('/api/auth/code', origin), {
    method: 'POST',
    headers,
    body: JSON.stringify({ email }),
  });
  assert.equal(sent.status, 200, `Send code: ${await sent.text()}`);
  let code = '';
  for (let i = 0; i < 20 && !code; i++) {
    const data = await (await fetch(`${mailpit}/api/v1/messages`)).json();
    const mail = data.messages.find((m: { To: { Address: string }[] }) =>
      m.To.some((to) => to.Address === email),
    );
    code = mail?.Subject.match(/\b\d{6}\b/)?.[0] ?? '';
    if (!code) await new Promise((resolve) => setTimeout(resolve, 300));
  }
  assert.match(code, /^\d{6}$/, 'Test email must contain verification code');
  const input = { email, code, role, name: '가상 인증 테스트' };
  const login = await fetch(new URL('/api/auth/login', origin), {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });
  assert.equal(login.status, 200, 'Real backend code verification');
  const { actor } = (await login.json()) as { actor: ProjectActor };
  assert.notEqual(actor.id, 'demo-applicant');
  const cookie = login.headers
    .getSetCookie()
    .map((v) => v.split(';')[0])
    .join('; ');
  const restored = await fetch(new URL('/api/session', origin), { headers: { Cookie: cookie } });
  assert.equal((await restored.json()).actor.id, actor.id);
  const replay = await fetch(new URL('/api/auth/login', origin), {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });
  assert.equal(replay.status, 401, 'Verification codes are single-use');
  return { actor, cookie };
}
