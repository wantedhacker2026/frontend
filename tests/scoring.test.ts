import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedDatabase, sampleApplication, seedJobs } from '../data/mock/seed';
import {
  containsKeyword,
  generateCriteria,
  normalizeWeights,
  validateCriteria,
} from '../data/mock/criteria';
import { MockCandidateEvaluator } from '../lib/evaluation/mock-evaluator';
const evaluator = new MockCandidateEvaluator();
import { calculateScore, scoreCriterion, scoreLabel } from '../lib/scoring';
import { parseDatabase } from '../lib/persistence';
import type { Application, EvaluationCriterion } from '../types';
const job = seedJobs[0];
const criteria = generateCriteria(job.id, job.description);
const application: Application = {
  ...sampleApplication,
  id: 'test-app',
  jobId: job.id,
  candidateId: 'test-candidate',
  createdAt: '2026-09-11T00:00:00.000Z',
  status: 'NEW',
};
const kafka: EvaluationCriterion = {
  id: 'kafka',
  jobId: 'backend',
  name: 'Kafka',
  description: 'Kafka 수행 근거',
  category: '기술 역량',
  weight: 10,
  required: true,
  keywords: ['kafka'],
};
test('seed has 3 jobs and 20 unique, fully evaluated applications', () => {
  const db = createSeedDatabase();
  assert.equal(db.jobs.length, 3);
  assert.equal(db.applications.length, 20);
  assert.equal(db.candidates.length, 20);
  assert.equal(new Set(db.applications.map((a) => a.id)).size, 20);
  assert.equal(db.evaluations.length, 20);
  assert.ok(db.applications.filter((a) => a.jobId === 'backend').length >= 8);
  for (const e of db.evaluations) {
    assert.ok(e.totalScore >= 0 && e.totalScore <= 100);
    assert.ok(e.items.every((i) => i.score <= i.maxScore));
  }
  const labels = new Set(db.evaluations.map((e) => scoreLabel(e.totalScore)));
  assert.equal(labels.size, 4);
});
test('all job criteria sum to 100 and satisfy validation', () => {
  const db = createSeedDatabase();
  for (const job of db.jobs)
    assert.equal(validateCriteria(db.criteria.filter((c) => c.jobId === job.id)), null);
});
test('keyword boundaries do not match JavaScript as Java or blanks as evidence', () => {
  assert.equal(containsKeyword('JavaScript 개발', 'java'), false);
  assert.equal(containsKeyword('Java를 사용했습니다', 'java'), true);
  assert.equal(containsKeyword('Spring Boot', 'spring'), true);
  assert.equal(containsKeyword('nothing', ' '), false);
  assert.equal(containsKeyword('Next.js 개발', 'Next.js'), true);
});
test('required and preferred JD sections affect generated criteria', () => {
  const c = generateCriteria('j', '지원 자격\nJava 개발 경험\n우대 사항\nSpring 경험\nKafka 경험');
  assert.equal(c.find((c) => c.name === 'Java / Kotlin')?.required, true);
  assert.equal(c.find((c) => c.name === 'Spring Framework')?.required, false);
  assert.equal(c.find((c) => c.name === 'Kafka')?.category, '우대사항');
});
test('negation cannot count as demonstrated experience or stack evidence', () => {
  const score = scoreCriterion(
    kafka,
    {
      ...application,
      skills: 'Kafka',
      projects: 'Kafka 사용 경험이 없습니다.',
      introduction: '',
      collaboration: '',
      additionalExperience: '',
    },
    'e',
  );
  assert.equal(score.score, 0);
  assert.equal(score.evidence, null);
  assert.equal(score.level, 'Unverified');
});
test('learning evidence is weaker than concrete and measured implementation', () => {
  const base = {
    ...application,
    skills: '',
    introduction: '',
    collaboration: '',
    additionalExperience: '',
  };
  const learning = scoreCriterion(
    kafka,
    { ...base, projects: 'Kafka 입문 강의를 수강했습니다.' },
    'e',
  );
  const concrete = scoreCriterion(
    kafka,
    { ...base, projects: 'Kafka 이벤트 시스템을 구현했습니다.' },
    'e',
  );
  const measured = scoreCriterion(
    kafka,
    { ...base, projects: 'Kafka 이벤트 시스템을 구현해 처리 지연을 30% 개선했습니다.' },
    'e',
  );
  assert.equal(learning.score, 3.5);
  assert.equal(concrete.score, 8.5);
  assert.equal(measured.score, 10);
  assert.ok(measured.evidence);
});
test('repetition does not inflate score', () => {
  const base = {
    ...application,
    skills: '',
    introduction: '',
    collaboration: '',
    additionalExperience: '',
    projects: 'Kafka 이벤트 시스템을 구현했습니다.',
  };
  assert.equal(
    scoreCriterion(kafka, base, 'e').score,
    scoreCriterion(kafka, { ...base, projects: base.projects.repeat(20) }, 'e').score,
  );
});
test('project and collaboration evidence stay in their relevant fields', () => {
  const c = criteria.find((c) => c.category === '경험')!;
  const a = {
    ...application,
    projects: '',
    introduction: '개발자로 성장하고 협업 프로젝트를 구현했습니다.',
    collaboration: '',
  };
  assert.equal(scoreCriterion(c, a, 'e').score, 0);
  assert.equal(
    scoreCriterion(
      criteria.find((c) => c.category === '협업')!,
      a,
      'e',
    ).score,
    0,
  );
});
test('motivation is not scored', () => {
  const first = evaluator.evaluate(job, criteria, application);
  const second = evaluator.evaluate(job, criteria, {
    ...application,
    motivation: 'Kafka Redis AWS를 구현해 90% 성능 개선했습니다.',
  });
  assert.equal(first.totalScore, second.totalScore);
});
test('blank application produces zero score and actionable evidence gaps', () => {
  const blank = {
    ...application,
    skills: '',
    projects: '',
    introduction: '',
    motivation: '',
    collaboration: '',
    additionalExperience: '',
  };
  const e = evaluator.evaluate(job, criteria, blank);
  assert.equal(e.totalScore, 0);
  assert.equal(e.requiredMet, false);
  assert.equal(
    e.items.every((i) => i.evidence === null),
    true,
  );
  assert.ok(e.actions.length > 0);
  assert.ok(e.actions.every((a) => a.reason && a.description && a.links.length));
});
test('score is the rounded sum of weighted item ratios', () => {
  const e = evaluator.evaluate(job, criteria, application);
  assert.equal(e.totalScore, Math.round(e.items.reduce((s, i) => s + i.score, 0)));
  assert.deepEqual(calculateScore(criteria, e.items).categoryScores, e.categoryScores);
});
test('criteria validation rejects invalid totals, zero weights and blank names', () => {
  assert.ok(validateCriteria([{ ...criteria[0], weight: 90 }]));
  assert.ok(validateCriteria([{ ...criteria[0], weight: 0 }]));
  assert.ok(validateCriteria([{ ...criteria[0], name: '', weight: 100 }]));
  assert.ok(validateCriteria([{ ...criteria[0], weight: NaN }]));
  assert.equal(
    normalizeWeights([
      { ...criteria[0], weight: 10 },
      { ...criteria[1], weight: 20 },
      { ...criteria[2], weight: 30 },
    ]).reduce((s, c) => s + c.weight, 0),
    100,
  );
});
test('stored data round trips and rejects malformed / disconnected records', () => {
  const db = createSeedDatabase();
  assert.deepEqual(parseDatabase(JSON.stringify(db)), db);
  assert.throws(() => parseDatabase('broken'));
  assert.throws(() =>
    parseDatabase(
      JSON.stringify({ ...db, applications: [{ ...db.applications[0], candidateId: 'missing' }] }),
    ),
  );
  assert.throws(() => parseDatabase(JSON.stringify({ ...db, version: 999 })));
});
test('required qualification depends on every required criterion, not aggregate score', () => {
  const result = evaluator.evaluate(job, criteria, {
    ...application,
    collaboration: '협업 경험이 없습니다.',
  });
  assert.equal(result.requiredMet, false);
});
test('actions are ordered by potential improvement, and estimated impact stays nonnegative', () => {
  const e = evaluator.evaluate(job, criteria, application);
  assert.ok(e.actions.every((a, i) => a.priority === i + 1 && a.estimatedScoreImpact >= 0));
  for (let i = 1; i < e.actions.length; i++)
    assert.ok(e.actions[i - 1].estimatedScoreImpact >= e.actions[i].estimatedScoreImpact);
});
