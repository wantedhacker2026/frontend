import { backendDescription, createSeedDatabase, sampleApplication } from '@/data/mock/seed';
import type { ApplicationInput } from '@/types';
import { deriveCriteria } from './domain';
import type { ProjectActor, ProjectDocument, ProjectDraft } from './types';
export function resumeDocument(
  content: ApplicationInput,
  title: string,
  applicantId: string,
): ProjectDocument {
  const text = `${content.name}\n기술 스택\n${content.skills}\n프로젝트 경험\n${content.projects}\n자기소개\n${content.introduction}\n지원동기\n${content.motivation}\n협업 경험\n${content.collaboration}\n추가 경험\n${content.additionalExperience}`;
  return {
    id: crypto.randomUUID(),
    applicantId,
    registeredAt: new Date().toISOString(),
    filename: title,
    size: new Blob([text]).size,
    status: 'ready',
    source: 'resume',
    pages: [{ number: 1, text }],
  };
}
export function demoDraft(actor: ProjectActor): ProjectDraft {
  const draft: ProjectDraft = {
    id: crypto.randomUUID(),
    title: 'Backend Engineer',
    jd: { mode: 'text', reference: '데모 채용공고', text: backendDescription },
    criteria: deriveCriteria(backendDescription),
    people: [],
    documents: [],
  };
  if (actor.role === 'applicant') {
    const id = crypto.randomUUID();
    draft.people = [{ id, name: actor.name, birthDate: '', experience: 1 }];
    draft.documents = [
      {
        ...resumeDocument({ ...sampleApplication, name: actor.name }, '예시 이력서.txt', id),
        source: 'demo',
      },
    ];
  } else {
    const db = createSeedDatabase();
    for (const app of db.applications) {
      const candidate = db.candidates.find((c) => c.id === app.candidateId)!;
      draft.people.push({
        id: candidate.id,
        name: candidate.name,
        birthDate: '',
        experience: app.experience,
      });
      draft.documents.push({
        ...resumeDocument(
          { ...app, name: candidate.name, email: '' },
          `${candidate.name}_이력서.txt`,
          candidate.id,
        ),
        source: 'demo',
      });
    }
  }
  return draft;
}
