import { EmptyState } from '@/components/ui/states';
export default function NotFound() {
  return (
    <EmptyState
      title="찾으시는 페이지가 없습니다"
      description="주소를 확인하거나 홈에서 다시 시작해 주세요."
      href="/"
      label="홈으로 이동"
    />
  );
}
