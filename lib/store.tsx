'use client';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { ApplicationInput, Database, EvaluationCriterion, Job, ReviewStatus } from '@/types';
import { createSeedDatabase } from '@/data/mock/seed';
import { evaluator } from './evaluation/mock-evaluator';
import { validateCriteria } from '@/data/mock/criteria';
import { parseDatabase, STORAGE_KEY } from './persistence';
import { useProjects } from './projects/store';
import {
  duplicateResumeVersion,
  prepareResumeSubmission,
  prepareSubmission,
  recordSubmission,
  removeResumeVersion,
  saveResumeVersion,
} from './resumes';
interface Store {
  db: Database;
  ready: boolean;
  error: string | null;
  dismissError: () => void;
  addJob: (job: Job, criteria: EvaluationCriterion[]) => void;
  updateCriteria: (jobId: string, criteria: EvaluationCriterion[]) => Promise<void>;
  submitApplication: (
    jobId: string,
    input: ApplicationInput,
    existingId?: string,
  ) => Promise<string>;
  saveResume: (title: string, input: ApplicationInput, existingId?: string) => string;
  duplicateResume: (id: string) => string;
  deleteResume: (id: string) => void;
  submitResume: (jobId: string, resumeId: string) => Promise<string>;
  setStatus: (applicationId: string, status: ReviewStatus) => void;
  toggleAction: (id: string) => void;
  reset: () => void;
}
const Context = createContext<Store | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const { actor } = useProjects();
  const storageKey = actor
    ? `${STORAGE_KEY}:account:${actor.id}:${actor.role}`
    : `${STORAGE_KEY}:guest`;
  return (
    <ScopedStore key={storageKey} storageKey={storageKey}>
      {children}
    </ScopedStore>
  );
}
function ScopedStore({ children, storageKey }: { children: ReactNode; storageKey: string }) {
  const [db, setDb] = useState<Database>(createSeedDatabase);
  const dbRef = useRef(db);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Browser storage is an external system; hydrate after SSR before rendering editable views.
  /* eslint-disable react-hooks/set-state-in-effect -- Local storage hydration must follow SSR. */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const restored = parseDatabase(saved);
        dbRef.current = restored;
        setDb(restored);
      }
    } catch {
      setError(
        '저장된 데이터를 읽지 못해 데모 데이터를 불러왔습니다. 현재 변경 사항은 이 브라우저에서만 유지됩니다.',
      );
    }
    setReady(true);
  }, [storageKey]);
  /* eslint-enable react-hooks/set-state-in-effect */
  function commit(next: Database, requireStorage = false) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      if (requireStorage)
        throw new Error(
          '브라우저에 저장하지 못했습니다. 저장 공간과 브라우저 설정을 확인한 뒤 다시 시도해 주세요.',
        );
      setError(
        '브라우저 저장 공간을 사용할 수 없습니다. 현재 화면에서는 동작하지만 새로고침하면 변경 사항이 사라질 수 있습니다.',
      );
    }
    dbRef.current = next;
    setDb(next);
  }
  function addJob(job: Job, criteria: EvaluationCriterion[]) {
    const error = validateCriteria(criteria);
    if (error) throw new Error(error);
    commit({ ...db, jobs: [job, ...db.jobs], criteria: [...db.criteria, ...criteria] });
  }
  async function updateCriteria(jobId: string, criteria: EvaluationCriterion[]) {
    const error = validateCriteria(criteria);
    if (error) throw new Error(error);
    const job = db.jobs.find((j) => j.id === jobId);
    if (!job) throw new Error('공고를 찾을 수 없습니다.');
    const affected = db.applications.filter((a) => a.jobId === jobId);
    const ids = affected.map((a) => a.id);
    const results = await Promise.all(affected.map((a) => evaluator.evaluate(job, criteria, a)));
    const oldActionIds = db.evaluations
      .filter((e) => ids.includes(e.applicationId))
      .flatMap((e) => e.actions.map((a) => a.id));
    commit({
      ...db,
      criteria: [...db.criteria.filter((c) => c.jobId !== jobId), ...criteria],
      applications: db.applications.map((a) => (ids.includes(a.id) ? { ...a, status: 'NEW' } : a)),
      evaluations: [...db.evaluations.filter((e) => !ids.includes(e.applicationId)), ...results],
      completedActionIds: db.completedActionIds.filter((id) => !oldActionIds.includes(id)),
    });
  }
  async function evaluateSubmission(prepared: ReturnType<typeof prepareSubmission>) {
    const { job, candidate, application } = prepared;
    const evaluation = await evaluator.evaluate(
      job,
      dbRef.current.criteria.filter((c) => c.jobId === job.id),
      application,
    );
    commit(recordSubmission(dbRef.current, candidate, application, evaluation), true);
    return application.id;
  }
  async function submitApplication(jobId: string, input: ApplicationInput, existingId?: string) {
    return evaluateSubmission(prepareSubmission(dbRef.current, jobId, input, existingId));
  }
  async function submitResume(jobId: string, resumeId: string) {
    return evaluateSubmission(prepareResumeSubmission(dbRef.current, jobId, resumeId));
  }
  function saveResume(title: string, input: ApplicationInput, existingId?: string) {
    const saved = saveResumeVersion(dbRef.current, title, input, existingId);
    commit(saved.db, true);
    return saved.resume.id;
  }
  function duplicateResume(id: string) {
    const saved = duplicateResumeVersion(dbRef.current, id);
    commit(saved.db, true);
    return saved.resume.id;
  }
  function deleteResume(id: string) {
    commit(removeResumeVersion(dbRef.current, id), true);
  }
  return (
    <Context.Provider
      value={{
        db,
        ready,
        error,
        dismissError: () => setError(null),
        addJob,
        updateCriteria,
        submitApplication,
        saveResume,
        duplicateResume,
        deleteResume,
        submitResume,
        setStatus: (id, status) =>
          commit({
            ...db,
            applications: db.applications.map((a) => (a.id === id ? { ...a, status } : a)),
          }),
        toggleAction: (id) =>
          commit({
            ...db,
            completedActionIds: db.completedActionIds.includes(id)
              ? db.completedActionIds.filter((a) => a !== id)
              : [...db.completedActionIds, id],
          }),
        reset: () => commit(createSeedDatabase()),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useStore() {
  const store = useContext(Context);
  if (!store) throw new Error('StoreProvider가 필요합니다.');
  return store;
}
