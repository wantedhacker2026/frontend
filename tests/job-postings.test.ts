import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJobPosting, splitSections } from '../lib/job-postings/parser';
import {
  publicAddress,
  publicUrl,
  resolvePublicTarget,
  ImportError,
  type FetchOptions,
} from '../lib/job-postings/fetch';
import { importJobPosting } from '../lib/job-postings/import';
import { postingText } from '../lib/job-postings/types';
import { deriveCriteria, processDraft, parseProjects } from '../lib/projects/domain';
import { demoDraft } from '../lib/projects/demo';
import { POST } from '../app/api/job-postings/import/route';
import { signSession, SESSION_COOKIE } from '../lib/auth/session';

const url = 'https://careers.example.org/jobs/backend';
const description =
  '<h2>주요업무</h2><p>Java와 Spring Boot로 고객 계약 API를 설계하고 운영합니다.</p><h2>자격요건</h2><ul><li>Java 개발 경력 3년 이상</li><li>MySQL 테이블 설계 경험</li></ul><h2>우대사항</h2><p>Kafka 이벤트 설계 경험</p><h2>기술 스택</h2><p>Docker, Kubernetes, Redis</p>';
const job = {
  '@type': 'JobPosting',
  title: '백엔드 개발자',
  hiringOrganization: { name: '테스트 기업' },
  description,
};
const structured = (value: unknown) =>
  `<html><head><script type="application/ld+json">${JSON.stringify(value)}</script></head><body><nav>다른 공고 React</nav></body></html>`;

