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
    keywords: ['spring', '스프링', 'spring boot', '스프링 부트', 'springboot'],
    weight: 15,
    required: true,
  },
  {
    name: 'REST API',
    category: '기술 역량',
    keywords: ['rest api', 'restful', 'rest', 'api 설계', 'api 개발', 'api를 설계'],
    weight: 10,
    required: true,
  },
  {
    name: 'Database',
    category: '기술 역량',
    keywords: [
      'mysql',
      'postgresql',
      'postgres',
      'mariadb',
      'sql',
      'rdb',
      'rdbms',
      '관계형 데이터베이스',
    ],
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
    keywords: [
      '협업',
      '팀',
      '코드 리뷰',
      '코드리뷰',
      '팀원',
      '동료 엔지니어',
      'pm',
      '사업 담당자',
      '운영 담당자',
      '요구사항 조율',
    ],
    weight: 10,
    required: true,
  },
  { name: 'Redis', category: '우대사항', keywords: ['redis'], weight: 5, required: false },
  { name: 'Kafka', category: '우대사항', keywords: ['kafka'], weight: 5, required: false },
  {
    name: 'Cloud',
    category: '우대사항',
    keywords: ['aws', 'gcp', 'google cloud', '구글 클라우드', 'cloud', '클라우드', 'azure'],
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
    keywords: [
      'playwright',
      'jest',
      'vitest',
      '자동화 테스트',
      '테스트',
      'junit',
      'mockito',
      'testcontainers',
      '단위 테스트',
      '통합 테스트',
      '코드 검증',
      '코드의 정확성',
    ],
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
  {
    name: '아키텍처 설계 경험',
    category: '기술 역량',
    keywords: ['아키텍처 설계', '시스템 설계', 'architecture design', 'system design'],
    weight: 10,
    required: true,
  },
  {
    name: '서버 구현 경험',
    category: '기술 역량',
    keywords: [
      '서버 구현',
      '서버 개발',
      '백엔드 개발',
      '백엔드 시스템',
      'backend development',
      'backend system',
    ],
    weight: 10,
    required: true,
  },
  {
    name: 'Docker',
    category: '기술 역량',
    keywords: ['docker', '도커'],
    weight: 5,
    required: true,
  },
  {
    name: 'Kubernetes',
    category: '기술 역량',
    keywords: ['kubernetes', 'k8s', '쿠버네티스', 'gke', 'eks'],
    weight: 5,
    required: false,
  },
  {
    name: 'JPA / ORM',
    category: '기술 역량',
    keywords: ['spring data jpa', 'jpa', 'hibernate', 'orm', 'querydsl'],
    weight: 5,
    required: false,
  },
  {
    name: 'Netty / 비동기 네트워크',
    category: '기술 역량',
    keywords: ['netty', '네티', '비동기 네트워크', '논블로킹', 'non-blocking', 'webflux'],
    weight: 5,
    required: false,
  },
  {
    name: '외부 서비스 연동',
    category: '경험',
    keywords: [
      '외부 서비스',
      '외부 api',
      'api 연동',
      'google workspace',
      '구글 워크스페이스',
      'oauth',
      'oauth2',
      'webhook',
      '웹훅',
      '서드파티 연동',
    ],
    weight: 5,
    required: false,
  },
  {
    name: 'SaaS / 구독 서비스',
    category: '경험',
    keywords: ['saas', '구독 서비스', '구독 모델', 'subscription', '멀티테넌트', 'multi-tenant'],
    weight: 5,
    required: false,
  },
  {
    name: '계약 / 라이선스 / 청구',
    category: '경험',
    keywords: [
      '계약',
      '라이선스',
      '청구',
      '정산',
      '결제',
      '과금',
      'billing',
      'license',
      '사용량',
      '지출최적화',
      '지출 최적화',
    ],
    weight: 5,
    required: false,
  },
  {
    name: '상품 / 주문 / 재고 생애주기',
    category: '경험',
    keywords: [
      '상품',
      '재고',
      '주문',
      '배송',
      '반납',
      '인수',
      '주문 처리',
      '재고 관리',
      '이커머스',
      'e-commerce',
      'fulfillment',
    ],
    weight: 5,
    required: false,
  },
  {
    name: '데이터 모델링',
    category: '기술 역량',
    keywords: [
      '데이터 모델',
      '데이터 모델링',
      '데이터 구조',
      '데이터를 설계',
      '테이블 설계',
      '테이블을 직접 설계',
      '스키마 설계',
      'erd',
      'data modeling',
      'schema design',
    ],
    weight: 5,
    required: true,
  },
  {
    name: '비즈니스 로직 / 요구사항 구현',
    category: '경험',
    keywords: [
      '비즈니스 로직',
      '비즈니스 요구사항',
      '도메인 모델',
      '도메인 설계',
      '요구사항',
      'ddd',
      'business logic',
      'domain model',
    ],
    weight: 5,
    required: true,
  },
  {
    name: '데이터 정합성',
    category: '기술 역량',
    keywords: [
      '데이터 정합성',
      '정합성',
      '트랜잭션',
      'transaction',
      '동시성',
      '멱등성',
      'idempotency',
      '무결성',
      '분산 락',
    ],
    weight: 5,
    required: true,
  },
  {
    name: '예외 처리 / 엣지 케이스',
    category: '기술 역량',
    keywords: [
      '예외 상황',
      '예외 처리',
      '엣지 케이스',
      'edge case',
      '재시도',
      '장애 복구',
      '서킷 브레이커',
      'circuit breaker',
      '타임아웃',
    ],
    weight: 5,
    required: true,
  },
  {
    name: '운영 자동화',
    category: '경험',
    keywords: [
      '운영 업무',
      '운영 자동화',
      '자동화',
      '배치',
      '스케줄러',
      'ci/cd',
      'github actions',
      'jenkins',
      '업무 제품화',
    ],
    weight: 5,
    required: false,
  },
  {
    name: '운영 / 성과 측정',
    category: '경험',
    keywords: [
      '운영 결과',
      '운영 개선',
      '고객 반응',
      '처리 결과',
      '모니터링',
      '관측성',
      'observability',
      'prometheus',
      'grafana',
      '성과 측정',
      '장애 대응',
    ],
    weight: 5,
    required: false,
  },
  {
    name: '설계 판단 / 비즈니스 임팩트',
    category: '경험',
    keywords: [
      '비즈니스 임팩트',
      '우선순위',
      '설계 의도',
      '판단 근거',
      '트레이드오프',
      'trade-off',
      'tradeoff',
      '고객과 사업의 성과',
    ],
    weight: 5,
    required: true,
  },
  {
    name: 'AI 도구 활용 / 검증',
    category: '기술 역량',
    keywords: [
      'ai 도구',
      '생성된 코드',
      'ai 코드',
      'github copilot',
      'copilot',
      'cursor',
      'chatgpt',
      'claude code',
      'codex',
    ],
    weight: 5,
    required: true,
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
    else if (/지원\s*자격|자격\s*요건|필수\s*조건|필수\s*역량|requirements/i.test(line))
      section = true;
    else if (/주요\s*업무|일하는\s*방식|기술\s*스택/.test(line)) section = null;
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
