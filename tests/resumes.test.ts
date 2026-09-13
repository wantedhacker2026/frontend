import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedDatabase, sampleApplication } from '../data/mock/seed';
import { MockCandidateEvaluator } from '../lib/evaluation/mock-evaluator';
import { parseDatabase } from '../lib/persistence';
import {
  applicationContent,
  duplicateResumeVersion,
  prepareResumeSubmission,
  prepareSubmission,
  recordSubmission,
  removeResumeVersion,
  saveResumeVersion,
} from '../lib/resumes';
import type { Database } from '../types';

const evaluator = new MockCandidateEvaluator();
function submit(db: Database, jobId: string, resumeId: string) {
  const prepared = prepareResumeSubmission(db, jobId, resumeId);
  const evaluation = evaluator.evaluate(
    prepared.job,
    db.criteria.filter((c) => c.jobId === jobId),
    prepared.application,
  );
  return {
    db: recordSubmission(db, prepared.candidate, prepared.application, evaluation),
    ...prepared,
    evaluation,
  };
}

test('versions save independently without submitting; editing retains identity and bumps revision', () => {
  const seed = createSeedDatabase();
  const first = saveResumeVersion(seed, '기본형', sampleApplication);
  const second = saveResumeVersion(first.db, 'Kafka 강조형', {
    ...sampleApplication,
    projects: 'Kafka로 주문 이벤트 시스템을 구현하고 지연을 40% 줄였습니다.',
  });
  const edited = saveResumeVersion(
    second.db,
    '기본형 수정',
    { ...sampleApplication, name: '수정한 이름' },
    first.resume.id,
  );
  assert.equal(edited.db.resumes.length, 2);
  assert.equal(edited.resume.id, first.resume.id);
  assert.equal(edited.resume.revision, 2);
  assert.equal(edited.resume.createdAt, first.resume.createdAt);
  assert.deepEqual(
    edited.db.resumes.find((r) => r.id === second.resume.id),
    second.resume,
  );
  assert.deepEqual(edited.db.applications, seed.applications);
  assert.deepEqual(edited.db.evaluations, seed.evaluations);
});

test('duplicates get independent contents and distinct names', () => {
  const first = saveResumeVersion(createSeedDatabase(), '기본형', sampleApplication);
  const copy = duplicateResumeVersion(first.db, first.resume.id);
  const copy2 = duplicateResumeVersion(copy.db, first.resume.id);
  assert.notEqual(copy.resume.id, first.resume.id);
  assert.notEqual(copy.resume.title, copy2.resume.title);
  assert.notEqual(copy.resume.content, first.resume.content);
  const changed = saveResumeVersion(
    copy2.db,
    '독립 버전',
    { ...copy.resume.content, skills: 'Python' },
    copy.resume.id,
  );
  assert.equal(
    changed.db.resumes.find((r) => r.id === first.resume.id)?.content.skills,
    sampleApplication.skills,
  );
});

test('selected version controls evaluation and source changes cannot change submitted snapshots', () => {
  const first = saveResumeVersion(createSeedDatabase(), '백엔드 경험', sampleApplication);
  const second = saveResumeVersion(first.db, '첫 학습', {
    ...sampleApplication,
    skills: 'Python',
    projects: 'Python 입문 강의를 수강했습니다.',
    collaboration: '협업 경험이 없습니다.',
    additionalExperience: '',
  });
  const a = submit(second.db, 'backend', first.resume.id);
  const b = submit(a.db, 'backend', second.resume.id);
  assert.ok(a.evaluation.totalScore > b.evaluation.totalScore);
  assert.equal(a.application.resumeSource?.title, '백엔드 경험');
  assert.equal(b.application.resumeSource?.title, '첫 학습');
  const updated = saveResumeVersion(
    b.db,
    '이름도 변경',
    { ...sampleApplication, name: '다른 이름', projects: '새로운 경험' },
    first.resume.id,
  );
  const removed = removeResumeVersion(updated.db, first.resume.id);
  const roundtrip = parseDatabase(JSON.stringify(removed));
  assert.deepEqual(
    roundtrip.applications.find((app) => app.id === a.application.id),
    a.application,
  );
  assert.deepEqual(
    roundtrip.evaluations.find((e) => e.id === a.evaluation.id),
    a.evaluation,
  );
  assert.deepEqual(
    roundtrip.candidates.find((c) => c.id === a.candidate.id),
    a.candidate,
  );
  assert.throws(() => prepareResumeSubmission(removed, 'backend', first.resume.id));
});

test('one version can be submitted to several jobs with independent analysis and history', () => {
  const saved = saveResumeVersion(createSeedDatabase(), '공통 지원서', sampleApplication);
  const a = submit(saved.db, 'backend', saved.resume.id);
  const b = submit(a.db, 'frontend', saved.resume.id);
  assert.equal(b.db.ownApplicationIds.length, 2);
  assert.notEqual(a.application.id, b.application.id);
  assert.notEqual(a.candidate.id, b.candidate.id);
  assert.equal(b.db.resumes.length, 1);
  assert.deepEqual(
    b.db.evaluations.find((e) => e.applicationId === a.application.id),
    a.evaluation,
  );
});

