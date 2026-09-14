'use client';
import { useRef, useState } from 'react';
import { Upload, FileText, X, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store';
import { readProjectFile } from '@/lib/projects/documents';
import { resumeDocument } from '@/lib/projects/demo';
import type { ProjectActor, ProjectDocument, ProjectPerson } from '@/lib/projects/types';
export function DocumentUpload({
  actor,
  documents,
  people,
  onChange,
  onBusy,
}: {
  actor: ProjectActor | null;
  documents: ProjectDocument[];
  people: ProjectPerson[];
  onChange: (documents: ProjectDocument[], people: ProjectPerson[]) => void;
  onBusy: (value: boolean) => void;
}) {
  const { db } = useStore();
  const fileInput = useRef<HTMLInputElement>(null);
  const replace = useRef<{ id: string; personId: string } | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);
  const [manual, setManual] = useState(false);
  const [text, setText] = useState('');
  const [resumeId, setResumeId] = useState('');
  const recruiter = actor?.role === 'recruiter';
  function firstPerson(): ProjectPerson {
    return (
      people[0] ?? {
        id: crypto.randomUUID(),
        name: actor?.name ?? '지원자',
        birthDate: '',
        experience: 0,
      }
    );
  }
  async function addFiles(files: File[]) {
    if (reading) return;
    setError('');
    if (replace.current && files.length !== 1) {
      setError('교체할 파일을 한 개만 선택해 주세요.');
      return;
    }
    if (documents.length + files.length - (replace.current ? 1 : 0) > 20) {
      setError('파일은 최대 20개까지 등록할 수 있습니다.');
      return;
    }
    setReading(true);
    onBusy(true);
    const nextPeople = [...people];
    const added: ProjectDocument[] = [];
    const replacing = replace.current;
    replace.current = null;
    try {
      for (const file of files) {
        let person = nextPeople.find((p) => p.id === replacing?.personId);
        if (!person) {
          person = recruiter
            ? {
                id: crypto.randomUUID(),
                name: file.name.replace(/\.[^.]+$/, '').slice(0, 60),
                birthDate: '',
                experience: 0,
              }
            : (nextPeople[0] ?? firstPerson());
        }
        if (!nextPeople.some((p) => p.id === person.id)) nextPeople.push(person);
        added.push(await readProjectFile(file, person.id));
      }
      onChange([...documents.filter((d) => d.id !== replacing?.id), ...added], nextPeople);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReading(false);
      onBusy(false);
    }
  }
  function addText() {
    if (!text.trim()) return;
    const p = firstPerson();
    const doc: ProjectDocument = {
      id: crypto.randomUUID(),
      applicantId: p.id,
      registeredAt: new Date().toISOString(),
      filename: '직접 입력한 서류.txt',
      size: new Blob([text]).size,
      source: 'text',
      status: 'ready',
      pages: [{ number: 1, text }],
    };
    onChange([...documents, doc], people.some((v) => v.id === p.id) ? people : [...people, p]);
    setText('');
    setManual(false);
  }
  return (
    <div className="project-upload">
      <input
        ref={fileInput}
        type="file"
        accept=".pdf,.txt"
        multiple
        className="sr-only"
        aria-label="서류 파일 선택"
        onChange={(e) => {
          void addFiles(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
      <div
        className={`project-dropzone ${drag ? 'dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (!reading) {
            replace.current = null;
            void addFiles(Array.from(e.dataTransfer.files));
          }
        }}
      >
        <Upload size={28} />
        <h3>
          {reading
            ? '서류 텍스트를 읽고 있어요…'
            : recruiter
              ? '지원자 서류 파일을 이곳으로 끌어오세요'
              : `${actor?.name ?? '지원자'}님의 서류 파일을 이곳으로 끌어오세요`}
        </h3>
        <p>PDF / TXT · 파일당 10MB · PDF 30페이지 · 최대 20개</p>
        <Button
          type="button"
          variant="outline"
          disabled={reading || documents.length >= 20}
          onClick={() => {
            replace.current = null;
            fileInput.current?.click();
          }}
        >
          내 PC에서 선택
        </Button>
        <button
          className="project-text-button"
          disabled={reading || documents.length >= 20}
          type="button"
          onClick={() => setManual(!manual)}
        >
          텍스트 직접 입력
        </button>
      </div>
      <p className="project-upload-note">
        텍스트 PDF를 브라우저에서 읽습니다. 이미지 PDF의 OCR과 서버 업로드는 아직 연결되지
        않았습니다.
      </p>
      {manual && (
        <div className="project-inline-editor">
          <label className="project-field">
            서류 원문
            <textarea
              rows={6}
              maxLength={100000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="경험과 기술을 포함한 서류 내용을 붙여넣으세요."
            />
          </label>
          <Button type="button" disabled={!text.trim() || documents.length >= 20} onClick={addText}>
            입력한 서류 등록
          </Button>
        </div>
      )}
      {!recruiter && db.resumes.length > 0 && (
        <div className="project-resume-picker">
          <label htmlFor="existing-resume">저장한 지원서 버전 사용</label>
          <select
            id="existing-resume"
            value={resumeId}
            onChange={(e) => setResumeId(e.target.value)}
          >
            <option value="">버전을 선택하세요</option>
            {db.resumes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title} · v{r.revision}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            disabled={!resumeId || reading || documents.length >= 20}
            onClick={() => {
              const resume = db.resumes.find((r) => r.id === resumeId);
              if (!resume) return;
              const p = firstPerson();
              onChange(
                [
                  ...documents,
                  resumeDocument(resume.content, `${resume.title} · v${resume.revision}`, p.id),
                ],
                people.length ? people : [p],
              );
              setResumeId('');
            }}
          >
            버전 가져오기
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      {recruiter && people.length > 0 && (
        <div className="project-people">
          <h3>지원자별 파일 묶음</h3>
          <p>
            같은 사람의 이력서와 포트폴리오는 아래에서 같은 지원자로 지정하세요. 이름·생년월일만으로
            자동 병합하지 않습니다.
          </p>
          {people
            .filter((p) => documents.some((d) => d.applicantId === p.id))
            .map((p) => (
              <div className="project-person" key={p.id}>
                <label>
                  지원자 이름
                  <input
                    value={p.name}
                    maxLength={80}
                    onChange={(e) =>
                      onChange(
                        documents,
                        people.map((v) => (v.id === p.id ? { ...v, name: e.target.value } : v)),
                      )
                    }
                  />
                </label>
                <label>
                  생년월일 <small>선택</small>
                  <input
                    type="date"
                    value={p.birthDate}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) =>
                      onChange(
                        documents,
                        people.map((v) =>
                          v.id === p.id ? { ...v, birthDate: e.target.value } : v,
                        ),
                      )
                    }
                  />
                </label>
              </div>
            ))}
          <button
            type="button"
            className="project-text-button"
            onClick={() =>
              onChange(documents, [
                ...people,
                {
                  id: crypto.randomUUID(),
                  name: `지원자 ${people.length + 1}`,
                  birthDate: '',
                  experience: 0,
                },
              ])
            }
          >
            <Plus size={14} />새 지원자 묶음 추가
          </button>
        </div>
      )}
      <div className="project-file-list">
        {documents.map((doc) => (
          <article key={doc.id} className={doc.status === 'failed' ? 'file-failed' : ''}>
            <div className="project-file-row">
              <FileText size={20} />
              <div>
                <strong>{doc.filename}</strong>
                <small>
                  {(doc.size / 1024).toFixed(1)} KB ·{' '}
                  {doc.status === 'ready'
                    ? `${doc.pages.length}페이지 · ${doc.source === 'resume' ? '저장한 버전 복사' : '텍스트 읽기 완료'}`
                    : '읽기 실패'}
                </small>
              </div>
              <button
                type="button"
                aria-label={`${doc.filename} 교체`}
                disabled={reading}
                onClick={() => {
                  replace.current = { id: doc.id, personId: doc.applicantId };
                  fileInput.current?.click();
                }}
              >
                <RefreshCw size={16} />
              </button>
              <button
                type="button"
                aria-label={`${doc.filename} 제거`}
                disabled={reading}
                onClick={() =>
                  onChange(
                    documents.filter((d) => d.id !== doc.id),
                    people,
                  )
                }
              >
                <X size={17} />
              </button>
            </div>
            {doc.error && <p className="project-file-error">{doc.error}</p>}
            {recruiter && (
              <label className="project-file-owner">
                지원자
                <select
                  aria-label={`${doc.filename} 지원자`}
                  value={doc.applicantId}
                  onChange={(e) =>
                    onChange(
                      documents.map((d) =>
                        d.id === doc.id ? { ...d, applicantId: e.target.value } : d,
                      ),
                      people,
                    )
                  }
                >
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || '이름을 입력해 주세요'}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {doc.status === 'ready' && (
              <details>
                <summary>읽은 원문 확인</summary>
                {doc.pages.map((page) => (
                  <div key={page.number}>
                    <small>{doc.source === 'pdf' ? `${page.number}페이지` : '텍스트 원문'}</small>
                    <pre>{page.text}</pre>
                  </div>
                ))}
              </details>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
