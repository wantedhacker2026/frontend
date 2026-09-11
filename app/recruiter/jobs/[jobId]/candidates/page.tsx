import { CandidatesPage } from '@/components/recruiter/candidates-page';
export default async function Page({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return <CandidatesPage jobId={jobId} />;
}
