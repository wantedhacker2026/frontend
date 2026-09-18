import type { ProjectCriterion, ProjectRevision } from '../projects/types';
import type { InterviewInput } from './types';

// Extract statements only inside explicit employment sections, independently of JD matches.
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

// A missing heading is ambiguous: never treat the whole document as employment history.
const careerHeading =
  /^(?:경력(?:\s*(?:사항|기술서|소개|요약|상세|내역))?|직장\s*경력|업무\s*경험|실무\s*경험|work\s*(?:experience|history)|professional\s*experience|employment(?:\s*history)?|career(?:\s*history)?|experience)(?:\s*[（(][^()（）]*[)）]|\s*\d+\s*(?:년|개월)(?:\s*\d+\s*개월)?)?$/iu;
const otherHeading =
  /^(?:자기\s*소개(?:서)?|소개|프로필|지원\s*동기|입사\s*후\s*포부|학력(?:\s*사항)?|교육(?:\s*(?:사항|이력|수료))?|기술(?:\s*(?:스택|역량))?|보유\s*(?:기술|역량)|핵심\s*역량|역량|프로젝트(?:\s*(?:경험|이력))?|개인\s*프로젝트|사이드\s*프로젝트|포트폴리오|자격(?:증|\s*사항)?|수상(?:\s*(?:경력|내역))?|대외\s*활동|기타(?:\s*(?:경험|활동|사항))?|봉사(?:\s*활동)?|어학(?:\s*(?:능력|사항))?|논문|취미|관심사|연락처|about(?:\s*me)?|summary|profile|objective|education|training|(?:technical\s*)?skills|(?:personal\s*|side\s*)?projects|portfolio|certifications?|awards?|activities|volunteering|languages|publications?|interests|contact|references)$/iu;

function heading(line: string): { career: boolean; rest: string } | null {
  const clean = line
    .trim()
    .replace(/^[#•●▪\-*\d.)\s]+/u, '')
    .replace(/[：:]\s*$/, '')
    .trim();
  const label = clean.replace(/^\[([^\]]+)\]$/, '$1').trim();
  if (careerHeading.test(label)) return { career: true, rest: '' };
  if (otherHeading.test(label)) return { career: false, rest: '' };
  const inline = clean.match(/^(.{1,45}?)(?:\s*[:：|]\s*|\]\s+)(.+)$/u);
  if (inline) {
    const prefix = inline[1].replace(/^\[|\]$/g, '').trim();
    if (careerHeading.test(prefix)) return { career: true, rest: inline[2] };
    // A named project inside employment history describes work at that employer.
    if (prefix === '프로젝트' || /^project$/i.test(prefix)) return null;
    if (otherHeading.test(prefix)) return { career: false, rest: '' };
  }
  return null;
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
    let inCareer = false;
    for (const page of [...doc.pages].sort((a, b) => a.number - b.number)) {
      if (doc.unreadablePages?.includes(page.number) || !page.text.trim()) {
        inCareer = false;
        continue;
      }
      for (const line of page.text.split(/\r?\n/u)) {
        const section = heading(line);
        if (section) inCareer = section.career;
        if (!inCareer) continue;
        for (const raw of (section ? section.rest : line).split(/(?<=[.!?。])\s+/u)) {
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
  }
  return candidates
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 12)
    .map((c) => c.topic);
}
