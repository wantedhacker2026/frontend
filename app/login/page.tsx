import { ProjectLogin } from '@/components/projects/login';
import { ProjectShell } from '@/components/projects/shell';
export default function Page() {
  return (
    <ProjectShell>
      <ProjectLogin />
    </ProjectShell>
  );
}
