import { ProjectResults } from '@/components/projects/analysis';
import { ProjectShell } from '@/components/projects/shell';
export default async function Page({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return (
    <ProjectShell>
      <ProjectResults projectId={projectId} role="recruiter" />
    </ProjectShell>
  );
}
