'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { ApplicationInput, Database, EvaluationCriterion, Job, ReviewStatus } from '@/types';
import { createSeedDatabase } from '@/data/mock/seed';
import { evaluator } from './evaluation/mock-evaluator';
import { validateCriteria } from '@/data/mock/criteria';
import { parseDatabase, STORAGE_KEY } from './persistence';
import { uid } from './utils';
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
  setStatus: (applicationId: string, status: ReviewStatus) => void;
  toggleAction: (id: string) => void;
  reset: () => void;
}
const Context = createContext<Store | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database>(createSeedDatabase);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Browser storage is an external system; hydrate after SSR before rendering editable views.
  /* eslint-disable react-hooks/set-state-in-effect -- Local storage hydration must follow SSR. */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setDb(parseDatabase(saved));
    } catch {
      setError(
        '저장된 데이터를 읽지 못해 데모 데이터를 불러왔습니다. 현재 변경 사항은 이 브라우저에서만 유지됩니다.',
      );
    }
    setReady(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  function commit(next: Database) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      setError(
        '브라우저 저장 공간을 사용할 수 없습니다. 현재 화면에서는 동작하지만 새로고침하면 변경 사항이 사라질 수 있습니다.',
      );
    }
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
  async function submitApplication(jobId: string, input: ApplicationInput, existingId?: string) {
    const job = db.jobs.find((j) => j.id === jobId);
    if (!job) throw new Error('공고를 찾을 수 없습니다.');
    if (
      !input.name.trim() ||
      !input.skills.trim() ||
      !input.projects.trim() ||
      !input.introduction.trim() ||
      !input.motivation.trim() ||
      !input.collaboration.trim() ||
      !Number.isFinite(input.experience) ||
      input.experience < 0 ||
      input.experience > 60
    )
      throw new Error('필수 입력값을 확인해 주세요.');
    const existing = existingId
      ? db.applications.find((a) => a.id === existingId && a.jobId === jobId)
      : undefined;
    if (existingId && !existing) throw new Error('수정할 지원서를 찾을 수 없습니다.');
    const id = existing?.id ?? uid('application');
    const candidateId = existing?.candidateId ?? uid('candidate');
    const { name, email, ...experienceInput } = input;
    const candidate = { id: candidateId, name: name.trim(), email: email.trim() };
    const application = {
      ...experienceInput,
      id,
      candidateId,
      jobId,
      status: 'NEW' as const,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    const evaluation = await evaluator.evaluate(
      job,
      db.criteria.filter((c) => c.jobId === jobId),
      application,
    );
    const previousActionIds =
      db.evaluations.find((e) => e.applicationId === id)?.actions.map((a) => a.id) ?? [];
    commit({
      ...db,
      candidates: [...db.candidates.filter((c) => c.id !== candidateId), candidate],
      applications: [...db.applications.filter((a) => a.id !== id), application],
      evaluations: [...db.evaluations.filter((e) => e.applicationId !== id), evaluation],
      completedActionIds: db.completedActionIds.filter((id) => !previousActionIds.includes(id)),
      ownApplicationIds: Array.from(new Set([...db.ownApplicationIds, id])),
    });
    return id;
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
