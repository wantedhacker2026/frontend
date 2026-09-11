'use client';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MatchScore, CriterionProgress } from '@/components/evaluation/score';
import { rowSignals } from '@/lib/candidates';
import type { CandidateRow, EvaluationCriterion } from '@/types';
export function CandidateComparison({
  open,
  onOpenChange,
  chosen,
  criteria,
  jobId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chosen: CandidateRow[];
  criteria: EvaluationCriterion[];
  jobId: string;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="지원자 나란히 비교"
      description="동일한 기준에서 강점과 추가로 확인할 근거를 비교하세요. 최종 판단은 채용담당자가 진행합니다."
      wide
    >
      <div
        className="comparison-grid"
        style={{ gridTemplateColumns: `repeat(${chosen.length},minmax(200px,1fr))` }}
      >
        {chosen.map((r) => {
          const { strong, gaps } = rowSignals(r, criteria);
          return (
            <article key={r.application.id}>
              <h3>
                {r.candidate.name}
                <small>경력 {r.application.experience}년</small>
              </h3>
              <MatchScore score={r.evaluation.totalScore} />
              <p className="my-5 text-sm">
                {r.evaluation.requiredMet ? '✓ 필수조건 근거 충족' : '◌ 필수조건 추가 확인'}
              </p>
              {Object.entries(r.evaluation.categoryScores).map(([k, v]) => (
                <CriterionProgress key={k} label={k} value={v} />
              ))}
              <h4>주요 강점</h4>
              <p>{strong.slice(0, 3).join(' · ') || '추가 근거 확인 필요'}</p>
              <h4>확인할 부분</h4>
              <p>{gaps.slice(0, 3).join(' · ') || '주요 확인사항 없음'}</p>
              <Button asChild variant="outline" className="mt-5 w-full">
                <Link href={`/recruiter/jobs/${jobId}/candidates/${r.candidate.id}`}>
                  상세 근거 보기
                  <ArrowRight size={15} />
                </Link>
              </Button>
            </article>
          );
        })}
      </div>
    </Dialog>
  );
}
