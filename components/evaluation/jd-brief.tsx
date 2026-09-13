import { FileSearch } from 'lucide-react';
import type { EvaluationCriterion, Job } from '@/types';

export function JDBrief({ job, criteria }: { job: Job; criteria: EvaluationCriterion[] }) {
  return (
    <section className="jd-brief" aria-label="JD 분석 핵심 키워드">
      <div className="jd-brief-title">
        <FileSearch size={20} />
        <div>
          <h2>JD 분석 핵심 키워드</h2>
          <p>
            {job.companyName} · {job.title}
          </p>
        </div>
      </div>
      <dl>
        <div>
          <dt>경력</dt>
          <dd>{job.minExperience > 0 ? `${job.minExperience}년 이상 권장` : '신입 지원 가능'}</dd>
        </div>
        <div>
          <dt>필수 역량</dt>
          <dd className="jd-keywords">
            {criteria
              .filter((c) => c.required)
              .map((c) => (
                <span key={c.id}>{c.name}</span>
              ))}
          </dd>
        </div>
        <div>
          <dt>우대 역량</dt>
          <dd className="jd-keywords">
            {criteria.some((c) => !c.required)
              ? criteria.filter((c) => !c.required).map((c) => <span key={c.id}>{c.name}</span>)
              : '별도 우대 역량 없음'}
          </dd>
        </div>
      </dl>
    </section>
  );
}
