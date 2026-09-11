import { SearchX, ArrowRight, LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from './button';
export function Skeleton() {
  return (
    <div className="skeleton-wrap" aria-label="불러오는 중" role="status">
      <div className="skeleton h-7 w-40" />
      <div className="skeleton h-12 w-80 max-w-full" />
      <div className="grid grid-cols-3 gap-6 my-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-28" />
        ))}
      </div>
      <div className="skeleton h-80" />
    </div>
  );
}
export function EmptyState({
  title = '결과가 없습니다',
  description = '다른 조건으로 다시 찾아보세요.',
  href,
  label,
  onReset,
}: {
  title?: string;
  description?: string;
  href?: string;
  label?: string;
  onReset?: () => void;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <SearchX size={26} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {href && (
        <Button asChild variant="outline">
          <Link href={href}>
            {label ?? '돌아가기'}
            <ArrowRight size={16} />
          </Link>
        </Button>
      )}
      {onReset && (
        <Button variant="outline" onClick={onReset}>
          필터 초기화
        </Button>
      )}
    </div>
  );
}
export function Busy({ text = '분석하고 있습니다' }: { text?: string }) {
  return (
    <span className="flex items-center gap-2">
      <LoaderCircle className="animate-spin" size={16} />
      {text}
    </span>
  );
}
