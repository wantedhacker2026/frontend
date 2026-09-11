import { CandidateDetail } from '@/components/recruiter/candidate-detail';
export default async function Page({
  params,
}: {
  params: Promise<{ jobId: string; candidateId: string }>;
}) {
  const { jobId, candidateId } = await params;
  return <CandidateDetail jobId={jobId} candidateId={candidateId} />;
}
