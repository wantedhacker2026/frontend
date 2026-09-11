import { ApplyFromResume } from '@/components/applicant/apply-from-resume';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{ resumeId?: string }>;
}) {
  const { jobId } = await params;
  const { resumeId } = await searchParams;
  return <ApplyFromResume key={`${jobId}-${resumeId ?? ''}`} jobId={jobId} resumeId={resumeId} />;
}
