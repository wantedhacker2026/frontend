import { ProjectHome } from '@/components/projects/home';
import { ProjectShell } from '@/components/projects/shell';
export default function Page() {
  return (
    <ProjectShell>
      <ProjectHome />
    </ProjectShell>
  );
}
