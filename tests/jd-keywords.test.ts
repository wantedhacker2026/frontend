import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { containsKeyword, generateCriteria, validateCriteria } from '../data/mock/criteria';
import { deriveCriteria, validateDraft } from '../lib/projects/domain';
import { demoDraft } from '../lib/projects/demo';
import { keywordRequestSchema } from '../lib/evaluation/keyword-contract';
import { MAX_ANALYSIS_CRITERIA } from '../lib/evaluation/limits';
import type { ProjectActor } from '../lib/projects/types';

const jd = readFileSync(new URL('./fixtures/gowid-jd.txt', import.meta.url), 'utf8');
const actor: ProjectActor = { id: 'r', name: '담당자', role: 'recruiter', provider: '데모' };

test('Gowid JD extracts its stack and practical experience criteria with only mentioned keywords', () => {
  const criteria = deriveCriteria(jd);
  for (const name of [
    'Java / Kotlin',
    'Spring Framework',
    'REST API',
    'Database',
    'Docker',
    'Kubernetes',
    'JPA / ORM',
    'Kafka',
    'Redis',
    'Netty / 비동기 네트워크',
    'Cloud',
    '외부 서비스 연동',
    'SaaS / 구독 서비스',
    '계약 / 라이선스 / 청구',
    '상품 / 주문 / 재고 생애주기',
    '데이터 모델링',
    '비즈니스 로직 / 요구사항 구현',
    '데이터 정합성',
    '예외 처리 / 엣지 케이스',
    '운영 자동화',
    '운영 / 성과 측정',
    '설계 판단 / 비즈니스 임팩트',
    'AI 도구 활용 / 검증',
    '테스트',
    '협업 경험',
  ])
    assert.ok(
      criteria.some((c) => c.name === name),
      `Missing ${name}`,
    );
  assert.ok(criteria.length > 20);
  assert.ok(criteria.length <= MAX_ANALYSIS_CRITERIA);
  assert.ok(criteria.every((c) => c.keywords.every((k) => containsKeyword(jd, k))));
  for (const keyword of [
    'k8s',
    'spring data jpa',
    'google cloud',
    'google workspace',
    'rdbms',
    '데이터 정합성',
    'ai 도구',
  ])
    assert.ok(
      criteria.some((c) => c.keywords.includes(keyword)),
      keyword,
    );
  assert.equal(validateCriteria(generateCriteria('gowid', jd)), null);
});

test('qualifications mark testing and design criteria required while stack-only JPA stays optional', () => {
  const criteria = deriveCriteria(jd);
  for (const name of [
    '테스트',
    '데이터 모델링',
    '설계 판단 / 비즈니스 임팩트',
    'AI 도구 활용 / 검증',
  ])
    assert.equal(criteria.find((c) => c.name === name)?.required, true, name);
  assert.equal(criteria.find((c) => c.name === 'JPA / ORM')?.required, false);
  const preferred = generateCriteria('p', '우대사항\nJPA\n자격요건\n테스트와 데이터 정합성');
  assert.equal(preferred.find((c) => c.name === 'JPA / ORM')?.required, false);
  assert.equal(preferred.find((c) => c.name === '테스트')?.required, true);
});

test('expanded criteria pass draft and API validation; 51 criteria are rejected consistently', () => {
  const draft = demoDraft(actor);
  draft.jd.text = jd;
  draft.criteria = deriveCriteria(jd);
  assert.doesNotThrow(() => validateDraft(draft, actor));
  const body = {
    criteria: draft.criteria.map(({ id, keywords }) => ({ id, keywords })),
    text: 'Kotlin, Hibernate, GCP, JUnit',
  };
  assert.equal(keywordRequestSchema.safeParse(body).success, true);
  draft.criteria = Array.from({ length: 50 }, (_, i) => ({ ...draft.criteria[0], id: `c-${i}` }));
  assert.doesNotThrow(() => validateDraft(draft, actor));
  assert.equal(keywordRequestSchema.safeParse({ ...body, criteria: draft.criteria }).success, true);
  draft.criteria.push({ ...draft.criteria[0], id: 'overflow' });
  assert.throws(() => validateDraft(draft, actor), /50개/);
  assert.equal(
    keywordRequestSchema.safeParse({ ...body, criteria: draft.criteria }).success,
    false,
  );
});

test('unrelated generic words do not introduce tool or AI criteria', () => {
  const criteria = deriveCriteria('협업 과정과 코드의 정확성, 서비스 적용 가능성을 검토합니다.');
  assert.ok(
    !criteria.some((c) =>
      ['AI 도구 활용 / 검증', 'Kubernetes', 'Netty / 비동기 네트워크'].includes(c.name),
    ),
  );
  assert.equal(containsKeyword('NoSQL JavaScript', 'sql'), false);
  assert.equal(containsKeyword('NoSQL JavaScript', 'java'), false);
});
