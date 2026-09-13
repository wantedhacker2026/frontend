import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  FileText,
  ScanLine,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { PublicNav, Logo } from './shell';
import { Button } from './ui/button';
export function Landing() {
  return (
    <div className="landing">
      <PublicNav />
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="hero-eyebrow">
              <span />
              BETTER SIGNALS. BETTER DECISIONS.
            </div>
            <h1>
              지원서를 읽는 시간은 줄이고,
              <br />
              <span>더 좋은 채용 결정</span>에<br />
              집중하세요.
            </h1>
            <p>
              JD 기반 정량 평가로 지원자의 가능성을 빠르게 발견하고,
              <br className="desktop-br" /> 지원자에게는 다음 성장 방향을 제공합니다.
            </p>
            <div className="hero-actions">
              <Button size="lg" asChild>
                <Link href="/recruiter/jobs">
                  채용담당자로 체험하기
                  <ArrowRight size={17} />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/jobs">
                  지원자로 체험하기
                  <ArrowUpRight size={17} />
                </Link>
              </Button>
            </div>
            <div className="hero-assurance">
              <span>
                <Check size={14} />
                회원가입 없이 시작
              </span>
              <span>
                <Check size={14} />
                20개의 샘플 지원서
              </span>
              <span>
                <Check size={14} />
                근거 기반 평가
              </span>
            </div>
          </div>
          <div className="hero-product">
            <div className="product-window">
              <div className="product-window-header">
                <div className="window-dots">
                  <i />
                  <i />
                  <i />
                </div>
                <span>wantedhacker / candidate overview</span>
                <ScanLine size={15} />
              </div>
              <div className="product-window-body">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="eyebrow">CANDIDATE OVERVIEW</p>
                    <h2>Backend Engineer</h2>
                  </div>
                  <span className="hiring-badge">채용 중</span>
                </div>
                <div className="preview-stats">
                  <div>
                    <span>지원자</span>
                    <strong>
                      12<small>명</small>
                    </strong>
                  </div>
                  <div>
                    <span>모든 경험을</span>
                    <strong>하나의 기준으로.</strong>
                  </div>
                </div>
                <div className="preview-table">
                  <div className="preview-table-head">
                    <span>지원자</span>
                    <span>JD Match</span>
                    <span>핵심 역량</span>
                  </div>
                  {[
                    { name: '김지원', score: 96, tags: 'Spring · Kafka', color: '0' },
                    { name: '이서준', score: 88, tags: 'Kotlin · Redis', color: '1' },
                    { name: '박민지', score: 82, tags: 'Java · Spring', color: '2' },
                  ].map((p, i) => (
                    <div className="preview-row" key={p.name}>
                      <span>
                        <i className={`candidate-avatar avatar-${p.color}`}>{p.name.slice(1)}</i>
                        <strong>{p.name}</strong>
                      </span>
                      <span>
                        <strong>{p.score}</strong>
                        <small className={i < 2 ? 'preview-strong' : 'preview-good'}>
                          {i < 2 ? 'Strong' : 'Good'} Match
                        </small>
                      </span>
                      <span className="preview-tags">{p.tags}</span>
                    </div>
                  ))}
                </div>
                <div className="preview-insight">
                  <Sparkles size={16} />
                  <p>숫자 너머의 경험까지, 근거로 확인하세요.</p>
                  <ArrowRight size={15} />
                </div>
              </div>
            </div>
            <div className="floating-evidence">
              <span>
                <CheckCheck size={18} />
              </span>
              <div>
                <strong>가능성을 뒷받침하는 근거</strong>
                <p>“주문 API 응답 시간을 40% 개선했습니다.”</p>
              </div>
            </div>
            <div className="product-caption">실제 동작하는 데모 · 표시된 점수는 화면 예시</div>
          </div>
        </section>
        <section className="landing-process">
          <span>FROM APPLICATIONS TO POSSIBILITIES</span>
          <div>
            <p>
              <FileText size={19} />
              JD 등록
            </p>
            <ArrowRight size={15} />
            <p>
              <ScanLine size={19} />
              평가 기준 생성
            </p>
            <ArrowRight size={15} />
            <p>
              <Users size={19} />
              지원자 비교
            </p>
            <ArrowRight size={15} />
            <p>
              <TrendingUp size={19} />
              다음 성장 액션
            </p>
          </div>
        </section>
        <section className="landing-features" id="features">
          <div className="feature-intro">
            <span className="eyebrow">TWO SIDES. ONE BETTER EXPERIENCE.</span>
            <h2>
              채용의 양쪽 모두에,
              <br />더 나은 다음 단계.
            </h2>
            <p>
              빠른 판단을 넘어, 서로의 가능성을
              <br />더 정확하게 이해하는 경험을 만듭니다.
            </p>
          </div>
          <article>
            <span className="feature-icon">
              <Users size={23} />
            </span>
            <span className="eyebrow">FOR RECRUITERS</span>
            <h3>
              더 적게 읽고,
              <br />더 명확하게 결정하세요.
            </h3>
            <p>같은 기준으로 평가된 지원자를 한눈에 비교하고, 필요한 근거만 깊이 살펴보세요.</p>
            <ul>
              <li>
                <Check size={15} />
                JD 기반의 일관된 평가 기준
              </li>
              <li>
                <Check size={15} />
                핵심 역량과 검토할 부분을 한눈에
              </li>
              <li>
                <Check size={15} />
                지원서 근거로 확인하는 평가
              </li>
            </ul>
            <Link href="/recruiter/jobs">
              채용 대시보드 체험
              <ArrowRight size={16} />
            </Link>
          </article>
          <article>
            <span className="feature-icon peach">
              <TrendingUp size={23} />
            </span>
            <span className="eyebrow">FOR CANDIDATES</span>
            <h3>
              탈락 이유가 아니라,
              <br />
              다음 기회를 준비하는 방법.
            </h3>
            <p>현재 경험이 JD와 어떻게 연결되는지 이해하고, 지금 할 수 있는 행동을 찾아보세요.</p>
            <ul>
              <li>
                <Check size={15} />내 경험과 공고의 매칭 분석
              </li>
              <li>
                <Check size={15} />
                부족한 근거를 채우는 구체적인 가이드
              </li>
              <li>
                <Check size={15} />
                우선순위에 따라 실천하는 개선 계획
              </li>
            </ul>
            <Link href="/jobs">
              나의 다음 기회 찾기
              <ArrowRight size={16} />
            </Link>
          </article>
        </section>
        <section className="landing-bottom">
          <div>
            <span className="eyebrow">LESS GUESSWORK. MORE POTENTIAL.</span>
            <h2>
              더 나은 채용 경험,
              <br />
              지금 시작해 보세요.
            </h2>
          </div>
          <Button asChild size="lg">
            <Link href="/roles">
              내 역할로 시작하기
              <ArrowRight size={18} />
            </Link>
          </Button>
        </section>
      </main>
      <footer className="landing-footer">
        <Logo />
        <span>Better signals. Better decisions.</span>
        <span>© 2026 wantedhacker. Demo experience.</span>
      </footer>
    </div>
  );
}
export function RoleSelection() {
  return (
    <div className="role-page">
      <PublicNav />
      <main>
        <div className="eyebrow">WELCOME TO wantedhacker</div>
        <h1>어떤 기회를 찾고 계신가요?</h1>
        <p>회원가입 없이 바로 체험할 수 있어요.</p>
        <div className="role-cards">
          <Link href="/recruiter/jobs">
            <Users size={30} />
            <h2>좋은 동료를 찾고 있어요</h2>
            <p>
              같은 기준으로 지원자를 비교하고
              <br />
              근거를 바탕으로 검토하세요.
            </p>
            <span>
              채용담당자로 시작
              <ArrowRight size={17} />
            </span>
          </Link>
          <Link href="/jobs">
            <TrendingUp size={30} />
            <h2>다음 기회를 찾고 있어요</h2>
            <p>
              내 경험의 강점을 발견하고
              <br />
              다음 지원을 준비하세요.
            </p>
            <span>
              지원자로 시작
              <ArrowRight size={17} />
            </span>
          </Link>
        </div>
      </main>
    </div>
  );
}
