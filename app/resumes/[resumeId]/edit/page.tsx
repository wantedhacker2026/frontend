import { ResumeEditor } from '@/components/applicant/resume-editor';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ resumeId: string }>;
  searchParams: Promise<{ jobId?: string }>;
}) {
  const { resumeId } = await params;
  const { jobId } = await searchParams;
  return <ResumeEditor key={resumeId} resumeId={resumeId} jobId={jobId} />;
}
