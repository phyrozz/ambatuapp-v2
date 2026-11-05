// Isolated API fixtures: no live account or remote API writes.
import { chromium, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const base = process.env.SCROLL_TEST_BASE ?? 'http://localhost:3107';
const media = readFileSync(new URL('../../.tmp/scroll-watch-fixture.mp4', import.meta.url));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
const requests = [], errors = [];
let holdNext = false, releaseHeld;
page.on('pageerror', error => errors.push(error.message));
const clip = id => ({ id, title: id, description: '', uploader: 'Fixture creator', uploaderId: 'creator', uploaderAvatarUrl: null,
  videoUrl: 'https://fixture.invalid/clip.mp4', thumbnailUrl: '', upvotes: 0, downvotes: 0, commentCount: 0, userVote: 0 });
await page.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url());
  if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, OPTIONS' } });
  if (url.hostname === 'fixture.invalid') return route.fulfill({ contentType: 'video/mp4', body: media });
  if (url.pathname.endsWith('/profile/initialize')) return route.fulfill({ json: { username: 'Tester' } });
  if (url.pathname.endsWith('/friends/summary')) return route.fulfill({ json: { incomingCount: 0 } });
  if (url.pathname.endsWith('/scroll')) {
    const cursor = url.searchParams.get('cursor'), seed = url.searchParams.get('seed');
    const number = requests.length + 1;
    const ids = Array.from({ length: cursor ? 1 : 8 }, (_, i) => `batch-${number}-clip-${i}`);
    requests.push({ cursor, seed, exclude: url.searchParams.get('exclude')?.split(',') ?? [], ids });
    if (holdNext) {
      holdNext = false;
      await new Promise(resolve => { releaseHeld = resolve; });
    }
    return route.fulfill({ json: { videos: ids.map(clip), nextCursor: cursor ? null : `queue-${number}` } }).catch(() => {});
  }
  if (/\/scroll\/[^/]+\/watch$/.test(url.pathname)) return route.fulfill({ json: { ok: true } });
  if (url.origin === base) return route.continue();
  return route.fulfill({ json: {} });
});
await context.addInitScript(() => {
  const payload = btoa(JSON.stringify({ sub: 'refresh-fixture-user', email: 'fixture@example.invalid', name: 'Tester' }));
  localStorage.setItem('ambatuapp-cognito-session', JSON.stringify({ idToken: `test.${payload}.test`, accessToken: 'fixture', refreshToken: 'fixture', expiresAt: Date.now() + 3600000 }));
});
const ids = () => page.locator('.scroll-clip').evaluateAll(items => items.map(item => item.getAttribute('aria-label')));
const waitForBatch = async index => {
  await expect.poll(ids).toEqual(requests[index].ids);
  assert.equal(await page.locator('.scroll-feed').evaluate(feed => feed.scrollTop), 0);
};
try {
  await page.goto(`${base}/scroll/`);
  await expect(page.locator('.scroll-clip')).toHaveCount(8);
  assert.equal(requests.length, 1);
  // Refresh at a nonzero scroll position and preserve the sound setting.
  await page.locator('.scroll-clip').first().getByRole('button', { name: 'Mute sound', exact: true }).click();
  await page.locator('.scroll-feed').evaluate(feed => feed.scrollTo(0, feed.clientHeight * 2));
  await page.getByRole('button', { name: 'Refresh Ambatuscroll', exact: true }).click();
  await expect.poll(() => requests.length).toBe(2);
  await waitForBatch(1);
  assert(requests[1].seed);
  assert.equal(requests[1].cursor, null);
  assert.deepEqual(requests[1].exclude, requests[0].ids);
  await expect(page.locator('.scroll-clip').first().getByRole('button', { name: 'Turn sound on', exact: true })).toBeVisible();
  // Repeated taps cancel the older refresh and cannot append its late response.
  holdNext = true;
  await page.locator('.mobile-nav a[href="/scroll/"]').click();
  await expect.poll(() => requests.length).toBe(3);
  await page.locator('.mobile-nav a[href="/scroll/"]').click();
  await expect.poll(() => requests.length).toBe(4);
  releaseHeld();
  await waitForBatch(3);
  assert.notEqual(requests[2].seed, requests[3].seed);
  assert.deepEqual(requests[3].exclude, [...requests[0].ids, ...requests[1].ids]);
  // Desktop navigation and keyboard activation use the same refresh behavior.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('.sidebar a[href="/scroll/"]').click();
  await expect.poll(() => requests.length).toBe(5);
  await waitForBatch(4);
  const title = page.getByRole('button', { name: 'Refresh Ambatuscroll', exact: true });
  await title.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => requests.length).toBe(6);
  await waitForBatch(5);
  // Infinite scrolling resumes using the new session's cursor.
  await page.locator('.scroll-feed').evaluate(feed => feed.scrollTo(0, feed.scrollHeight));
  await expect(page.locator('.scroll-clip')).toHaveCount(9);
  assert.equal(requests[6].cursor, 'queue-6');
  assert.equal(requests[6].seed, null);
  assert.equal(new Set(await ids()).size, 9);
  // A modifier-click keeps ordinary open-in-new-tab behavior.
  const before = requests.length;
  const prevented = await page.locator('.sidebar a[href="/scroll/"]').evaluate(link => !link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true, button: 0 })));
  assert.equal(prevented, false);
  assert.equal(requests.length, before);
  await page.setViewportSize({ width: 320, height: 760 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
    document.documentElement.style.colorScheme = 'dark';
  });
  assert.equal(await title.evaluate(button => getComputedStyle(button).transitionDuration), '0s');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: '../.tmp/scroll-refresh-mobile.png' });
  assert.deepEqual(errors, []);
  console.log('PASS: title, mobile and desktop refresh; new seed/exclusions; stale-request cancellation; sound preservation; keyboard; cursor append; narrow layout');
} finally { releaseHeld?.(); await browser.close(); }
