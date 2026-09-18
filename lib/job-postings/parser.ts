import { load, loadBuffer, type CheerioAPI } from 'cheerio';
import { ImportError } from './fetch';
import {
  emptySections,
  postingText,
  sectionHeading,
  type JobPosting,
  type SectionKey,
} from './types';

function clean(text: string) {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/[\t\r ]+/g, ' ')
    .split('\n')
    .map((v) => v.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}
export function htmlText(html: string) {
  const $ = load(html);
  $(
    'script,style,noscript,iframe,svg,form,button,input,select,nav,footer,aside,[hidden],[aria-hidden="true"]',
  ).remove();
  $('br').replaceWith('\n');
  $('h1,h2,h3,h4,h5,h6,p,div,section,article,li,tr,ul,ol').each((_, el) => {
    $(el).prepend('\n').append('\n');
  });
  return clean($.root().text());
}
export function splitSections(text: string) {
  const sections = emptySections();
  let current: SectionKey = 'other';
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const inline = line.match(/^(.{2,35}?)[：:]\s*(.+)$/);
    const heading = sectionHeading(inline?.[1] ?? line);
    if (heading) {
      current = heading;
      if (inline) sections[current] += `${inline[2]}\n`;
    } else sections[current] += `${line}\n`;
  }
  for (const key of Object.keys(sections) as SectionKey[]) sections[key] = sections[key].trim();
  return sections;
}
function field(value: unknown): string {
  if (typeof value === 'string') return htmlText(value);
  if (Array.isArray(value)) return value.map(field).filter(Boolean).join('\n');
  if (value && typeof value === 'object') {
    const item = value as Record<string, unknown>;
    return field(item.description ?? item.name ?? item.value);
  }
  return '';
}
function jobObjects($: CheerioAPI) {
  const jobs: Record<string, unknown>[] = [];
  let nodes = 0;
  function visit(value: unknown, depth = 0) {
    if (++nodes > 5000 || depth > 15 || !value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    const object = value as Record<string, unknown>;
    const types = Array.isArray(object['@type']) ? object['@type'] : [object['@type']];
    if (types.some((type) => typeof type === 'string' && /(?:^|\/)JobPosting$/.test(type)))
      jobs.push(object);
    for (const item of Object.values(object)) visit(item, depth + 1);
  }
  $('script[type="application/ld+json"]')
    .slice(0, 30)
    .each((_, script) => {
      try {
        visit(JSON.parse($(script).text()));
      } catch {
        /* Malformed metadata falls back to visible content. */
      }
    });
  return jobs;
}
function samePage(a: unknown, b: string) {
  try {
    if (typeof a !== 'string') return false;
    const left = new URL(a, b),
      right = new URL(b);
    return (
      left.origin === right.origin &&
      left.pathname.replace(/\/$/, '') === right.pathname.replace(/\/$/, '') &&
      left.search === right.search
    );
  } catch {
    return false;
  }
}
function merge(a: string, b: string) {
  return [
    ...new Set(
      `${a}\n${b}`
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    ),
  ].join('\n');
}
export function parseJobPosting(
  html: Buffer | string,
  sourceUrl: string,
  contentType = '',
): JobPosting | null {
  const charset = contentType.match(/charset\s*=\s*["']?([^\s;"']+)/i)?.[1];
  const $ =
    typeof html === 'string'
      ? load(html)
      : loadBuffer(html, { encoding: { transportLayerEncodingLabel: charset } });
  const jobs = jobObjects($);
  const unique = [...new Map(jobs.map((job) => [JSON.stringify(job), job])).values()];
  const matches = unique.filter(
    (job) => samePage(job.url, sourceUrl) || samePage(job['@id'], sourceUrl),
  );
  if (unique.length > 1 && matches.length !== 1)
    throw new ImportError(
      'MULTIPLE_JOBS',
      '여러 공고가 있는 목록입니다. 하나의 채용공고 상세 주소를 입력해 주세요.',
    );
  const job = matches[0] ?? unique[0];
  const warnings: string[] = [];
  let sections = emptySections();
  let method: JobPosting['method'] = 'html';
  let title = field(job?.title);
  const company = field(job?.hiringOrganization);
  if (job) {
    sections = splitSections(field(job.description));
    sections.responsibilities = merge(sections.responsibilities, field(job.responsibilities));
    sections.requirements = merge(
      sections.requirements,
      [job.qualifications, job.experienceRequirements, job.educationRequirements]
        .map(field)
        .filter(Boolean)
        .join('\n'),
    );
    sections.techStack = merge(sections.techStack, field(job.skills));
    method = 'structured-data';
    if (typeof job.validThrough === 'string' && new Date(job.validThrough).getTime() < Date.now())
      warnings.push('마감일이 지난 공고입니다. 현재 채용 여부를 확인해 주세요.');
  }
  const hasStructuredBody = postingText(sections).length >= 60;
  if (!hasStructuredBody || !sections.requirements || !sections.responsibilities) {
    $(
      'script,style,noscript,nav,footer,aside,form,button,[hidden],[aria-hidden="true"],.cookie-banner,.cookie-consent',
    ).remove();
    const candidates: { text: string; score: number }[] = [];
    $(
      'main,article,[role="main"],[itemprop="description"],[class*="job-description"],[class*="job_description"],body',
    ).each((_, element) => {
      const clone = $(element).clone();
      clone.find('header').remove();
      const text = htmlText(clone.html() ?? '');
      const headings = text
        .split('\n')
        .filter((line) => sectionHeading(line) && sectionHeading(line) !== 'other').length;
      // Unstructured pages need actual job section headings; do not import login/error pages.
      if (element.tagName === 'body' && candidates.length) return;
      if (headings && text.length >= 60)
        candidates.push({ text, score: headings * 10000 - text.length });
    });
    candidates.sort((a, b) => b.score - a.score);
    if (!candidates.length && !hasStructuredBody) return null;
    if (candidates.length) {
      const visible = splitSections(candidates[0].text);
      if (!hasStructuredBody) {
        sections = visible;
        method = 'html';
      } else {
        // Some sites put only the introduction in JSON-LD. Recover missing
        // sections without replacing explicit structured requirements.
        for (const key of Object.keys(sections) as SectionKey[]) {
          if (key !== 'other' && !sections[key]) sections[key] = visible[key];
        }
      }
    }
    if (
      !hasStructuredBody &&
      sections.other.length > 15000 &&
      !sections.requirements &&
      !sections.responsibilities
    )
      return null;
  }
  title ||=
    clean($('h1').first().text()) ||
    $('meta[property="og:title"]').attr('content') ||
    clean($('title').text());
  if (postingText(sections).length > 30000)
    throw new ImportError(
      'TEXT_TOO_LONG',
      '추출한 본문이 30,000자를 넘습니다. 해당 공고 내용만 직접 붙여넣어 주세요.',
    );
  if (!sections.requirements)
    warnings.push('자격요건을 별도로 확인하지 못했습니다. 원문과 비교해 분류해 주세요.');
  if (sections.other) warnings.push('자동으로 분류하지 못한 내용은 기타 공고 내용에 담았습니다.');
  warnings.push(
    '기술 스택과 우대사항은 필수 자격으로 자동 지정하지 않습니다. 평가 기준을 확인해 주세요.',
  );
  return {
    title: title.slice(0, 300),
    company: company.slice(0, 300),
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    method,
    sections,
    warnings,
  };
}