test('v1 migration preserves history and imports only own submissions once', () => {
  const seed = createSeedDatabase();
  const old = { ...seed, version: 1, resumes: undefined, ownApplicationIds: ['application-4'] };
  const migrated = parseDatabase(JSON.stringify(old));
  assert.equal(migrated.version, 2);
  assert.equal(migrated.resumes.length, 1);
  assert.deepEqual(migrated.evaluations, seed.evaluations);
  assert.deepEqual(migrated.ownApplicationIds, old.ownApplicationIds);
  const app = migrated.applications.find((a) => a.id === 'application-4')!;
  assert.equal(app.status, seed.applications[3].status);
  assert.equal(app.createdAt, seed.applications[3].createdAt);
  assert.equal(app.resumeSource?.versionId, migrated.resumes[0].id);
  assert.deepEqual(migrated.resumes[0].content, applicationContent(app, migrated.candidates[3]));
  assert.deepEqual(parseDatabase(JSON.stringify(migrated)), migrated);
  assert.equal(parseDatabase(JSON.stringify({ ...old, ownApplicationIds: [] })).resumes.length, 0);
});

test('invalid legacy contents remain available even if they cannot become a valid saved version', () => {
  const seed = createSeedDatabase();
  seed.candidates[0].email = 'legacy-invalid-email';
  const restored = parseDatabase(
    JSON.stringify({
      ...seed,
      version: 1,
      resumes: undefined,
      ownApplicationIds: [seed.applications[0].id],
    }),
  );
  assert.equal(restored.applications.length, 20);
  assert.equal(restored.resumes.length, 0);
  assert.equal(restored.candidates[0].email, 'legacy-invalid-email');
});

test('validation rejects malformed versions, missing targets, and duplicate persisted ids', () => {
  const db = createSeedDatabase();
  assert.throws(() => saveResumeVersion(db, '  ', sampleApplication));
  assert.throws(() => saveResumeVersion(db, 'x'.repeat(81), sampleApplication));
  assert.throws(() => saveResumeVersion(db, '기본', { ...sampleApplication, projects: '  ' }));
  assert.throws(() => saveResumeVersion(db, '기본', { ...sampleApplication, experience: NaN }));
  assert.throws(() => saveResumeVersion(db, '기본', sampleApplication, 'missing'));
  assert.throws(() => prepareResumeSubmission(db, 'backend', 'missing'));
  const saved = saveResumeVersion(db, '기본', sampleApplication);
  assert.throws(() => prepareResumeSubmission(saved.db, 'missing', saved.resume.id));
  assert.throws(() =>
    parseDatabase(JSON.stringify({ ...saved.db, resumes: [saved.resume, saved.resume] })),
  );
  assert.throws(() => parseDatabase(JSON.stringify({ ...saved.db, resumes: undefined })));
});

test('recording completed evaluation retains versions saved while analysis was pending', () => {
  const first = saveResumeVersion(createSeedDatabase(), '분석 중', sampleApplication);
  const pending = prepareResumeSubmission(first.db, 'backend', first.resume.id);
  const newer = saveResumeVersion(first.db, '추가 버전', sampleApplication);
  const evaluation = evaluator.evaluate(
    pending.job,
    newer.db.criteria.filter((c) => c.jobId === 'backend'),
    pending.application,
  );
  const final = recordSubmission(newer.db, pending.candidate, pending.application, evaluation);
  assert.equal(final.resumes.length, 2);
  assert.equal(final.applications.length, 21);
  assert.equal(final.ownApplicationIds.length, 1);
});

test('explicitly editing a submitted application clears stale version attribution but preserves source', () => {
  const saved = saveResumeVersion(createSeedDatabase(), '원본', sampleApplication);
  const first = submit(saved.db, 'backend', saved.resume.id);
  const edit = prepareSubmission(
    first.db,
    'backend',
    { ...sampleApplication, projects: '명시적으로 수정한 내용' },
    first.application.id,
  );
  assert.equal(edit.application.id, first.application.id);
  assert.equal(edit.application.resumeSource, undefined);
  assert.equal(saved.resume.content.projects, sampleApplication.projects);
});

test('legacy demo branding updates without changing user jobs, resume versions or analyses', () => {
  const { db } = saveResumeVersion(createSeedDatabase(), '보존할 버전', sampleApplication);
  db.jobs[0].companyName = 'Shortlist Studio';
  db.jobs[0].description = db.jobs[0].description.replace(
    'wantedhacker에서',
    'Shortlist Studio에서',
  );
  db.jobs.push({ ...db.jobs[0], id: 'custom-job' });
  db.criteria.push(
    ...db.criteria
      .filter((c) => c.jobId === 'backend')
      .map((c) => ({ ...c, id: `custom-${c.id}`, jobId: 'custom-job' })),
  );
  const restored = parseDatabase(JSON.stringify(db));
  assert.equal(restored.jobs[0].companyName, 'wantedhacker');
  assert.match(restored.jobs[0].description, /wantedhacker에서/);
  assert.equal(restored.jobs.find((j) => j.id === 'custom-job')?.companyName, 'Shortlist Studio');
  assert.deepEqual(restored.resumes, db.resumes);
  assert.deepEqual(restored.applications, db.applications);
  assert.deepEqual(restored.evaluations, db.evaluations);
});
