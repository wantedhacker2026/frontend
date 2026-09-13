import type { Application, Database, Job } from '@/types';
import { generateCriteria } from './criteria';
import { MockCandidateEvaluator } from '@/lib/evaluation/mock-evaluator';
const seedEvaluator = new MockCandidateEvaluator();
export const backendDescription = `함께 일하는 방식을 바꾸는 제품을 만듭니다.
wantedhacker에서 안정적이고 확장 가능한 서비스를 함께 만들어 갈 Backend Engineer를 찾습니다.

주요 업무
• 핵심 서비스의 백엔드 API 설계 및 개발
• 서비스 성능 개선과 안정적인 운영
• 제품, 디자인, 프론트엔드 팀과 긴밀한 협업

지원 자격
• Java 또는 Kotlin 기반 서버 개발 경험
• Spring Framework 경험
• REST API 설계 경험
• MySQL 등 관계형 데이터베이스 경험
• 협업 프로젝트 경험

우대 사항
• Redis, Kafka 사용 경험
• 대규모 트래픽 처리 및 성능 개선 경험
• AWS 또는 GCP 운영 경험

일하는 방식
서로의 의견을 존중하고, 문제를 정의하는 일부터 함께합니다.
서울 성수 · 주 2회 재택 · 정규직`;
export const seedJobs: Job[] = [
  {
    id: 'backend',
    companyName: 'wantedhacker',
    title: 'Backend Engineer',
    role: '백엔드 개발',
    description: backendDescription,
    createdAt: '2026-09-07T00:00:00.000Z',
    location: '서울 성수 · 하이브리드',
    employmentType: '정규직',
    minExperience: 1,
  },
  {
    id: 'frontend',
    companyName: 'wantedhacker',
    title: 'Frontend Engineer',
    role: '프론트엔드 개발',
    description:
      '사용자가 매일 찾는 제품 경험을 만듭니다.\n\n지원 자격\n• React, TypeScript 개발 경험\n• REST API 연동 경험\n• CSS와 반응형 UI 구현 경험\n• 웹 접근성을 고려한 프로젝트 경험\n• 팀 협업과 코드 리뷰 경험\n\n우대 사항\n• Next.js 경험\n• Playwright 자동화 테스트 경험',
    createdAt: '2026-09-05T00:00:00.000Z',
    location: '서울 성수 · 하이브리드',
    employmentType: '정규직',
    minExperience: 1,
  },
  {
    id: 'data',
    companyName: 'wantedhacker',
    title: 'Data Engineer',
    role: '데이터 엔지니어',
    description:
      '제품 의사결정의 기반이 되는 데이터를 연결합니다.\n\n지원 자격\n• Python, SQL 기반 개발 경험\n• ETL 데이터 파이프라인 구축 경험\n• Airflow 운영 경험\n• 데이터 프로젝트 및 팀 협업 경험\n\n우대 사항\n• Spark, Kafka 경험\n• AWS 또는 GCP 운영 경험',
    createdAt: '2026-09-03T00:00:00.000Z',
    location: '서울 성수 · 하이브리드',
    employmentType: '정규직',
    minExperience: 2,
  },
];
interface Profile {
  name: string;
  job: string;
  years: number;
  skills: string;
  projects: string;
  collaboration: string;
  extra?: string;
}
const profiles: Profile[] = [
  {
    name: '김지원',
    job: 'backend',
    years: 4,
    skills: 'Java, Spring Boot, MySQL, Redis, Kafka, AWS',
    projects:
      'Java와 Spring Boot로 REST API 주문 시스템을 설계하고 MySQL 쿼리를 개선해 응답 시간을 40% 단축했습니다.\nRedis 캐시와 Kafka 이벤트 처리를 구현해 초당 3,000건 트래픽을 운영했습니다.',
    collaboration: '5명의 팀과 협업하며 코드 리뷰를 담당하고 릴리스 과정을 개선했습니다.',
    extra: 'AWS 운영 환경에 서비스를 배포하고 장애 대응을 담당했습니다.',
  },
  {
    name: '이서준',
    job: 'backend',
    years: 3,
    skills: 'Kotlin, Spring, PostgreSQL, Redis, Kafka',
    projects:
      'Kotlin과 Spring으로 REST API를 개발하고 PostgreSQL 인덱스를 개선해 조회를 35% 단축했습니다.\nRedis와 Kafka를 활용한 알림 프로젝트를 구현했습니다.',
    collaboration: '4명 팀의 코드 리뷰와 협업 일정을 조율했습니다.',
    extra: '부하 테스트로 트래픽 병목을 해결했습니다.',
  },
  {
    name: '박민지',
    job: 'backend',
    years: 2,
    skills: 'Java, Spring Boot, MySQL, Redis, AWS',
    projects:
      'Java, Spring Boot 기반 REST API 프로젝트를 개발하고 MySQL 쿼리를 개선했습니다.\nRedis 캐시를 구현해 응답 시간을 30% 단축했습니다.',
    collaboration: '팀 협업에서 기획자와 API 변경 사항을 조율했습니다.',
    extra: 'AWS 배포를 담당했습니다.\nKafka 입문 강의를 수강했습니다.',
  },
  {
    name: '최유진',
    job: 'backend',
    years: 1,
    skills: 'Java, Spring, MySQL, Redis',
    projects: 'Java와 Spring으로 REST API 게시판 프로젝트를 구현하고 MySQL 테이블을 설계했습니다.',
    collaboration: '3명 팀과 협업하며 코드 리뷰를 담당했습니다.',
    extra: 'Redis 캐싱을 학습했습니다.',
  },
  {
    name: '정우진',
    job: 'backend',
    years: 1.5,
    skills: 'Kotlin, Spring Boot, MySQL',
    projects:
      'Kotlin, Spring Boot와 MySQL을 사용한 예약 프로젝트를 개발했습니다.\nREST API 설계를 학습했습니다.',
    collaboration: '팀 프로젝트에 참여한 경험이 있습니다.',
    extra: 'AWS 기본 과정을 수강했습니다.',
  },
  {
    name: '윤서연',
    job: 'backend',
    years: 0.5,
    skills: 'Java, Spring, MySQL, REST API',
    projects:
      'Java와 Spring으로 개인 블로그 프로젝트를 개발했습니다.\nMySQL과 REST API 튜토리얼을 학습했습니다.',
    collaboration: '스터디에서 팀원들과 개발 사례를 공유했습니다.',
  },
  {
    name: '한도윤',
    job: 'backend',
    years: 0,
    skills: 'Java, MySQL, Spring',
    projects: 'Java 프로젝트를 구현했습니다.\nSpring과 MySQL 강의를 수강했습니다.',
    collaboration: '개인 작업을 중심으로 포트폴리오를 만들었습니다.',
  },
  {
    name: '오지민',
    job: 'backend',
    years: 0,
    skills: 'Java, HTML, CSS',
    projects: 'Java 기초를 학습하고 콘솔 프로젝트 튜토리얼을 수강했습니다.',
    collaboration: '개인 학습 과정을 블로그에 기록했습니다.',
  },
  {
    name: '강하늘',
    job: 'backend',
    years: 5,
    skills: 'Kotlin, Spring, PostgreSQL, AWS, Redis',
    projects:
      'Kotlin과 Spring으로 REST API 결제 프로젝트를 개발하고 PostgreSQL을 운영했습니다.\nRedis로 대규모 트래픽 병목을 개선해 응답 시간을 60% 단축했습니다.',
    collaboration: '6명의 팀원과 협업하며 아키텍처 리뷰를 담당했습니다.',
    extra: 'AWS 운영 환경을 구축했습니다.',
  },
  {
    name: '서지호',
    job: 'backend',
    years: 2,
    skills: 'Java, Spring, MySQL, Kafka',
    projects:
      'Java와 Spring, MySQL 기반 REST API 서비스를 개발했습니다.\nKafka 알림 프로젝트를 구현했습니다.',
    collaboration: '팀에서 코드 리뷰와 문서화를 담당했습니다.',
  },
  {
    name: '임수빈',
    job: 'backend',
    years: 0.8,
    skills: 'Java, Spring, MySQL, REST API',
    projects:
      'Java와 Spring 기반 프로젝트를 구현했습니다.\nMySQL로 REST API 데이터 조회를 개발했습니다.',
    collaboration: '협업 프로젝트를 학습하며 팀 개발 과정을 공부했습니다.',
  },
  {
    name: '배현우',
    job: 'backend',
    years: 3,
    skills: 'Java, Spring, MySQL, AWS',
    projects: 'Java, Spring 기반 REST API 프로젝트를 개발하고 MySQL 성능을 25% 개선했습니다.',
    collaboration: '팀원과 협업하며 요구사항을 조율했습니다.',
    extra: 'AWS 배포와 트래픽 부하 테스트를 담당했습니다.',
  },
  {
    name: '이지은',
    job: 'frontend',
    years: 3,
    skills: 'React, TypeScript, CSS, Next.js, Playwright',
    projects:
      'React와 TypeScript로 REST API 대시보드 프로젝트를 개발하고 CSS 반응형 UI를 구현했습니다.\nNext.js와 Playwright 자동화 테스트로 배포 시간을 30% 단축했습니다.',
    collaboration: '4명 팀과 협업하며 접근성 코드 리뷰를 담당했습니다.',
  },
  {
    name: '김태오',
    job: 'frontend',
    years: 2,
    skills: 'React, TypeScript, CSS',
    projects:
      'React, TypeScript와 REST API 기반 프로젝트를 개발했습니다.\nCSS 반응형 디자인과 웹 접근성을 구현했습니다.',
    collaboration: '팀 협업에서 컴포넌트 코드 리뷰를 담당했습니다.',
  },
  {
    name: '신예린',
    job: 'frontend',
    years: 1,
    skills: 'React, JavaScript, CSS',
    projects:
      'React, CSS 기반 쇼핑몰 프로젝트를 개발했습니다.\nTypeScript와 REST API를 학습했습니다.',
    collaboration: '팀 협업 경험이 있습니다.',
  },
  {
    name: '문시우',
    job: 'frontend',
    years: 0,
    skills: 'HTML, CSS, React',
    projects: 'CSS 포트폴리오 프로젝트를 구현했습니다.\nReact 입문 과정을 수강했습니다.',
    collaboration: '개인 프로젝트를 정리했습니다.',
  },
  {
    name: '정다은',
    job: 'data',
    years: 4,
    skills: 'Python, SQL, Airflow, Spark, Kafka, AWS',
    projects:
      'Python과 SQL로 ETL 데이터 파이프라인 프로젝트를 개발하고 Airflow를 운영해 처리 시간을 50% 개선했습니다.\nSpark와 Kafka 스트리밍을 구축했습니다.',
    collaboration: '5명 팀과 협업하며 데이터 계약을 설계했습니다.',
    extra: 'AWS 운영 환경을 구축했습니다.',
  },
  {
    name: '홍준호',
    job: 'data',
    years: 2,
    skills: 'Python, SQL, Airflow, GCP',
    projects:
      'Python과 SQL 데이터 파이프라인 프로젝트를 개발했습니다.\nAirflow 배치를 구현하고 GCP를 운영했습니다.',
    collaboration: '팀 협업에서 지표 정의를 조율했습니다.',
  },
  {
    name: '유채원',
    job: 'data',
    years: 1,
    skills: 'Python, SQL, Airflow',
    projects:
      'Python과 SQL 분석 프로젝트를 구현했습니다.\nAirflow와 ETL 파이프라인을 학습했습니다.',
    collaboration: '팀 협업 과제에 참여했습니다.',
  },
  {
    name: '안도현',
    job: 'data',
    years: 0,
    skills: 'Python, SQL',
    projects: 'Python과 SQL 기초를 학습하고 분석 프로젝트 튜토리얼을 수강했습니다.',
    collaboration: '개인 학습 내용을 기록했습니다.',
  },
];
export const sampleApplication = {
  name: '김하린',
  email: 'harin@example.com',
  experience: 1,
  skills: 'Java, Spring Boot, MySQL, REST API',
  projects:
    'Java와 Spring Boot로 REST API 예약 프로젝트를 개발했습니다. MySQL 데이터베이스를 설계하고 조회 응답 시간을 30% 개선했습니다.',
  introduction: '사용자의 문제를 안정적인 서비스로 해결하는 백엔드 개발자입니다.',
  motivation: '제품의 성장 과정에서 안정적인 백엔드 개발에 기여하고 싶습니다.',
  collaboration: '3명의 팀원과 협업하며 API 명세를 조율하고 코드 리뷰를 담당했습니다.',
  additionalExperience: 'Redis 기초 강의를 수강했습니다.',
};
export function createSeedDatabase(): Database {
  const criteria = seedJobs.flatMap((j) => generateCriteria(j.id, j.description));
  const candidates = profiles.map((p, i) => ({
    id: `candidate-${i + 1}`,
    name: p.name,
    email: `candidate${i + 1}@example.com`,
  }));
  const applications: Application[] = profiles.map((p, i) => ({
    id: `application-${i + 1}`,
    candidateId: candidates[i].id,
    jobId: p.job,
    experience: p.years,
    skills: p.skills,
    projects: p.projects,
    introduction: '사용자의 문제를 해결하는 개발자로 성장하고 있습니다.',
    motivation: '제품의 가치를 높이는 개발에 기여하고 싶습니다.',
    collaboration: p.collaboration,
    additionalExperience: p.extra ?? '',
    createdAt: `2026-09-${String(8 + (i % 3)).padStart(2, '0')}T${String(9 + (i % 10)).padStart(2, '0')}:00:00.000Z`,
    status: i === 0 || i === 8 ? 'SHORTLISTED' : i % 4 === 1 ? 'REVIEWED' : 'NEW',
  }));
  return {
    version: 2,
    resumes: [],
    jobs: seedJobs,
    criteria,
    candidates,
    applications,
    evaluations: applications.map((a) =>
      seedEvaluator.evaluate(
        seedJobs.find((j) => j.id === a.jobId)!,
        criteria.filter((c) => c.jobId === a.jobId),
        a,
      ),
    ),
    completedActionIds: [],
    ownApplicationIds: [],
  };
}
