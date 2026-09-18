import { chromium } from 'playwright';
import { ImportError } from './fetch';
import { parseJobPosting } from './parser';
import type { Renderer } from './import';

let rendering = false;
/** All HTTP traffic is fulfilled by safeFetch; browser networking fails closed. */
export const renderJobPosting: Renderer = async (initial, fetcher, signal) => {
  if (rendering)
    throw new ImportError(
      'BUSY',
      '다른 공고를 가져오는 중입니다. 잠시 후 다시 시도해 주세요.',
      429,
    );
  rendering = true;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({
      headless: true,
      timeout: 8000,
      proxy: { server: 'http://127.0.0.1:1', bypass: '<-loopback>' },
      args: [
        '--disable-background-networking',
        '--disable-quic',
        '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
      ],
    });
    const abort = () => {
      void browser?.close().catch(() => {});
    };
    signal.addEventListener('abort', abort, { once: true });
    try {
      signal.throwIfAborted();
      const context = await browser.newContext({
        serviceWorkers: 'block',
        acceptDownloads: false,
        userAgent: 'WantedHackerJobImporter/1.0',
      });
      await context.routeWebSocket('**/*', (socket) => socket.close());
      let requests = 0,
        bytes = 0;
      const allowedTypes = new Set(['document', 'script', 'stylesheet', 'xhr', 'fetch']);
      await context.route('**/*', async (route) => {
        const request = route.request();
        if (
          signal.aborted ||
          request.method() !== 'GET' ||
          !allowedTypes.has(request.resourceType()) ||
          ++requests > 50 ||
          bytes > 8_000_000
        ) {
          await route.abort().catch(() => {});
          return;
        }
        try {
          const result =
            request.isNavigationRequest() && request.url() === initial.url
              ? initial
              : await fetcher(request.url(), {
                  signal,
                  maxBytes: 2_000_000,
                  beforeRequest: request.isNavigationRequest() ? async () => {} : undefined,
                });
          bytes += result.body.length;
          if (bytes > 8_000_000 || result.status !== 200 || result.url !== request.url()) {
            // Do not change browser origins by fulfilling redirect responses under the old URL.
            await route.abort();
            return;
          }
          await route.fulfill({ status: 200, contentType: result.contentType, body: result.body });
        } catch {
          await route.abort().catch(() => {});
        }
      });
      const page = await context.newPage();
      context.on('page', (popup) => {
        if (popup !== page) void popup.close().catch(() => {});
      });
      await page.goto(initial.url, { waitUntil: 'domcontentloaded', timeout: 12000 });
      // Hydration often follows DOMContentLoaded. Poll only for a short bounded period.
      for (let attempt = 0; attempt < 12; attempt++) {
        signal.throwIfAborted();
        const result = parseJobPosting(await page.content(), page.url());
        if (result) return { ...result, method: 'rendered' };
        await page.waitForTimeout(400);
      }
      return null;
    } finally {
      signal.removeEventListener('abort', abort);
    }
  } finally {
    await browser?.close().catch(() => {});
    rendering = false;
  }
};
