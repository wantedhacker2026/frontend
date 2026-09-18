'use client';
import { authenticatedFetch } from '@/lib/auth/client';
import { useEffect, useRef, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import {
  postingSchema,
  postingText,
  sectionLabels,
  type JobPosting,
  type SectionKey,
} from '@/lib/job-postings/types';

export function JDImport({
  url,
  hasText,
  onApply,
}: {
  url: string;
  hasText: boolean;
  onApply: (posting: JobPosting, originalText: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [posting, setPosting] = useState<JobPosting | null>(null);
  const [originalText, setOriginalText] = useState('');
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  async function load() {
    if (abort.current) return;
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setError('');
    try {
      const response = await authenticatedFetch('/api/job-postings/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          typeof data.error === 'string' ? data.error : '공고를 가져오지 못했습니다.',
        );
      const result = postingSchema.parse(data);
      if (!controller.signal.aborted) {
        setPosting(result);
        setOriginalText(postingText(result.sections));
      }
    } catch (error) {
      if (!controller.signal.aborted)
        setError(error instanceof Error ? error.message : '공고를 가져오지 못했습니다.');
    } finally {
      if (!controller.signal.aborted) {
        setBusy(false);
        abort.current = null;
      }
    }
  }
  const length = posting ? postingText(posting.sections).length : 0;
  return (
    <div className="jd-import">
      <Button type="button" variant="outline" disabled={!url.trim() || busy} onClick={load}>
        {busy && <LoaderCircle size={16} className="animate-spin" />}
        {busy ? '공고를 가져오는 중…' : 'URL에서 공고 가져오기'}
      </Button>
      {busy && (
        <p role="status" className="project-notice">
          공고를 읽고 항목을 나누고 있습니다. 최대 30초 정도 걸릴 수 있어요.
        </p>
      )}
      {error && (
        <p role="alert" className="jd-import-error">
          {error}
        </p>
      )}
      <p className="project-notice">
        가져온 내용을 확인·수정한 뒤 적용합니다. 자동 수집이 어려운 공고는 아래 JD 본문에 직접
        붙여넣어 주세요.
      </p>
      <Dialog
        open={Boolean(posting)}
        onOpenChange={(open) => {
          if (!open) setPosting(null);
        }}
        wide
        title="가져온 채용공고 확인"
        description="원문과 비교하고 잘못 분류된 내용을 옮겨 주세요. 적용하면 아래 JD 본문과 평가 기준이 새로 채워집니다."
      >
        {posting && (
          <div className="jd-import-review">
            <p className="project-notice">
              {posting.company && `${posting.company} · `}
              {posting.method === 'structured-data'
                ? '공고 구조화 데이터'
                : posting.method === 'rendered'
                  ? '화면에 표시된 공고'
                  : '공고 HTML'}
              에서 추출 ·{' '}
              <a href={posting.sourceUrl} target="_blank" rel="noopener noreferrer">
                원문 열기
              </a>
            </p>
            <label className="project-field">
              공고 제목
              <input
                value={posting.title}
                maxLength={300}
                onChange={(e) => setPosting({ ...posting, title: e.target.value })}
              />
            </label>
            <ul className="jd-import-notices">
              {posting.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
            {(Object.keys(sectionLabels) as SectionKey[]).map((key) => (
              <label key={key} className="project-field">
                {sectionLabels[key]}
                <textarea
                  rows={key === 'other' ? 4 : 5}
                  maxLength={30000}
                  value={posting.sections[key]}
                  placeholder="자동으로 찾지 못했습니다. 필요하면 원문에서 옮겨 주세요."
                  onChange={(e) =>
                    setPosting({
                      ...posting,
                      sections: { ...posting.sections, [key]: e.target.value },
                    })
                  }
                />
              </label>
            ))}
            <p className="project-notice">
              {length.toLocaleString()} / 30,000자
              {hasText && ' · 적용하면 기존 JD 본문과 수정한 평가 기준을 교체합니다.'}
            </p>
            <div className="jd-import-actions">
              <Button type="button" variant="outline" onClick={() => setPosting(null)}>
                취소
              </Button>
              <Button
                type="button"
                disabled={length < 20 || length > 30000}
                onClick={() => {
                  onApply(posting, originalText);
                  setPosting(null);
                }}
              >
                확인한 내용 적용
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
