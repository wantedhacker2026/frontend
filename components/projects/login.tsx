'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, UserRound, ArrowRight, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useProjects } from '@/lib/projects/store';
import { Button } from '@/components/ui/button';
export function ProjectLogin() {
  const { actor, login } = useProjects();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [signup, setSignup] = useState(false);
  function enter(role: 'recruiter' | 'applicant', provider: string) {
    if (busy) return;
    setBusy(true);
    try {
      login({
        id: role === 'recruiter' ? `company:${email.trim().toLowerCase()}` : 'demo-applicant',
        name: name.trim() || (role === 'recruiter' ? '채용담당자' : '지원자'),
        role,
        provider,
      });
      setPassword('');
      router.push(role === 'recruiter' ? '/home' : '/new-project');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  function company(event: FormEvent) {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
      setError('회사 이메일 형식과 데모 비밀번호 8자 이상을 확인해 주세요.');
      return;
    }
    enter('recruiter', '회사 이메일');
  }
  if (actor)
    return (
      <div className="project-auth-existing">
        <h1>{actor.name}님으로 로그인되어 있어요.</h1>
        <p>다른 역할을 체험하려면 먼저 로그아웃해 주세요.</p>
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
      <span className="eyebrow">START WITH YOUR ROLE</span>
      <h1>이용 유형에 맞게 시작하세요.</h1>
      <p className="project-lead">로그인한 역할에 맞춰 필요한 화면으로 바로 연결합니다.</p>
      <div className="project-notice">
        현재는 데모 로그인입니다. 실제 계정 인증·가입은 진행하지 않으며, 비밀번호를 저장하거나
        전송하지 않습니다. 실제 비밀번호를 입력하지 마세요.
      </div>
      <label className="project-field">
        표시 이름 <small>이름을 입력하지 않으면 역할 이름을 사용합니다.</small>
        <input
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 김지원"
        />
      </label>
      <div className="project-login-grid">
        <form onSubmit={company}>
          <Building2 size={25} />
          <h2>{signup ? '채용 담당자 데모 가입' : '채용 담당자 로그인'}</h2>
          <p>여러 지원자의 서류를 같은 JD로 비교하세요.</p>
          <label className="project-field">
            회사 이메일
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
              autoComplete="off"
            />
          </label>
          <label className="project-field">
            데모 비밀번호
            <input
              type="password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="임의의 8자 이상 입력"
              required
              autoComplete="off"
            />
          </label>
          <Button disabled={busy} type="submit">
            {busy ? '진입 중…' : signup ? '데모 가입 후 시작' : '채용 담당자로 로그인'}
            <ArrowRight size={16} />
          </Button>
          <button type="button" className="project-text-button" onClick={() => setSignup(!signup)}>
            {signup ? '로그인으로 돌아가기' : '회원가입 체험'}
          </button>
        </form>
        <section>
          <UserRound size={25} />
          <h2>구직자 간편 로그인</h2>
          <p>로그인 후 JD와 내 서류 등록을 바로 시작합니다.</p>
          {['카카오', '구글', '네이버'].map((provider) => (
            <button
              disabled={busy}
              className={`project-social social-${provider}`}
              key={provider}
              onClick={() => enter('applicant', provider)}
            >
              {provider}로 시작하기<span>데모</span>
            </button>
          ))}
          <small>
            실제 소셜 계정에 연결하지 않습니다. 세 버튼 모두 같은 구직자 데모 프로필을 사용합니다.
          </small>
        </section>
      </div>
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
