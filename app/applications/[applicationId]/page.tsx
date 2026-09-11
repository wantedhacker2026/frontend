import { ApplicationResult } from '@/components/applicant/results';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/states';
export default async function Page({ params }: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = await params;
  return (
    <Suspense fallback={<Skeleton />}>
      <ApplicationResult applicationId={applicationId} />
    </Suspense>
  );
}
