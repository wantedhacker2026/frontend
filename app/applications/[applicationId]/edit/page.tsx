import { ApplicationForm } from '@/components/applicant/application-form';
export default async function Page({ params }: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = await params;
  return <ApplicationForm applicationId={applicationId} />;
}
