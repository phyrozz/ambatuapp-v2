import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
let requests = 0;
let state = 'incoming';
let clipVote = 0;
let commentVote = 0;
let comments = [{ id: 'first-comment', text: 'A great clip', author: 'Dreamer', authorId: 'friend-one', parentId: null, avatarUrl: null, createdAt: new Date().toISOString(), upvotes: 0, downvotes: 0, userVote: 0 }];
let media;
await page.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.hostname === 'fixtures.invalid' && media) return route.fulfill({ contentType: 'video/webm', body: media });
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, OPTIONS' } });
  if (url.pathname.endsWith('/profile/initialize')) return route.fulfill({ json: { username: 'Tester' } });
  if (url.pathname.endsWith('/friends/search')) return route.fulfill({ json: { friends: [{ id: 'new-player', username: 'NewPlayer', avatarUrl: null, state: null }], nextCursor: null } });
  if (url.pathname.endsWith('/friends/summary')) return route.fulfill({ json: { incomingCount: state === 'incoming' ? 1 : 0 } });
  if (url.pathname.endsWith('/friends')) {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      state = body.action === 'accept' ? 'accepted' : body.action === 'remove' ? null : 'outgoing';
      return route.fulfill({ json: { state } });
    }
    return route.fulfill({ json: { friends: [{ id: 'friend-one', username: 'Dreamer', avatarUrl: null, state }], nextCursor: null } });
  }
  if (url.pathname.endsWith('/scroll')) {
    assert.match(route.request().headers().authorization, /^Bearer /);
    requests++;
    return route.fulfill({ json: { videos: [{ id: `clip-${requests}`, title: `Clip ${requests}`, description: 'Fixture clip', uploader: 'Uploader', uploaderId: 'clip-uploader', uploaderAvatarUrl: null, videoUrl: 'https://fixtures.invalid/clip.mp4', thumbnailUrl: '', upvotes: 0, downvotes: 0, commentCount: comments.length, userVote: 0 }], nextCursor: requests < 3 ? `cursor-${requests}` : null } });
  }
  if (/\/scroll\/[^/]+\/vote$/.test(url.pathname)) {
    assert.match(route.request().headers().authorization, /^Bearer /);
    clipVote = clipVote === route.request().postDataJSON().value ? 0 : route.request().postDataJSON().value;
    return route.fulfill({ json: { value: clipVote, upvotes: clipVote === 1 ? 1 : 0, downvotes: clipVote === -1 ? 1 : 0 } });
  }
  if (/\/scroll\/[^/]+\/comments\/[^/]+\/vote$/.test(url.pathname)) {
    commentVote = commentVote === route.request().postDataJSON().value ? 0 : route.request().postDataJSON().value;
    return route.fulfill({ json: { value: commentVote, upvotes: commentVote === 1 ? 1 : 0, downvotes: commentVote === -1 ? 1 : 0 } });
  }
  if (/\/scroll\/[^/]+\/comments$/.test(url.pathname)) {
    assert.match(route.request().headers().authorization, /^Bearer /);
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      const comment = { id: `new-${comments.length}`, text: body.text, author: 'Tester', authorId: 'test-user', parentId: body.parentId ?? null, avatarUrl: null, createdAt: new Date().toISOString(), upvotes: 0, downvotes: 0, userVote: 0 };
      comments = [comment, ...comments];
      return route.fulfill({ status: 201, json: comment });
    }
    return route.fulfill({ json: { comments, nextCursor: null } });
  }
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return route.continue();
  return route.fulfill({ json: {} });
});
try {
  await page.goto('http://localhost:3001/explore/');
  await page.getByRole('heading', { name: 'All of ambatuapp' }).waitFor();
  assert.equal(await page.locator('.mobile-nav a').count(), 5);
  assert.equal(await page.locator('.mobile-nav a').nth(2).getAttribute('href'), '/scroll/');
  assert.equal(await page.locator('.explore-page nav a').count(), 11);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.waitForTimeout(500);
  await page.screenshot({ path: '../.tmp/explore-mobile.png', fullPage: true });
  await page.goto('http://localhost:3001/scroll/');
  await page.getByText('Sign in with your registered account to join in.').waitFor();
  assert.equal(requests, 0);
  media = Buffer.from(await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 426;
    const drawing = canvas.getContext('2d');
    const stream = canvas.captureStream(12);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks = [];
    recorder.ondataavailable = event => chunks.push(event.data);
    const result = new Promise(resolve => { recorder.onstop = async () => resolve(Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()))); });
    recorder.start();
    const timer = setInterval(() => { drawing.fillStyle = '#b93d21'; drawing.fillRect(0, 0, 240, 426); }, 80);
    await new Promise(resolve => setTimeout(resolve, 500));
    clearInterval(timer); recorder.stop(); stream.getTracks().forEach(track => track.stop());
    return result;
  }));
  await page.evaluate(() => {
    const payload = btoa(JSON.stringify({ sub: 'test-user', email: 'test@example.invalid', name: 'Tester' }));
    localStorage.setItem('ambatuapp-cognito-session', JSON.stringify({ idToken: `test.${payload}.test`, accessToken: 'fixture', refreshToken: 'fixture', expiresAt: Date.now() + 3600000 }));
  });
  await page.goto('http://localhost:3001/friends/');
  await page.locator('.friends-request-badge').waitFor();
  assert.equal(await page.locator('.friends-request-badge').innerText(), '1');
  assert.equal(await page.locator('.mobile-nav .mobile-friend-count').count(), 1);
  await page.locator('.friends-tabs').getByRole('button', { name: /Requests/ }).click();
  await page.getByRole('button', { name: 'Accept', exact: true }).click();
  await page.locator('.friends-tabs').getByRole('button', { name: 'Friends', exact: true }).click();
  await page.getByRole('link', { name: 'Start chat', exact: true }).waitFor();
  assert.match(await page.getByRole('link', { name: 'Start chat', exact: true }).getAttribute('href'), /user=friend-one/);
  await page.getByRole('button', { name: 'Remove friend' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove friend', exact: true }).click();
  await page.getByText('Your circle starts here.', { exact: true }).waitFor();
  await page.locator('.friends-tabs').getByRole('button', { name: 'Find people', exact: true }).click();
  await page.getByRole('searchbox').fill('New');
  await page.getByRole('button', { name: 'Add friend', exact: true }).click();
  await page.getByText('Request sent', { exact: true }).waitFor();
  await page.screenshot({ path: '../.tmp/friends-mobile.png', fullPage: true });
  await page.goto('http://localhost:3001/chat/');
  await page.locator('.chat-inbox-brand').waitFor();
  await page.locator('.chat-friends-link').waitFor();
  await page.getByRole('button', { name: 'Not now' }).click().catch(() => {});
  await page.waitForTimeout(400);
  await page.screenshot({ path: '../.tmp/chat-mobile.png' });
  await page.goto('http://localhost:3001/scroll/');
  await page.locator('.scroll-clip').first().waitFor();
  assert.equal(await page.locator('.scroll-clip video').first().getAttribute('controls'), null);
  assert.equal(await page.locator('.scroll-clip-index').count(), 0);
  assert.equal(await page.locator('.scroll-feed').evaluate(element => getComputedStyle(element).scrollbarWidth), 'none');
  await page.locator('.scroll-clip').first().dblclick({ position: { x: 120, y: 200 } });
  await page.locator('.scroll-clip').first().getByRole('button', { name: /Upvote: 1/ }).waitFor();
  await page.locator('.scroll-clip').first().getByRole('button', { name: /Downvote/ }).click();
  assert.equal(clipVote, -1);
  const firstClip = await page.locator('.scroll-clip').first().boundingBox();
  await page.touchscreen.tap(firstClip.x + firstClip.width / 2, firstClip.y + firstClip.height / 2);
  await page.touchscreen.tap(firstClip.x + firstClip.width / 2, firstClip.y + firstClip.height / 2);
  await page.waitForFunction(() => document.querySelector('.scroll-clip .scroll-action[aria-pressed="true"]')?.getAttribute('aria-label')?.startsWith('Upvote'));
  assert.equal(clipVote, 1);
  await page.locator('.scroll-clip').first().getByRole('button', { name: /Comments/ }).click();
  await page.getByRole('dialog').waitFor();
  assert.equal(await page.locator('.scroll-clip').first().locator('video').evaluate(video => video.paused), true);
  await page.getByRole('dialog').getByRole('button', { name: /Upvote/ }).first().click();
  await page.getByRole('dialog').locator('.comment-vote-up.selected').first().waitFor();
  assert.equal(commentVote, 1);
  await page.getByRole('dialog').getByRole('button', { name: 'Reply' }).first().click();
  await page.getByRole('dialog').locator('.comment-reply-form textarea').fill('A reply');
  await page.getByRole('dialog').locator('.comment-send-reply').click();
  await page.getByRole('dialog').locator('.scroll-comment-compose input').fill('My comment');
  await page.getByRole('dialog').getByRole('button', { name: 'Post comment' }).click();
  await page.screenshot({ path: '../.tmp/scroll-comments-mobile.png' });
  await page.getByRole('button', { name: 'Close comments' }).click();
  await page.locator('.scroll-feed').evaluate(element => { element.scrollTop = element.scrollHeight; });
  await page.waitForFunction(() => document.querySelectorAll('.scroll-clip').length >= 2);
  await page.locator('.scroll-feed').evaluate(element => { element.scrollTop = element.scrollHeight; });
  await page.getByText('You are all caught up.', { exact: true }).waitFor();
  assert.equal(requests, 3);
  await page.waitForFunction(() => document.querySelector('.scroll-clip video')?.paused === true);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: '../.tmp/scroll-mobile.png' });
  await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
  await page.goto('http://localhost:3001/');
  await page.waitForURL('**/scroll/');
  await page.goto('http://localhost:3001/?home=1');
  await page.locator('.hero').waitFor();
  assert.equal(new URL(page.url()).pathname, '/');
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://localhost:3001/explore/');
    await page.getByRole('heading', { name: 'All of ambatuapp' }).waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await page.goto('http://localhost:3001/explore/');
  await page.getByRole('heading', { name: 'All of ambatuapp' }).waitFor();
  assert.equal(await page.locator('.explore-feature').first().evaluate(element => getComputedStyle(element).animationName), 'none');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: '../.tmp/explore-dark.png', fullPage: true });
  await page.goto('http://localhost:3001/chat/');
  await page.locator('.chat-friends-link').waitFor();
  assert.equal(await page.locator('.chat-friends-link').evaluate(element => getComputedStyle(element).animationName), 'none');
  assert.deepEqual(errors, []);
  console.log('Passed: five-item navigation, hub links, auth gate, friend acceptance/removal/request/chat link, cursor scrolling, PWA home and Discover override; no browser errors.');
} catch (error) { await page.screenshot({ path: '../.tmp/social-failure.png', fullPage: true }); console.log(await page.locator('main').innerText()); throw error; }
finally { await browser.close(); }
