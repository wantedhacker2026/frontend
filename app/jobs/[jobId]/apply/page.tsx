import { ApplicationForm } from '@/components/applicant/application-form';
export default async function Page({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return <ApplicationForm jobId={jobId} />;
}