test('JSON-LD graph separates original requirements, preferences and company stack', () => {
  const p = parseJobPosting(structured({ '@graph': [{ '@type': 'Organization' }, job] }), url)!;
  assert.equal(p.method, 'structured-data');
  assert.equal(p.company, '테스트 기업');
  assert.match(p.sections.requirements, /Java 개발 경력 3년 이상/);
  assert.match(p.sections.responsibilities, /계약 API/);
  assert.equal(p.sections.preferred, 'Kafka 이벤트 설계 경험');
  assert.match(p.sections.techStack, /Docker/);
  assert.doesNotMatch(postingText(p.sections), /다른 공고|<|script/);
});
test('structured explicit fields, arrays and expired postings are preserved', () => {
  const p = parseJobPosting(
    structured({
      ...job,
      '@type': ['Thing', 'JobPosting'],
      responsibilities: '테스트 및 운영 관리',
      qualifications: ['백엔드 경력', { name: 'RDBMS 설계' }],
      skills: ['Netty', 'Google Cloud'],
      validThrough: '2020-01-01',
    }),
    url,
  )!;
  assert.match(p.sections.requirements, /RDBMS 설계/);
  assert.match(p.sections.techStack, /Netty\nGoogle Cloud/);
  assert.ok(p.warnings.some((v) => v.includes('마감일')));
});
test('HTTP charset keeps Korean text intact and visible sections fill incomplete JSON-LD', () => {
  const partial = {
    ...job,
    description:
      '우리는 고객의 구독 서비스를 운영하는 기업입니다. 함께 제품을 만들고 안정적인 서비스를 제공할 백엔드 개발자를 찾습니다.',
  };
  const html = structured(partial).replace('</body>', `<main>${description}</main></body>`);
  const p = parseJobPosting(Buffer.from(html), url, 'text/html; charset=utf-8')!;
  assert.equal(p.title, '백엔드 개발자');
  assert.match(p.sections.requirements, /Java 개발 경력/);
  assert.match(p.sections.responsibilities, /계약 API/);
  assert.equal(p.sections.preferred, 'Kafka 이벤트 설계 경험');
  assert.equal(
    splitSections('자격요건\n기술 스택을 선정하고 서비스를 운영한 경험').requirements,
    '기술 스택을 선정하고 서비스를 운영한 경험',
  );
});
test('HTML fallback removes menus, script, hidden content and preserves section lines', () => {
  const p = parseJobPosting(
    `<nav>Vue 개인정보처리방침</nav><script type="application/ld+json">broken</script><main><h1>백엔드 개발자</h1>${description}<p hidden>비밀번호</p><footer>관련 공고 Angular</footer></main>`,
    url,
  )!;
  assert.equal(p.method, 'html');
  assert.equal(p.title, '백엔드 개발자');
  assert.doesNotMatch(postingText(p.sections), /Vue|Angular|비밀번호|broken/);
  assert.match(p.sections.requirements, /Java 개발 경력 3년 이상\nMySQL/);
});
test('PM headings and inline sections retain required vs preferred distinctions', () => {
  const parts = splitSections(
    '주요업무\n고객 요구사항과 일정, 리소스를 관리합니다.\n자격요건: PM 경력 10년 이상\n금융권 B2B 프로젝트 수행 경험\n우대사항\nPoC 및 프리세일즈 경험\n복리후생\n교육비 지원',
  );
  assert.match(parts.requirements, /PM 경력 10년 이상\n금융권/);
  assert.equal(parts.preferred, 'PoC 및 프리세일즈 경험');
  assert.equal(parts.other, '교육비 지원');
});
test('English headings and unlabelled structured description do not invent requirements', () => {
  const p = parseJobPosting(
    structured({
      ...job,
      description:
        '<h2>Responsibilities</h2><p>Build reliable React interfaces and API integrations.</p><h2>Minimum qualifications</h2><p>TypeScript production experience.</p><h2>Nice to have</h2><p>Vue experience.</p>',
    }),
    url,
  )!;
  assert.equal(p.sections.requirements, 'TypeScript production experience.');
  assert.equal(p.sections.preferred, 'Vue experience.');
  const unlabelled = parseJobPosting(
    structured({
      ...job,
      description:
        'We build reliable backend services with Java and Spring Boot. Join our growing engineering team.',
    }),
    url,
  )!;
  assert.equal(unlabelled.sections.requirements, '');
  assert.ok(unlabelled.sections.other);
});
test('listing ambiguity, empty shells, login pages and oversized text are handled', () => {
  assert.throws(
    () => parseJobPosting(structured([job, { ...job, title: '다른 개발자' }]), url),
    /목록/,
  );
  const p = parseJobPosting(structured([job, { ...job, url, title: '선택된 개발자' }]), url)!;
  assert.equal(p.title, '선택된 개발자');
  assert.equal(parseJobPosting('<div id="root"></div><script src="/app.js"></script>', url), null);
  assert.equal(
    parseJobPosting('<h1>로그인</h1><form>이메일과 비밀번호를 입력하세요.</form>', url),
    null,
  );
  assert.throws(
    () => parseJobPosting(structured({ ...job, description: 'x'.repeat(31000) }), url),
    /30,000/,
  );
});
test('imported criteria mark only explicit qualifications required in legacy and role catalogs', () => {
  const p = parseJobPosting(structured(job), url)!;
  for (const profile of [undefined, 'backend'] as const) {
    const criteria = deriveCriteria(postingText(p.sections), profile, true);
    assert.ok(criteria.some((c) => c.required));
    assert.ok(
      criteria
        .filter((c) => c.keywords.some((k) => /Kafka|Docker|Redis/i.test(k)))
        .every((c) => !c.required),
    );
  }
});
test('private, mapped, encoded and reserved addresses are rejected before network access', async () => {
  for (const value of [
    'http://localhost/',
    'http://127.0.0.1/',
    'http://2130706433/',
    'http://0x7f000001/',
    'http://10.0.0.1/',
    'http://169.254.169.254/',
    'http://[::1]/',
    'http://[::ffff:127.0.0.1]/',
    'https://a:b@example.org/',
    'ftp://example.org/',
    'https://example.org:8080/',
    'https://metadata.internal/',
  ])
    assert.throws(() => publicUrl(value), ImportError, value);
  assert.equal(publicAddress('192.168.1.2'), false);
  assert.equal(publicAddress('fc00::1'), false);
  assert.equal(publicAddress('8.8.8.8'), true);
  assert.equal(publicUrl(url).href, url);
  await assert.rejects(
    () =>
      resolvePublicTarget(url, async () => [
        { address: '8.8.8.8', family: 4 },
        { address: '127.0.0.1', family: 4 },
      ]),
    ImportError,
  );
  const target = await resolvePublicTarget(url, async () => [{ address: '8.8.8.8', family: 4 }]);
  assert.equal(target.address.address, '8.8.8.8');
});

