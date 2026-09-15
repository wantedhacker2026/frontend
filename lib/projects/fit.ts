import type { ProjectAnalysis, ProjectCriterion } from './types';

export function fitSummary(criteria: ProjectCriterion[], analysis: ProjectAnalysis) {
  const items = criteria.map((criterion) => {
    const result = analysis.results.find((r) => r.criterionId === criterion.id);
    const ratio =
      result?.status !== 'unreadable' &&
      result?.score !== undefined &&
      result.maxScore !== undefined &&
      result.maxScore > 0
        ? result.evidenceLevel !== undefined
          ? result.evidenceLevel / 4
          : result.score / result.maxScore
        : null;
    return { criterion, ratio, met: ratio !== null && ratio >= (criterion.minimumRatio ?? 0.5) };
  });
  const met = items.filter((item) => item.met).length;
  const core = items.filter((item) => item.criterion.core);
  return {
    items,
    met,
    total: items.length,
    coverage: items.length ? Math.round((met / items.length) * 100) : 0,
    coreMet: core.filter((item) => item.met).length,
    coreTotal: core.length,
    unknown: items.filter((item) => item.ratio === null).map((item) => item.criterion.name),
    weak: items
      .filter((item) => item.ratio !== null && !item.met)
      .map((item) => item.criterion.name),
    available: items.some((item) => item.ratio !== null),
    legacy: analysis.results.some(
      (result) => result.score !== undefined && result.evidenceLevel === undefined,
    ),
  };
}

export function sortAnalyses(
  analyses: ProjectAnalysis[],
  criteria: ProjectCriterion[],
  order: string,
) {
  const summaries = new Map(
    analyses.map((analysis) => [analysis.id, fitSummary(criteria, analysis)]),
  );
  return [...analyses].sort((a, b) => {
    const x = summaries.get(a.id)!;
    const y = summaries.get(b.id)!;
    let diff = 0;
    if (order === 'recent') diff = (b.registeredAt ?? '').localeCompare(a.registeredAt ?? '');
    else {
      // Unknown scores are separate from zero; never let an unreadable document outrank known evidence.
      diff = Number(y.available) - Number(x.available);
      if (!diff && order === 'balanced') diff = y.coreMet - x.coreMet || y.met - x.met;
      if (!diff && order.startsWith('criterion:')) {
        const id = order.slice('criterion:'.length);
        const left = x.items.find((item) => item.criterion.id === id)?.ratio ?? -1;
        const right = y.items.find((item) => item.criterion.id === id)?.ratio ?? -1;
        diff = right - left;
      }
      if (!diff) diff = b.score - a.score;
    }
    return diff || a.name.localeCompare(b.name, 'ko') || a.personId.localeCompare(b.personId);
  });
}
