'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="error-page">
      <h1>화면을 불러오지 못했어요.</h1>
      <p>입력한 내용은 브라우저에 저장되어 있을 수 있습니다. 다시 시도해 주세요.</p>
      <Button onClick={reset}>다시 시도</Button>
      <Link href="/">홈으로 돌아가기</Link>
    </main>
  );
}
