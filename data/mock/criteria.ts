import type { Category, EvaluationCriterion } from '@/types';
type Template = {
  name: string;
  category: Category;
  keywords: string[];
  weight: number;
  required: boolean;
};
const templates: Template[] = [
  {
    name: 'Java / Kotlin',
    category: '기술 역량',
    keywords: ['java', 'kotlin'],
    weight: 20,
    required: true,
  },
  {
    name: 'Spring Framework',
    category: '기술 역량',
    keywords: ['spring', '스프링'],
    weight: 15,
    required: true,
  },
  {
    name: 'REST API',
    category: '기술 역량',
    keywords: ['rest api', 'restful', 'rest'],
    weight: 10,
    required: true,
  },
  {
    name: 'Database',
    category: '기술 역량',
    keywords: ['mysql', 'postgresql', 'sql', 'rdb', '관계형 데이터베이스'],
    weight: 10,
    required: true,
  },
  {
    name: '프로젝트 경험',
    category: '경험',
    keywords: ['프로젝트', '개발', '구현', '구축'],
    weight: 15,
    required: true,
  },
  {
    name: '협업 경험',
    category: '협업',
    keywords: ['협업', '팀', '코드 리뷰', '코드리뷰', '팀원'],
    weight: 10,
    required: true,
  },
  { name: 'Redis', category: '우대사항', keywords: ['redis'], weight: 5, required: false },
  { name: 'Kafka', category: '우대사항', keywords: ['kafka'], weight: 5, required: false },
  {
    name: 'Cloud',
    category: '우대사항',
    keywords: ['aws', 'gcp', 'cloud', '클라우드'],
    weight: 5,
    required: false,
  },
  {
    name: '대규모 트래픽',
    category: '우대사항',
    keywords: ['트래픽', 'tps', '동시 접속', '동시접속', '부하 테스트'],
    weight: 5,
    required: false,
  },
  {
    name: 'React',
    category: '기술 역량',
    keywords: ['react', '리액트'],
    weight: 20,
    required: true,
  },
  {
    name: 'TypeScript',
    category: '기술 역량',
    keywords: ['typescript', '타입스크립트'],
    weight: 15,
    required: true,
  },
  {
    name: '웹 접근성',
    category: '기술 역량',
    keywords: ['접근성', 'wcag', 'aria'],
    weight: 10,
    required: true,
  },
  {
    name: 'CSS / UI',
    category: '기술 역량',
    keywords: ['css', 'tailwind', '반응형'],
    weight: 10,
    required: true,
  },
  {
    name: 'Next.js',
    category: '우대사항',
    keywords: ['next.js', 'nextjs'],
    weight: 5,
    required: false,
  },
  {
    name: '테스트',
    category: '우대사항',
    keywords: ['playwright', 'jest', 'vitest', '자동화 테스트'],
    weight: 5,
    required: false,
  },
  {
    name: 'Python',
    category: '기술 역량',
    keywords: ['python', '파이썬'],
    weight: 20,
    required: true,
  },
  {
    name: '데이터 파이프라인',
    category: '기술 역량',
    keywords: ['etl', '파이프라인', 'pipeline'],
    weight: 15,
    required: true,
  },
  { name: 'Airflow', category: '기술 역량', keywords: ['airflow'], weight: 10, required: true },
  { name: 'Spark', category: '우대사항', keywords: ['spark'], weight: 5, required: false },
  {
    name: '정보처리기사',
    category: '우대사항',
    keywords: ['정보처리기사'],
    weight: 5,
    required: false,
  },
];
export function containsKeyword(text: string, keyword: string): boolean {
  if (!keyword.trim()) return false;
  const escaped = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, 'i').test(text);
}
export function normalizeWeights(criteria: EvaluationCriterion[]): EvaluationCriterion[] {
  if (!criteria.length) return criteria;
  const total = criteria.reduce((sum, c) => sum + Math.max(0, c.weight), 0);
  let assigned = 0;
  return criteria.map((c, i) => {
    const weight =
      i === criteria.length - 1
        ? 100 - assigned
        : Math.floor(total ? (Math.max(0, c.weight) / total) * 100 : 100 / criteria.length);
    assigned += weight;
    return { ...c, weight };
  });
}
export function generateCriteria(jobId: string, description: string): EvaluationCriterion[] {
  const selected = templates
    .filter((t) => t.keywords.some((k) => containsKeyword(description, k)))
    .map((t) => ({ ...t }));
  // Respect the JD's required/preferred sections when they are explicitly present.
  let section: boolean | null = null;
  const requiredMentions = new Set<string>();
  const preferredMentions = new Set<string>();
  for (const line of description.split('\n')) {
    if (/우대\s*사항|우대\s*조건|preferred/i.test(line)) section = false;
    else if (/지원\s*자격|필수\s*조건|필수\s*역량|requirements/i.test(line)) section = true;
    else if (/주요\s*업무|일하는\s*방식/.test(line)) section = null;
    for (const t of selected)
      if (t.keywords.some((k) => containsKeyword(line, k))) {
        if (section === true) requiredMentions.add(t.name);
        if (section === false) preferredMentions.add(t.name);
      }
  }
  for (const t of selected) {
    if (requiredMentions.has(t.name)) t.required = true;
    else if (preferredMentions.has(t.name)) {
      t.required = false;
      t.category = '우대사항';
    }
  }
  if (!selected.some((t) => t.category === '경험')) selected.push(templates[4]);
  if (!selected.some((t) => t.category === '협업')) selected.push(templates[5]);
  return normalizeWeights(
    selected.map((t, i) => ({
      ...t,
      id: `${jobId}-criterion-${i}`,
      jobId,
      description: `${t.name} 관련 경험과 지원서에 기재된 구체적인 수행 근거를 확인합니다.`,
    })),
  );
}
export function validateCriteria(criteria: EvaluationCriterion[]): string | null {
  if (!criteria.length) return '평가 기준을 하나 이상 추가해 주세요.';
  if (
    criteria.some(
      (c) => !c.name.trim() || !c.description.trim() || !c.keywords.some((k) => k.trim()),
    )
  )
    return '모든 기준의 이름, 설명, 키워드를 입력해 주세요.';
  if (
    criteria.some((c) => !Number.isFinite(c.weight) || !Number.isInteger(c.weight) || c.weight <= 0)
  )
    return '배점은 1 이상의 정수여야 합니다.';
  if (criteria.reduce((s, c) => s + c.weight, 0) !== 100)
    return '총 배점이 100점이 되도록 조정해 주세요.';
  if (new Set(criteria.map((c) => c.name.trim().toLowerCase())).size !== criteria.length)
    return '동일한 이름의 평가 기준은 사용할 수 없습니다.';
  return null;
}
