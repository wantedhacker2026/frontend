import assert from 'node:assert/strict';
import { renderJobPosting } from '../lib/job-postings/render';
import { safeFetch } from '../lib/job-postings/fetch';

async function main() {
  const sourceUrl = 'https://careers.example.org/jobs/dynamic';
  const calls: string[] = [];
  const blocked: string[] = [];
  const result = await renderJobPosting(
    {
      url: sourceUrl,
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: Buffer.from(
        '<html><body><main id="content"></main><script src="https://assets.example.org/app.js"></script></body></html>',
      ),
    },
    async (url, options) => {
      calls.push(url);
      if (url === 'https://assets.example.org/app.js')
        return {
          url,
          status: 200,
          contentType: 'text/javascript; charset=utf-8',
          body: Buffer.from(`
        fetch('http://127.0.0.1/private').catch(() => {});
        fetch('http://169.254.169.254/latest/meta-data').catch(() => {});
        setTimeout(() => {
          document.getElementById('content').innerHTML = '<h1>동적 공고 테스트</h1><h2>주요업무</h2><p>Java와 Spring Boot로 백엔드 API를 설계하고 안정적인 서비스를 운영합니다.</p><h2>자격요건</h2><p>백엔드 실무 경력 3년 이상 및 MySQL 테이블 설계 경험이 필요합니다.</p><h2>우대사항</h2><p>Kafka 운영 경험</p>';
        }, 600);
      `),
        };
      try {
        return await safeFetch(url, options);
      } catch (error) {
        blocked.push(url);
        throw error;
      }
    },
    AbortSignal.timeout(20000),
  );
  assert.equal(result?.method, 'rendered', JSON.stringify({ calls, blocked, result }));
  assert.equal(result?.title, '동적 공고 테스트');
  assert.match(result!.sections.requirements, /MySQL/);
  assert.equal(result?.sections.preferred, 'Kafka 운영 경험');
  assert.ok(calls.includes('https://assets.example.org/app.js'));
  assert.ok(blocked.includes('http://127.0.0.1/private'));
  assert.ok(blocked.includes('http://169.254.169.254/latest/meta-data'));
  console.log('PASS: dynamic hydration, section extraction and private-network request blocking');
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
