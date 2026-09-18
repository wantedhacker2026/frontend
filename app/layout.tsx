import type { Metadata } from 'next';
import { ProjectProvider } from '@/lib/projects/store';
import { StoreProvider } from '@/lib/store';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'wantedhacker — 더 좋은 채용의 시작', template: '%s | wantedhacker' },
  description:
    'JD 기반 정량 평가로 지원자를 빠르게 비교하고 지원자에게 구체적인 성장 방향을 제공하는 채용 플랫폼.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <a className="skip-link" href="#content">
          본문으로 이동
        </a>
        <ProjectProvider>
          <StoreProvider>
            <div id="content">{children}</div>
          </StoreProvider>
        </ProjectProvider>
      </body>
    </html>
  );
}
