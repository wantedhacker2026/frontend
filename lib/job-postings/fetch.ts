import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';
import ipaddr from 'ipaddr.js';

export class ImportError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 422,
  ) {
    super(message);
  }
}
export const USER_AGENT = 'WantedHackerJobImporter/1.0';
export function publicAddress(address: string) {
  try {
    // Reject IPv4-mapped IPv6 too; there is no need to support transition networks.
    return ipaddr.parse(address).range() === 'unicast';
  } catch {
    return false;
  }
}
export function publicUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ImportError('INVALID_URL', '올바른 공고 URL을 입력해 주세요.', 400);
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.port ||
    hostname.endsWith('.') ||
    (!hostname.includes('.') && !isIP(hostname)) ||
    /(?:^|\.)(?:localhost|local|internal|test|invalid|example)$/.test(hostname) ||
    (isIP(hostname) && !publicAddress(hostname))
  ) {
    throw new ImportError(
      'UNSAFE_URL',
      '공개된 웹사이트의 일반 HTTP·HTTPS 공고 주소만 사용할 수 있습니다.',
      400,
    );
  }
  url.hash = '';
  return url;
}
type Resolver = (hostname: string) => Promise<{ address: string; family: number }[]>;
async function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  let abort: () => void = () => {};
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        abort = () => reject(signal.reason);
        signal.addEventListener('abort', abort, { once: true });
      }),
    ]);
  } finally {
    signal.removeEventListener('abort', abort);
  }
}
export async function resolvePublicTarget(
  value: string,
  resolver: Resolver = (host) => lookup(host, { all: true }),
) {
  const url = publicUrl(value);
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await resolver(hostname);
  if (!addresses.length || addresses.some(({ address }) => !publicAddress(address)))
    throw new ImportError('UNSAFE_URL', '내부 네트워크 주소에서는 공고를 가져올 수 없습니다.', 400);
  return { url, address: addresses[0] };
}
export type FetchedPage = { url: string; status: number; contentType: string; body: Buffer };
export type FetchOptions = {
  signal: AbortSignal;
  maxBytes?: number;
  beforeRequest?: (url: URL) => Promise<void>;
};

/** DNS is checked once per hop and that exact address is pinned to the socket. */
export async function safeFetch(value: string, options: FetchOptions): Promise<FetchedPage> {
  let current = value;
  for (let redirects = 0; redirects <= 3; redirects++) {
    options.signal.throwIfAborted();
    const { url, address } = await abortable(resolvePublicTarget(current), options.signal);
    options.signal.throwIfAborted();
    await options.beforeRequest?.(url);
    const result = await new Promise<FetchedPage & { location?: string }>((resolve, reject) => {
      const max = options.maxBytes ?? 2_000_000;
      const req = (url.protocol === 'https:' ? httpsRequest : httpRequest)(
        url,
        {
          method: 'GET',
          signal: options.signal,
          agent: false,
          family: address.family,
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'text/html,application/xhtml+xml,application/json,text/plain;q=0.8,*/*;q=0.1',
            'Accept-Encoding': 'identity',
          },
          lookup: (_hostname, _options, callback) =>
            callback(null, address.address, address.family),
        },
        (res) => {
          const status = res.statusCode ?? 502;
          if ([301, 302, 303, 307, 308].includes(status)) {
            res.destroy();
            resolve({
              url: url.href,
              status,
              body: Buffer.alloc(0),
              contentType: '',
              location: res.headers.location,
            });
            return;
          }
          const fail = (error: Error) => {
            res.destroy();
            req.destroy();
            reject(error);
          };
          if (Number(res.headers['content-length']) > max) {
            fail(
              new ImportError(
                'TOO_LARGE',
                '공고 페이지가 너무 큽니다. 본문을 직접 붙여넣어 주세요.',
              ),
            );
            return;
          }
          const encoding = res.headers['content-encoding'];
          const decoder =
            encoding === 'gzip'
              ? createGunzip()
              : encoding === 'br'
                ? createBrotliDecompress()
                : encoding === 'deflate'
                  ? createInflate()
                  : null;
          if (encoding && encoding !== 'identity' && !decoder) {
            fail(new ImportError('UNSUPPORTED', '이 페이지 형식은 자동 수집할 수 없습니다.'));
            return;
          }
          let wireBytes = 0;
          res.on('data', (chunk: Buffer) => {
            wireBytes += chunk.length;
            if (wireBytes > max) fail(new ImportError('TOO_LARGE', '공고 페이지가 너무 큽니다.'));
          });
          res.on('error', reject);
          res.on('aborted', () =>
            reject(new ImportError('FETCH_FAILED', '페이지 연결이 중단되었습니다.')),
          );
          const stream = decoder ? res.pipe(decoder) : res;
          const chunks: Buffer[] = [];
          let bytes = 0;
          stream.on('data', (chunk: Buffer) => {
            bytes += chunk.length;
            if (bytes > max) {
              decoder?.destroy();
              fail(new ImportError('TOO_LARGE', '공고 페이지가 너무 큽니다.'));
            } else chunks.push(chunk);
          });
          stream.on('error', fail);
          stream.on('end', () =>
            resolve({
              url: url.href,
              status,
              body: Buffer.concat(chunks),
              contentType: res.headers['content-type'] ?? '',
            }),
          );
        },
      );
      req.on('error', reject);
      req.setTimeout(8000, () =>
        req.destroy(
          new ImportError('TIMEOUT', '공고 사이트의 응답이 늦습니다. 잠시 후 다시 시도해 주세요.'),
        ),
      );
      req.end();
    });
    if (![301, 302, 303, 307, 308].includes(result.status)) return result;
    if (!result.location)
      throw new ImportError('FETCH_FAILED', '공고 이동 주소를 확인할 수 없습니다.');
    current = new URL(result.location, result.url).href;
  }
  throw new ImportError(
    'REDIRECT_LIMIT',
    '페이지 이동이 너무 많습니다. 최종 공고 주소를 입력해 주세요.',
  );
}
