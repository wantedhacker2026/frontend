import { Suspense } from 'react';
import { NewProject } from '@/components/projects/new-project';
import { ProjectShell } from '@/components/projects/shell';
import { Skeleton } from '@/components/ui/states';
export default function Page() {
  return (
    <ProjectShell>
      <Suspense fallback={<Skeleton />}>
        <NewProject />
      </Suspense>
    </ProjectShell>
  );
}
