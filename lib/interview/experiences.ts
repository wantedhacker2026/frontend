import type { ProjectCriterion, ProjectRevision } from '../projects/types';
import type { InterviewInput } from './types';

// Extract experience statements from this applicant's documents, independently of JD matches.
// This is a bounded, deterministic extractor; the backend AI writes the questions afterwards.
const action =
  /구현|개발|설계|개선|최적화|구축|운영|자동화|배포|마이그레이션|분석|해결|검증|테스트|기획|관리|조율|협업|리딩|주도|도입|수립|수행|제작|출시|실험|전환|감소|단축|증가|달성|담당|연동|built|developed|designed|implemented|improved|reduced|managed|led|launched|migrated|optimized|automated/iu;
const aspiration =
  /(?:경험|경력)\s*(?:이|은|는)?\s*없|(?:하지|보지|하지는|보지는)\s*않|사용해?\s*보지|해본\s*적[이 ]*없|하고\s*싶|배우고\s*싶|희망|예정|목표로|경험하고자|경험이\s*아닌|\bno experience\b|\bnever\b|\bwant to\b|\bplan to\b/i;
const privateLine =
  /@|https?:\/\/|\b01[016789][- .]?\d{3,4}[- .]?\d{4}\b|생년|주민등록|가족|종교|결혼|병력|장애인|성별|출신|(?:^|\s)(?:이름|성명|주소|연락처)\s*[:：]/;
const selfDescription =
  /(?:개발자|엔지니어|디자이너|기획자|매니저|사람|인재)(?:입니다|예요)[.!。]?$/;

function hash(value: string) {
  let n = 2166136261;
  for (let i = 0; i < value.length; i++) n = Math.imul(n ^ value.charCodeAt(i), 16777619);
  return (n >>> 0).toString(36);
}

export function extractExperienceTopics(
  revision: ProjectRevision,
  personId: string,
  criteria: ProjectCriterion[],
  jd: string,
): NonNullable<InterviewInput['experienceTopics']> {
  const candidates: Array<{
    topic: NonNullable<InterviewInput['experienceTopics']>[number];
    strength: number;
  }> = [];
  const seen = new Set<string>();
  for (const doc of revision.documents) {
    if (doc.applicantId !== personId || doc.status !== 'ready') continue;
    for (const page of doc.pages) {
      if (doc.unreadablePages?.includes(page.number)) continue;
      for (const raw of page.text.split(/\n+|(?<=[.!?。])\s+/u)) {
        const excerpt = raw.replace(/^[\s•●▪\-–*]+/u, '').trim();
        if (
          excerpt.length < 12 ||
          excerpt.length > 2000 ||
          !action.test(excerpt) ||
          aspiration.test(excerpt) ||
          selfDescription.test(excerpt) ||
          privateLine.test(excerpt)
        )
          continue;
        const normalized = excerpt.replace(/\s+/g, ' ').toLowerCase();
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        const related = criteria.filter((c) =>
          c.keywords.some((k) => k.trim() && normalized.includes(k.toLowerCase())),
        );
        const jdEvidence =
          jd
            .split(/\n/)
            .find((line) =>
              related.some((c) =>
                c.keywords.some((k) => k.trim() && line.toLowerCase().includes(k.toLowerCase())),
              ),
            )
            ?.trim()
            .slice(0, 1500) ?? '';
        candidates.push({
          topic: {
            id: `experience-${hash(`${doc.id}:${page.number}:${normalized}`)}`,
            name: excerpt.length > 100 ? `${excerpt.slice(0, 99)}…` : excerpt,
            jdEvidence,
            evidence: 'review',
            sources: [{ documentId: doc.id, filename: doc.filename, page: page.number, excerpt }],
          },
          // Prefer concrete actions/results; JD overlap breaks ties but never creates a topic.
          strength:
            (/\d+\s*(?:%|배|건|명|초|ms|개월|억|만)/i.test(excerpt) ? 2 : 0) +
            (/구현|설계|개선|해결|조율|출시|built|improved|led/i.test(excerpt) ? 2 : 0) +
            (related.length ? 1 : 0),
        });
      }
    }
  }
  return candidates
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 12)
    .map((c) => c.topic);
}
