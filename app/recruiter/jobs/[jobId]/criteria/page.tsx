import { JobForm } from '@/components/recruiter/job-form';
export default async function Page({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return <JobForm jobId={jobId} />;
}
