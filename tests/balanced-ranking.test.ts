import test from 'node:test';
import assert from 'node:assert/strict';
import { fitSummary, sortAnalyses } from '../lib/projects/fit';
import {
  criterionSchema,
  type ProjectAnalysis,
  type ProjectCriterion,
} from '../lib/projects/types';

const criteria: ProjectCriterion[] = [0, 1, 2, 3].map((i) => ({
  id: String(i),
  name: `역량${i}`,
  keywords: [`역량${i}`],
  required: true,
  description: '',
}));
function candidate(name: string, levels: number[]): ProjectAnalysis {
  const results = levels.map((level, i) => ({
    criterionId: String(i),
    score: (level / 4) * 25,
    maxScore: 25,
    evidenceLevel: level,
    mentioned: level > 0,
    reading: level > 0 ? ('O' as const) : ('-' as const),
    status: level > 0 ? ('review' as const) : ('missing' as const),
    reason: '',
    sources: [],
  }));
  return {
    id: name,
    personId: name,
    name,
    birthDate: '',
    score: Math.round(results.reduce((sum, r) => sum + r.score, 0)),
    summary: '',
    results,
  };
}

test('balanced ranking finds broad coverage even when concentrated candidate has a higher total', () => {
  const concentrated = candidate('집중형', [4, 4, 2, 0]);
  const balanced = candidate('균형형', [3, 2, 2, 2]);
  assert.ok(concentrated.score > balanced.score);
  assert.equal(sortAnalyses([concentrated, balanced], criteria, 'balanced')[0].name, '균형형');
  assert.equal(sortAnalyses([balanced, concentrated], criteria, 'score')[0].name, '집중형');
  assert.equal(sortAnalyses([balanced, concentrated], criteria, 'criterion:0')[0].name, '집중형');
  assert.equal(fitSummary(criteria, balanced).coverage, 100);
  assert.equal(fitSummary(criteria, concentrated).coverage, 75);
});

test('explicit core requirement has priority and stricter thresholds use evidence level before rounding', () => {
  const policy = criteria.map((c, i) => ({
    ...c,
    core: i === 0,
    minimumRatio: i === 0 ? (0.75 as const) : (0.5 as const),
  }));
  const core = candidate('핵심충족', [3, 2, 0, 0]);
  const broad = candidate('기타충족', [2, 4, 4, 4]);
  assert.equal(sortAnalyses([broad, core], policy, 'balanced')[0].name, '핵심충족');
  core.results[0] = { ...core.results[0], maxScore: 15, score: 11.3 };
  assert.equal(fitSummary(policy, core).coreMet, 1);
  assert.equal(criterionSchema.safeParse({ ...criteria[0], minimumRatio: 0.6 }).success, false);
});

test('unreadable scores stay unknown and historical scores remain unchanged', () => {
  const old = candidate('과거', [4, 4, 0, 0]);
  old.results.forEach((result) => {
    delete result.evidenceLevel;
  });
  const snapshot = JSON.stringify(old);
  assert.equal(fitSummary(criteria, old).legacy, true);
  assert.equal(fitSummary(criteria, old).coreTotal, 0);
  const unreadable = candidate('판독불가', [4, 4, 4, 4]);
  unreadable.results = unreadable.results.map((result) => ({ ...result, status: 'unreadable' }));
  assert.equal(fitSummary(criteria, unreadable).available, false);
  assert.equal(fitSummary(criteria, unreadable).weak.length, 0);
  assert.equal(fitSummary(criteria, unreadable).unknown.length, 4);
  assert.equal(sortAnalyses([unreadable, old], criteria, 'score')[0].name, '과거');
  assert.equal(JSON.stringify(old), snapshot);
});

test('coverage counts criteria equally and a mention alone fails the default threshold', () => {
  const analysis = candidate('언급', [1, 2, 3, 4]);
  analysis.results[3] = { ...analysis.results[3], maxScore: 90, score: 90 };
  assert.equal(fitSummary(criteria, analysis).coverage, 75);
  assert.deepEqual(fitSummary(criteria, analysis).weak, ['역량0']);
});
