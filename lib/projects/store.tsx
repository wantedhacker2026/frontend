'use client';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { PROJECT_STORAGE_KEY, ownedProjects, parseProjects, saveProject } from './domain';
import type { AnalysisProject, ProjectActor, ProjectDB } from './types';
import { saveInterview } from '@/lib/interview/domain';
import type { InterviewPacket } from '@/lib/interview/types';
import type { LoginInput } from '@/lib/auth/contracts';
import { readBrowserSession, withAuthLock, type BrowserSession } from '@/lib/auth/client';
import { actorSchema } from './types';
const empty: ProjectDB = { version: 1, actor: null, projects: [] };
interface ProjectStore {
  actor: ProjectActor | null;
  projects: AnalysisProject[];
  ready: boolean;
  error: string;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  commitInterviewPrompt: (projectId: string, prompt: string, expected: string) => void;
  commitProject: (project: AnalysisProject, expected: number) => void;
  commitInterview: (projectId: string, packet: InterviewPacket, expected: number) => void;
}
const Context = createContext<ProjectStore | null>(null);
export function ProjectProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<ProjectDB>(empty);
  const ref = useRef(db);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [sessionError, setSessionError] = useState('');
  useEffect(() => {
    async function restore() {
      try {
        const raw = localStorage.getItem(PROJECT_STORAGE_KEY);
        const next = raw ? parseProjects(raw) : { ...empty };
        let session: BrowserSession = { actor: null };
        try {
          session = await readBrowserSession();
          setSessionError('');
        } catch {
          setSessionError('로그인 상태를 확인하지 못했습니다. 잠시 후 다시 로그인해 주세요.');
        }
        next.actor = session.actor;
        ref.current = next;
        setDb(next);
        setError('');
      } catch {
        setError('저장된 프로젝트를 읽을 수 없습니다. 기존 데이터는 덮어쓰지 않았습니다.');
      }
      setReady(true);
    }
    restore();
    const listener = (event: StorageEvent) => {
      if (event.key === PROJECT_STORAGE_KEY) restore();
    };
    window.addEventListener('storage', listener);
    const sessionChanged = (event: Event) => {
      const session = (event as CustomEvent<BrowserSession>).detail;
      setSessionError('');
      ref.current = { ...ref.current, actor: session.actor };
      setDb(ref.current);
    };
    const refresh = () => {
      if (document.visibilityState === 'visible') void readBrowserSession().catch(() => {});
    };
    window.addEventListener('wantedhacker-auth', sessionChanged);
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => {
      window.removeEventListener('storage', listener);
      window.removeEventListener('wantedhacker-auth', sessionChanged);
      window.removeEventListener('focus', refresh);
      window.clearInterval(timer);
    };
  }, []);
  function persist(next: ProjectDB) {
    if (error) throw new Error(error);
    try {
      localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(next));
    } catch {
      throw new Error(
        '브라우저 저장 공간이 부족하거나 저장이 차단됐습니다. 현재 입력을 유지했으니 저장 설정을 확인하고 다시 시도해 주세요.',
      );
    }
    ref.current = next;
    setDb(next);
  }
  return (
    <Context.Provider
      value={{
        actor: db.actor,
        projects: ownedProjects(db.projects, db.actor),
        ready,
        error: error || sessionError,
        login: async (input) =>
          withAuthLock(async () => {
            const response = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(input),
              signal: AbortSignal.timeout(20000),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error ?? '로그인하지 못했습니다.');
            setSessionError('');
            persist({ ...ref.current, actor: actorSchema.parse(result.actor) });
          }),
        logout: async () =>
          withAuthLock(async () => {
            const response = await fetch('/api/session', { method: 'DELETE' });
            if (!response.ok) throw new Error('로그아웃하지 못했습니다. 다시 시도해 주세요.');
            // Server logout must clear the UI even if browser storage is unavailable.
            ref.current = { ...ref.current, actor: null };
            setDb(ref.current);
            try {
              localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(ref.current));
            } catch {
              /* Keep projects in memory. */
            }
          }),
        commitInterviewPrompt: (projectId, prompt, expected) => {
          const raw = localStorage.getItem(PROJECT_STORAGE_KEY);
          const latest = raw ? parseProjects(raw) : ref.current;
          const project = latest.projects.find((p) => p.id === projectId);
          if (
            !project ||
            !ref.current.actor ||
            project.ownerId !== ref.current.actor.id ||
            project.role !== ref.current.actor.role
          )
            throw new Error('프로젝트에 접근할 수 없습니다.');
          if ((project.interviewPrompt ?? '') !== expected)
            throw new Error('다른 화면에서 지침을 변경했습니다. 새로고침 후 확인해 주세요.');
          if (prompt.length > 2000) throw new Error('지침은 2,000자 이내로 입력해 주세요.');
          persist({
            ...latest,
            actor: ref.current.actor,
            projects: latest.projects.map((p) =>
              p.id === projectId ? { ...p, interviewPrompt: prompt } : p,
            ),
          });
        },
        commitInterview: (projectId, packet, expected) => {
          const raw = localStorage.getItem(PROJECT_STORAGE_KEY);
          const latest = raw ? parseProjects(raw) : ref.current;
          persist(
            saveInterview({ ...latest, actor: ref.current.actor }, projectId, packet, expected),
          );
        },
        commitProject: (project, expected) => {
          const raw = localStorage.getItem(PROJECT_STORAGE_KEY);
          const latest = raw ? parseProjects(raw) : ref.current;
          persist(saveProject({ ...latest, actor: ref.current.actor }, project, expected));
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useProjects() {
  const value = useContext(Context);
  if (!value) throw new Error('ProjectProvider가 필요합니다.');
  return value;
}
