import type { ActionType } from '@/types';
export interface Resource {
  id: string;
  type: ActionType;
  title: string;
  subtitle: string;
  description: string;
  steps: string[];
  duration: string;
  tags: string[];
}
export const resources: Resource[] = [
  {
    id: 'certification',
    type: 'CERTIFICATION',
    title: '정보처리기사 준비 가이드',
    subtitle: '국가기술자격 · 준비 예시',
    description:
      '한국산업인력공단 시행 자격증을 준비하는 학습 계획 예시입니다. 실제 응시 조건과 일정은 Q-Net에서 확인하세요.',
    steps: [
      '응시 자격과 최신 출제 기준 확인하기',
      '과목별 기초 개념을 정리하고 주간 학습 계획 세우기',
      '기출문제를 풀고 오답 원인을 기록하기',
    ],
    duration: '8주 계획 예시',
    tags: ['자격증', '학습 계획'],
  },
  {
    id: 'internship',
    type: 'INTERNSHIP',
    title: '백엔드 개발 인턴',
    subtitle: 'Example Tech · 가상 채용 예시',
    description:
      'Java / Spring 기반 API 개발과 테스트 업무를 경험하는 인턴십 예시입니다. 실제 모집 중인 공고가 아닙니다.',
    steps: [
      '관련 채용 사이트에서 인턴 공고를 탐색하기',
      '공고의 요구 역량과 프로젝트 경험 연결하기',
      '담당한 역할과 결과를 중심으로 지원서 작성하기',
    ],
    duration: '3개월 예시',
    tags: ['Java', 'Spring', '인턴십'],
  },
  {
    id: 'project',
    type: 'PROJECT',
    title: '작은 서비스, 분명한 기술 경험',
    subtitle: '실습 프로젝트 · 바로 시작할 수 있는 계획',
    description:
      '채팅, 예약, 주문 서비스 중 하나를 고르고 목표 기술을 한 가지 적용해 보세요. 실제 구현과 검증 결과가 중요합니다.',
    steps: [
      '채팅·예약·주문 중 한 가지 도메인과 해결할 문제 정하기',
      '개선할 역량을 적용하고 정상·실패 시나리오 테스트하기',
      '성능이나 동작을 측정하고 결과를 README에 기록하기',
      '설계 선택과 본인이 수행한 일을 포트폴리오로 정리하기',
    ],
    duration: '주말 2회',
    tags: ['프로젝트', '포트폴리오', '실습'],
  },
  {
    id: 'team',
    type: 'TEAM_PROJECT',
    title: '함께 만드는 실시간 채팅 서비스',
    subtitle: 'Backend / Frontend · 가상 프로젝트 예시',
    description:
      'Spring, Redis, WebSocket을 활용한 팀 프로젝트 계획입니다. 실제 팀원 매칭 기능은 제공하지 않습니다.',
    steps: [
      '개발 커뮤니티나 스터디에서 2~3명의 팀원 찾기',
      'API 명세와 역할을 합의하고 작은 이슈로 나누기',
      '서로 코드 리뷰를 진행하고 논의 내용을 기록하기',
      '갈등을 조율한 사례와 결과를 지원서에 정리하기',
    ],
    duration: '4주 계획',
    tags: ['팀 프로젝트', '코드 리뷰', '협업'],
  },
  {
    id: 'resume',
    type: 'RESUME_IMPROVEMENT',
    title: '경험이 보이는 지원서 쓰기',
    subtitle: '상황 → 역할 → 행동 → 결과',
    description:
      '실제 경험을 구체적으로 표현하는 4단계 작성 가이드입니다. 경험하지 않은 기술이나 성과를 추가하지 마세요.',
    steps: [
      '상황: 어떤 문제를 해결해야 했는지 한 문장으로 정리하기',
      '역할: 팀의 성과 중 본인이 맡은 책임을 구분하기',
      '행동: 적용한 기술과 선택한 이유를 구체적으로 설명하기',
      '결과: 확인 가능한 변화나 배운 점을 덧붙이기',
    ],
    duration: '30분',
    tags: ['자기소개서', '근거', '커뮤니케이션'],
  },
  {
    id: 'portfolio',
    type: 'PORTFOLIO',
    title: '프로젝트를 증명하는 README',
    subtitle: '포트폴리오 정리 가이드',
    description: '기술 목록보다 문제 해결 과정을 보여주는 프로젝트 기록을 만드세요.',
    steps: [
      '해결한 문제와 서비스 사용 흐름 설명하기',
      '아키텍처와 기술 선택의 이유를 정리하기',
      '본인의 기여와 검증 결과를 명확하게 기록하기',
    ],
    duration: '2시간',
    tags: ['GitHub', 'README', '포트폴리오'],
  },
  {
    id: 'learning',
    type: 'LEARNING',
    title: '기초부터 배포까지, 직접 해보는 학습',
    subtitle: 'Kafka / Cloud 학습 계획 예시',
    description:
      '공식 문서의 시작 가이드를 따라 작은 예제를 만들고, 정상 동작과 실패 상황을 직접 확인해 보세요.',
    steps: [
      '학습할 기술의 핵심 개념 3가지를 정리하기',
      '로컬 환경에서 최소 예제를 실행하기',
      '실패 시나리오를 만들고 로그로 원인을 확인하기',
      '학습 내용을 작은 프로젝트에 적용하고 회고하기',
    ],
    duration: '8시간',
    tags: ['학습', '실습', '기술 문서'],
  },
];