function fakeFetcher(html: string, robots = '', status = 200, type = 'text/html') {
  return async (target: string, options: FetchOptions) => {
    if (target.endsWith('/robots.txt'))
      return { url: target, status: 200, contentType: 'text/plain', body: Buffer.from(robots) };
    await options.beforeRequest?.(new URL(target));
    return { url: target, status, contentType: type, body: Buffer.from(html) };
  };
}
test('robots disallow, site denial, non-HTML and dynamic fallback do not become fake results', async () => {
  const signal = AbortSignal.timeout(10000);
  await assert.rejects(
    () =>
      importJobPosting(url, {
        signal,
        fetcher: fakeFetcher(structured(job), 'User-agent: *\nDisallow: /jobs/'),
      }),
    /許可|허용/,
  );
  await assert.rejects(
    () => importJobPosting(url, { signal, fetcher: fakeFetcher('', '', 403) }),
    /접근 제한/,
  );
  await assert.rejects(
    () => importJobPosting(url, { signal, fetcher: fakeFetcher('', '', 200, 'application/pdf') }),
    /HTML/,
  );
  await assert.rejects(
    () => importJobPosting(url, { signal, fetcher: fakeFetcher('<div id="root"></div>') }),
    /본문을 찾지/,
  );
  let rendered = 0;
  const renderer = async () => {
    rendered++;
    return { ...parseJobPosting(structured(job), url)!, method: 'rendered' as const };
  };
  const p = await importJobPosting(url, {
    signal,
    fetcher: fakeFetcher('<div id="root"></div>'),
    renderer,
  });
  assert.equal(p.method, 'rendered');
  assert.equal(rendered, 1);
  await importJobPosting(url, { signal, fetcher: fakeFetcher(structured(job)), renderer });
  assert.equal(rendered, 1);
});
test('import provenance survives analysis and project storage round trip', async () => {
  const actor = { id: 'jd-test', name: '지원자', role: 'applicant' as const, provider: 'demo' };
  const p = parseJobPosting(structured(job), url)!;
  const draft = demoDraft(actor);
  const text = postingText(p.sections);
  draft.jd = {
    mode: 'url',
    reference: url,
    text,
    imported: { sourceUrl: url, fetchedAt: p.fetchedAt, method: p.method, originalText: text },
  };
  draft.criteria = deriveCriteria(text, undefined, true);
  const project = await processDraft(draft, actor, undefined, () => {});
  const db = parseProjects(JSON.stringify({ version: 1, actor, projects: [project] }));
  assert.deepEqual(db.projects[0].jd.imported, draft.jd.imported);
  assert.ok(db.projects[0].revisions[0].analyses.length);
});
test('import endpoint enforces signed sessions, origin, size and safe URLs', async () => {
  const secret = 'job-import-test-secret-more-than-32-characters';
  process.env.INTERVIEW_PROXY_SECRET = secret;
  const actor = { id: 'jd-route', name: '지원자', role: 'applicant' as const, provider: 'demo' };
  const token = signSession(actor, secret);
  const request = (body: string, signed = true, origin = 'http://localhost:3000') =>
    new Request('http://localhost:3000/api/job-postings/import', {
      method: 'POST',
      headers: {
        origin,
        'Content-Type': 'application/json',
        ...(signed ? { cookie: `${SESSION_COOKIE}=${token}` } : {}),
      },
      body,
    });
  assert.equal((await POST(request('{}', false))).status, 401);
  assert.equal((await POST(request('{}', true, 'https://evil.org'))).status, 403);
  assert.equal((await POST(request('bad-json'))).status, 400);
  assert.equal((await POST(request('x'.repeat(5000)))).status, 413);
  const response = await POST(request(JSON.stringify({ url: 'http://127.0.0.1:8080' })));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'UNSAFE_URL');
});
