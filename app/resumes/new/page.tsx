import { ResumeEditor } from '@/components/applicant/resume-editor';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string; applicationId?: string }>;
}) {
  const { jobId, applicationId } = await searchParams;
  return <ResumeEditor key={applicationId ?? 'new'} jobId={jobId} applicationId={applicationId} />;
}
