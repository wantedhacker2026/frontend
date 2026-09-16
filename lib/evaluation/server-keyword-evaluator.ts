import type { CandidateEvaluator } from './interface';
import { keywordRequestSchema, keywordResponseSchema } from './keyword-contract';
import { calculateScore } from '@/lib/scoring';
import { getJobProfile, JOB_PROFILE_CATALOG_VERSION } from './job-profiles';
import type { Application, EvaluationCriterion, EvaluationItem, Job } from '@/types';

export class ServerKeywordEvaluator implements CandidateEvaluator {
  constructor(private readonly request: typeof fetch = (...args) => fetch(...args)) {}

  async evaluate(job: Job, criteria: EvaluationCriterion[], application: Application) {
    const profile = getJobProfile(job.role);
    const body = keywordRequestSchema.parse({
      ...(profile
        ? {
            jobProfile: profile.id,
            catalogVersion: job.profileCatalogVersion ?? JOB_PROFILE_CATALOG_VERSION,
          }
        : {}),
      criteria: criteria.map(({ id, keywords, catalogCriterionId }) => ({
        id,
        keywords,
        ...(profile && catalogCriterionId ? { catalogCriterionId } : {}),
      })),
      text: [
        ...new Set([
          application.projects,
          application.skills,
          application.collaboration,
          application.additionalExperience,
          application.introduction,
        ]),
      ]
        .filter(Boolean)
        .join('\n'),
    });
    const response = await this.request('/api/analysis/keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(35_000),
    });
    if (!response.ok)
      throw new Error('서버 분석을 완료하지 못했습니다. 입력을 유지했으니 다시 시도해 주세요.');
    const analysis = keywordResponseSchema.parse(await response.json());
    if (profile && !analysis.version.endsWith(`:${body.catalogVersion}`))
      throw new Error(
        '서버의 직무 평가 목록 버전이 일치하지 않습니다. 웹과 서버의 목록을 함께 갱신해 주세요.',
      );
    if (
      analysis.results.length !== criteria.length ||
      new Set(analysis.results.map((r) => r.criterionId)).size !== criteria.length
    )
      throw new Error('서버 분석 결과의 기준이 일치하지 않습니다.');
    const id = `evaluation-${application.id}`;
    const items: EvaluationItem[] = criteria.map((criterion) => {
      const result = analysis.results.find((r) => r.criterionId === criterion.id);
      if (
        !result ||
        result.matches.length !== criterion.keywords.length ||
        result.matches.some((m, i) => m.jdKeyword !== criterion.keywords[i].trim()) ||
        result.related !== result.matches.some((m) => m.relation !== 'NONE') ||
        result.matches.some(
          (m) =>
            m.relation !== 'NONE' &&
            (!m.matchedKeyword || !m.evidence || !body.text.includes(m.evidence)),
        )
      )
        throw new Error('서버 분석 결과의 근거가 일치하지 않습니다.');
      if (
        (profile &&
          (result.evidenceLevel == null || result.evidenceLevel > 0 !== result.related)) ||
        (result.evidence &&
          !result.matches.some((m) => m.evidence === result.evidence && m.relation !== 'NONE'))
      )
        throw new Error('서버의 근거 수준과 원문이 일치하지 않습니다.');
      const hits = result.matches.filter((m) => m.relation !== 'NONE');
      const ratio = profile ? result.evidenceLevel! / 4 : result.related ? 1 : 0;
      const levelNames = ['미확인', '언급', '역할', '판단', '결과'];
      return {
        id: `${id}-${criterion.id}`,
        evaluationId: id,
        criterionId: criterion.id,
        score: Math.round(ratio * criterion.weight * 10) / 10,
        maxScore: criterion.weight,
        level:
          ratio >= 1 ? 'Strong' : ratio >= 0.75 ? 'Good' : ratio > 0 ? 'Partial' : 'Unverified',
        ...(profile ? { evidenceLevel: result.evidenceLevel! } : {}),
        evidence: result.evidence ?? hits[0]?.evidence ?? null,
        keywordMatches: result.matches,
        reason:
          (profile
            ? `서류 근거 수준: ${levelNames[result.evidenceLevel!]} (${result.evidenceLevel}/4). 규칙으로 분류한 작성 근거이며 실제 역량이나 성과를 검증한 결과는 아닙니다. `
            : '') +
          (hits.length
            ? hits
                .map(
                  (m) =>
                    `${m.jdKeyword} ← ${m.matchedKeyword} (${m.relation === 'DIRECT' ? '직접 일치' : '연관 일치'})`,
                )
                .join(', ')
            : '인정할 직접 또는 연관 키워드 언급을 확인하지 못했습니다. 경험이 없다는 부정 표현은 제외합니다. 역량이 없다는 의미는 아닙니다.'),
      };
    });
    return {
      id,
      applicationId: application.id,
      ...calculateScore(criteria, items),
      items,
      actions: [],
      evaluatedAt: new Date().toISOString(),
      evaluatorVersion: analysis.version,
      summary: '서버의 연관 키워드 규칙으로 JD 관련 언급을 확인했습니다.',
      recommendation: '키워드별 연결 근거를 검토해 주세요.',
    };
  }
}
