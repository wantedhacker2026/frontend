'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, UserRound, ArrowRight, ArrowLeft, Mail, LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { useProjects } from '@/lib/projects/store';
import { safeProjectDestination } from '@/lib/auth/navigation';
import { emailSchema } from '@/lib/auth/contracts';
import { Button } from '@/components/ui/button';
export function ProjectLogin() {
  const { actor, login } = useProjects();
  const router = useRouter();
  const [role, setRole] = useState<'applicant' | 'recruiter'>('applicant');
  const [email, setEmail] = useState('');
  const [sentEmail, setSentEmail] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(0);
  const lock = useRef(false);
  const codeInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!retryAt && !expiresAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [retryAt, expiresAt]);
  useEffect(() => {
    if (sentEmail) codeInput.current?.focus();
  }, [sentEmail]);
  const retry = Math.max(0, Math.ceil((retryAt - now) / 1000));
  const remaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  async function send(event?: FormEvent) {
    event?.preventDefault();
    if (lock.current || retry > 0) return;
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError('올바른 이메일 주소를 입력해 주세요.');
      return;
    }
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/auth/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: parsed.data }),
        signal: AbortSignal.timeout(20000),
      });
      const result = await response.json();
      const time = Date.now();
      setNow(time);
      if (response.status === 429) setRetryAt(time + (result.retryAfter || 60) * 1000);
      if (!response.ok) throw new Error(result.error || '인증 메일을 보내지 못했습니다.');
      setSentEmail(parsed.data);
      setEmail(parsed.data);
      setCode('');
      setRetryAt(time + result.retryAfter * 1000);
      setExpiresAt(time + result.expiresIn * 1000);
      setNotice('인증 코드를 보냈습니다. 받은 메일함과 스팸함을 확인해 주세요.');
      codeInput.current?.focus();
    } catch (e) {
      setError(
        e instanceof Error && e.name !== 'TimeoutError'
          ? e.message
          : '응답이 늦습니다. 잠시 후 다시 시도해 주세요.',
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function verify(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    if (!/^\d{6}$/.test(code) || remaining === 0) {
      setError('유효한 6자리 코드를 입력하거나 새 코드를 받아 주세요.');
      return;
    }
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await login({ email: sentEmail, code, role, name });
      setCode('');
      router.push(
        safeProjectDestination(
          new URLSearchParams(window.location.search).get('next'),
          role === 'recruiter' ? '/home' : '/new-project',
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : '로그인하지 못했습니다.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (actor)
    return (
      <div className="project-auth-existing">
        <h1>{actor.name}님으로 로그인되어 있어요.</h1>
        <p>다른 계정이나 이용 유형으로 시작하려면 로그아웃해 주세요.</p>
        <Button asChild>
          <Link href="/home">내 홈으로 이동</Link>
        </Button>
      </div>
    );
  return (
    <div className="project-login">
      <Link className="back-link" href="/home">
        <ArrowLeft size={15} />
        홈으로
      </Link>
      <span className="eyebrow">EMAIL SIGN IN</span>
      <h1>이메일로 간편하게 시작하세요.</h1>
      <p className="project-lead">
        비밀번호 없이 인증 코드로 로그인합니다. 처음 이용하는 이메일은 인증 후 자동 가입됩니다.
      </p>
      <div className="project-auth-role" role="group" aria-label="이용 유형">
        <button
          type="button"
          aria-pressed={role === 'applicant'}
          disabled={busy}
          onClick={() => setRole('applicant')}
        >
          <UserRound size={22} />
          <strong>구직자</strong>
          <span>내 서류와 채용공고를 분석해요.</span>
        </button>
        <button
          type="button"
          aria-pressed={role === 'recruiter'}
          disabled={busy}
          onClick={() => setRole('recruiter')}
        >
          <Building2 size={22} />
          <strong>채용 담당자</strong>
          <span>지원자의 서류를 함께 비교해요.</span>
        </button>
      </div>
      <form className="project-email-login" onSubmit={sentEmail ? verify : send}>
        <label className="project-field">
          표시 이름 <small>선택 사항</small>
          <input
            value={name}
            maxLength={40}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 김지원"
            autoComplete="nickname"
          />
        </label>
        <label className="project-field">
          이메일
          <input
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            readOnly={Boolean(sentEmail)}
            disabled={busy}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
          />
        </label>
        {sentEmail ? (
          <>
            <button
              type="button"
              className="project-text-button"
              disabled={busy}
              onClick={() => {
                setSentEmail('');
                setCode('');
                setExpiresAt(0);
                setError('');
                setNotice('');
              }}
            >
              이메일 변경
            </button>
            <label className="project-field">
              6자리 인증 코드
              <input
                ref={codeInput}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                disabled={busy}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                required
                aria-describedby="code-expiry"
              />
            </label>
            <p id="code-expiry" className="project-notice">
              {remaining > 0
                ? `유효시간 ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')} · 코드는 한 번만 사용할 수 있어요.`
                : '인증 코드가 만료되었습니다. 새 코드를 받아 주세요.'}
            </p>
            <Button type="submit" disabled={busy || code.length !== 6 || remaining === 0}>
              {busy ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : (
                <ArrowRight size={16} />
              )}
              인증하고 시작하기
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || retry > 0}
              onClick={() => send()}
            >
              {retry > 0 ? `${retry}초 후 재발송` : '인증 코드 다시 받기'}
            </Button>
          </>
        ) : (
          <Button type="submit" disabled={busy || retry > 0}>
            {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Mail size={16} />}
            {busy ? '인증 코드 발송 중…' : retry > 0 ? `${retry}초 후 발송 가능` : '인증 코드 받기'}
          </Button>
        )}
        {notice && (
          <p className="project-notice" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className="error-banner" role="alert">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
