// Uses intercepted API/media fixtures only; never sends requests to a live account.
// Generate .tmp/scroll-watch-fixture.mp4 as a finite-duration 12-second MP4 first.
import { chromium, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const base = process.env.SCROLL_TEST_BASE ?? 'http://localhost:3107';
const media = readFileSync(new URL('../../.tmp/scroll-watch-fixture.mp4', import.meta.url));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
const watches = [], cursors = [], errors = [];
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
    assert.match(request.headers().authorization, /^Bearer /);
    const cursor = url.searchParams.get('cursor');
    cursors.push(cursor);
    return route.fulfill({ json: cursor ? { videos: [clip('clip-3')], nextCursor: null } : { videos: [clip('clip-1'), clip('clip-2')], nextCursor: 'ranked-queue' } });
  }
  if (/\/scroll\/[^/]+\/watch$/.test(url.pathname)) {
    assert.match(request.headers().authorization, /^Bearer /);
    const account = JSON.parse(Buffer.from(request.headers().authorization.split('.')[1], 'base64').toString()).sub;
    watches.push({ account, id: url.pathname.split('/').at(-2), ...request.postDataJSON() });
    return route.fulfill({ json: { ok: true } });
  }
  if (/\/scroll\/[^/]+\/comments$/.test(url.pathname)) return route.fulfill({ json: { comments: [], nextCursor: null } });
  if (url.origin === base) return route.continue();
  return route.fulfill({ json: {} });
});
await context.addInitScript(() => {
  const payload = btoa(JSON.stringify({ sub: 'scroll-fixture-user', email: 'fixture@example.invalid', name: 'Tester' }));
  localStorage.setItem('ambatuapp-cognito-session', JSON.stringify({ idToken: `test.${payload}.test`, accessToken: 'fixture', refreshToken: 'fixture', expiresAt: Date.now() + 3600000 }));
});
try {
  await page.goto(`${base}/scroll/`);
  const first = page.locator('.scroll-clip').first();
  await first.waitFor();
  await expect.poll(() => first.locator('video').evaluate(video => video.readyState), { timeout: 15000 }).toBeGreaterThanOrEqual(3);
  await first.locator('video').evaluate(video => { video.muted = true; return video.play(); });
  await expect.poll(() => watches.some(item => item.id === 'clip-1' && item.watchedMs >= 2000), { timeout: 15000 }).toBe(true);
  assert(watches.every(item => item.id === 'clip-1'));
  assert(watches.every(item => item.durationMs === 12000));
  await first.getByRole('button', { name: /^Comments/ }).click();
  await page.getByRole('dialog').waitFor();
  assert.equal(await first.locator('video').evaluate(video => video.paused), true);
  await page.waitForTimeout(500);
  const pausedCount = watches.length;
  await page.waitForTimeout(2200);
  assert.equal(watches.length, pausedCount);
  await page.keyboard.press('Escape');
  await page.locator('.scroll-feed').evaluate(feed => feed.scrollTo(0, feed.clientHeight));
  await expect.poll(() => watches.some(item => item.id === 'clip-2'), { timeout: 15000 }).toBe(true);
  await page.locator('.scroll-feed').evaluate(feed => feed.scrollTo(0, feed.scrollHeight));
  await expect(page.locator('.scroll-clip')).toHaveCount(3);
  assert.deepEqual(cursors, [null, 'ranked-queue']);
  assert.equal(new Set(await page.locator('.scroll-clip').evaluateAll(items => items.map(item => item.getAttribute('aria-label')))).size, 3);
  await expect.poll(() => watches.some(item => item.id === 'clip-3'), { timeout: 15000 }).toBe(true);
  // Simulate another tab replacing the stored account before this tab's auth UI updates.
  await page.evaluate(() => {
    const current = JSON.parse(localStorage.getItem('ambatuapp-cognito-session'));
    const payload = btoa(JSON.stringify({ sub: 'different-account', email: 'other@example.invalid', name: 'Other' }));
    localStorage.setItem('ambatuapp-cognito-session', JSON.stringify({ ...current, idToken: `test.${payload}.test` }));
    document.querySelector('.scroll-clip:last-of-type video')?.pause();
  });
  await page.waitForTimeout(500);
  const priorAccountWatches = watches.length;
  await page.waitForTimeout(2200);
  assert.equal(watches.length, priorAccountWatches);
  assert(watches.every(item => item.account === 'scroll-fixture-user'));
  assert.deepEqual(errors, []);
  console.log('PASS: authenticated playback signals, offscreen exclusion, dialog pause, cursor append, account-switch isolation, no duplicates or browser errors');
} finally { await browser.close(); }
