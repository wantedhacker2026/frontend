'use client';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCheck,
  Clock3,
  ExternalLink,
  Flag,
  Layers2,
} from 'lucide-react';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import type { ImprovementAction } from '@/types';
import { resources } from '@/data/mock/recommendations';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
export function ActionCard({
  action,
  applicationId,
  compact = false,
}: {
  action: ImprovementAction;
  applicationId: string;
  compact?: boolean;
}) {
  const { db, toggleAction } = useStore();
  const [open, setOpen] = useState(false);
  const done = db.completedActionIds.includes(action.id);
  const resource = resources.find((r) => r.type === action.type)!;
  const impact =
    action.estimatedScoreImpact >= 8 ? 'High' : action.estimatedScoreImpact >= 3 ? 'Medium' : 'Low';
  return (
    <article
      className={`action-card ${done ? 'action-done' : ''} ${compact ? 'action-compact' : ''}`}
    >
      <div className="action-rank">
        {done ? <Check size={19} /> : String(action.priority).padStart(2, '0')}
      </div>
      <div className="action-body">
        <div className="action-heading">
          <span className={`impact-label impact-${impact.toLowerCase()}`}>{impact} impact</span>
          {done && <span className="done-label">실천 완료</span>}
          <span className="action-time">
            <Clock3 size={12} />
            {resource.duration}
          </span>
        </div>
        <h3>{action.title}</h3>
        <p className="gap-reason">
          <span>WHY</span>
          {action.reason}
        </p>
        {!compact && (
          <div className="action-instruction">
            <span>
              <Flag size={13} />
              ACTION
            </span>
            <p>{action.description}</p>
          </div>
        )}
        <div className="action-card-footer">
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            {action.links[0]?.label ?? '가이드 보기'}
            <ArrowRight size={14} />
          </Button>
          {!compact && (
            <label className="action-checkbox">
              <input type="checkbox" checked={done} onChange={() => toggleAction(action.id)} />
              실천 완료
            </label>
          )}
          {compact && (
            <span className="muted text-xs">
              {action.estimatedScoreImpact > 0
                ? `예상 +${action.estimatedScoreImpact}점`
                : '경험 확장'}
            </span>
          )}
        </div>
      </div>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={action.type === 'PROJECT' ? `${action.title} · 실천 가이드` : resource.title}
        description={resource.subtitle}
      >
        <div className="resource-label">
          <BookOpen size={14} />
          DEMO RECOMMENDATION
        </div>
        <p className="resource-description">{resource.description}</p>
        <div className="resource-tags">
          {resource.tags.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <ol className="resource-steps">
          {resource.steps.map((s, i) => (
            <li key={s}>
              <span>{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
        <p className="info-box my-5">
          학습·프로젝트 추천은 예시입니다. 완료 체크만으로 점수가 오르지 않으며 실제 수행한 내용을
          지원서에 반영한 후 다시 분석합니다.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/applications/${applicationId}/edit`}>
              지원서 보강하기
              <ArrowRight size={15} />
            </Link>
          </Button>
          {action.type === 'CERTIFICATION' && (
            <Button asChild variant="outline">
              <a href="https://www.q-net.or.kr/" target="_blank" rel="noreferrer">
                Q-Net 공식 사이트
                <ExternalLink size={14} />
              </a>
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              if (!done) toggleAction(action.id);
              setOpen(false);
            }}
          >
            <CheckCheck size={15} />
            {done ? '닫기' : '실천 완료로 표시'}
          </Button>
        </div>
      </Dialog>
    </article>
  );
}
export function ImprovementRoadmap({
  actions,
  applicationId,
}: {
  actions: ImprovementAction[];
  applicationId: string;
}) {
  return (
    <div className="roadmap">
      {actions.map((action) => (
        <ActionCard key={action.id} action={action} applicationId={applicationId} />
      ))}
    </div>
  );
}
export function NoGaps() {
  return (
    <div className="success-panel">
      <Layers2 size={30} />
      <h3>모든 항목에서 관련 근거가 확인됐어요.</h3>
      <p>
        면접에서 문제 해결 과정과 본인의 역할을 더 자세히 이야기할 수 있도록 프로젝트를 정리해
        보세요.
      </p>
    </div>
  );
}
