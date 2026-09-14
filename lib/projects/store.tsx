'use client';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { PROJECT_STORAGE_KEY, ownedProjects, parseProjects, saveProject } from './domain';
import type { AnalysisProject, ProjectActor, ProjectDB } from './types';
const empty: ProjectDB = { version: 1, actor: null, projects: [] };
interface ProjectStore {
  actor: ProjectActor | null;
  projects: AnalysisProject[];
  ready: boolean;
  error: string;
  login: (actor: ProjectActor) => void;
  logout: () => void;
  commitProject: (project: AnalysisProject, expected: number) => void;
}
const Context = createContext<ProjectStore | null>(null);
export function ProjectProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<ProjectDB>(empty);
  const ref = useRef(db);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    function restore() {
      try {
        const raw = localStorage.getItem(PROJECT_STORAGE_KEY);
        const next = raw ? parseProjects(raw) : empty;
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
    return () => window.removeEventListener('storage', listener);
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
        error,
        login: (actor) => persist({ ...ref.current, actor }),
        logout: () => persist({ ...ref.current, actor: null }),
        commitProject: (project, expected) => {
          const raw = localStorage.getItem(PROJECT_STORAGE_KEY);
          const latest = raw ? parseProjects(raw) : ref.current;
          persist(saveProject(latest, project, expected));
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
