import robotsParser from 'robots-parser';
import { ImportError, safeFetch, USER_AGENT, type FetchOptions, type FetchedPage } from './fetch';
import { parseJobPosting } from './parser';
import type { JobPosting } from './types';

type Fetcher = (url: string, options: FetchOptions) => Promise<FetchedPage>;
export type Renderer = (
  page: FetchedPage,
  fetcher: Fetcher,
  signal: AbortSignal,
) => Promise<JobPosting | null>;
export async function importJobPosting(
  url: string,
  options: {
    signal: AbortSignal;
    fetcher?: Fetcher;
    renderer?: Renderer;
  },
) {
  const fetcher = options.fetcher ?? safeFetch;
  const robots = new Map<string, Promise<ReturnType<typeof robotsParser>>>();
  const checkRobots = async (target: URL) => {
    let rule = robots.get(target.origin);
    if (!rule) {
      rule = (async () => {
        const robotsUrl = new URL('/robots.txt', target).href;
        const result = await fetcher(robotsUrl, { signal: options.signal, maxBytes: 500_000 });
        if (result.status === 404 || result.status === 410) return robotsParser(robotsUrl, '');
        if (result.status !== 200 || /text\/html/i.test(result.contentType))
          throw new ImportError(
            'ROBOTS_UNAVAILABLE',
            '이 사이트의 자동 수집 허용 여부를 확인할 수 없습니다. 본문을 직접 붙여넣어 주세요.',
          );
        return robotsParser(robotsUrl, result.body.toString('utf8'));
      })();
      robots.set(target.origin, rule);
    }
    if ((await rule).isAllowed(target.href, USER_AGENT) === false)
      throw new ImportError(
        'ROBOTS_DENIED',
        '사이트에서 이 공고의 자동 수집을 허용하지 않습니다. 본문을 직접 붙여넣어 주세요.',
      );
  };
  const page = await fetcher(url, { signal: options.signal, beforeRequest: checkRobots });
  if (page.status === 401 || page.status === 403 || page.status === 429)
    throw new ImportError(
      'ACCESS_DENIED',
      '로그인 또는 접근 제한이 있는 공고입니다. 본문을 직접 붙여넣어 주세요.',
    );
  if (page.status < 200 || page.status >= 300)
    throw new ImportError(
      'FETCH_FAILED',
      '공고 페이지를 열 수 없습니다. 주소나 공고 마감 여부를 확인해 주세요.',
    );
  if (!/text\/html|application\/xhtml\+xml/i.test(page.contentType))
    throw new ImportError(
      'UNSUPPORTED',
      'HTML 공고 페이지만 지원합니다. 문서나 이미지의 내용은 직접 입력해 주세요.',
    );
  const parsed = parseJobPosting(page.body, page.url, page.contentType);
  if (parsed) return parsed;
  if (options.renderer) {
    const rendered = await options.renderer(
      page,
      (resourceUrl, fetchOptions) =>
        fetcher(resourceUrl, {
          ...fetchOptions,
          // A rendered page may navigate again; check rules on every document hop too.
          beforeRequest: fetchOptions.beforeRequest ? checkRobots : undefined,
        }),
      options.signal,
    );
    if (rendered) return rendered;
  }
  throw new ImportError(
    'CONTENT_UNAVAILABLE',
    '공고 본문을 찾지 못했습니다. 동적 페이지 또는 지원하지 않는 형식일 수 있습니다. 본문을 직접 붙여넣어 주세요.',
  );
}
