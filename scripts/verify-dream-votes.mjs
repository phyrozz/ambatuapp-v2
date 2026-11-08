// Local browser fixture. All API/WebSocket requests are intercepted; nothing is sent to real users.
import { chromium, expect as baseExpect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base = process.env.DREAM_UI_BASE ?? 'http://localhost:3001';
const en = JSON.parse(await fs.readFile('src/messages/en.json', 'utf8'));
const id = 'c74a7d49-ed8c-4666-819d-91def00b08d1';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const expect = baseExpect.configure({ timeout: 30000 });
try {
  for (const member of [true, false]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await context.addInitScript(({ member }) => {
      localStorage.setItem('ambatuapp-locale', 'en');
      if (member) {
        const payload = btoa(JSON.stringify({ sub: 'alice', email: 'alice@example.invalid', name: 'Alice' }));
        localStorage.setItem('ambatuapp-cognito-session', JSON.stringify({ idToken: `fixture.${payload}.fixture`, accessToken: 'fixture', refreshToken: 'fixture', expiresAt: Date.now() + 3600000 }));
        sessionStorage.setItem('ambatuapp-push-prompt-dismissed:alice', '1');
      }
    }, { member });
    const page = await context.newPage();
    const errors = [], sent = [], voteCalls = [], receipts = new Map();
    let state = { up: 0, down: 0, viewerVote: 0 }, failNext = false, forbidden = false, holdNext = false, releaseVote;
    let dreamReads = 0;
    const dream = { id, authorId: member ? 'alice' : 'other', authorName: 'Alice', text: 'Private fixture caption', audience: member ? 'only_me' : 'public', publication: 'published', revision: 1, attachments: [], createdAt: '2026-11-08T00:00:00Z', updatedAt: '2026-11-08T00:00:00Z', publishedAt: '2026-11-08T00:00:00Z' };
    page.on('pageerror', error => errors.push(error.message));
    await context.routeWebSocket('**', socket => {
      if (new URL(socket.url()).pathname.startsWith('/_next/')) { socket.connectToServer(); return; }
      socket.onMessage(raw => {
        const message = JSON.parse(String(raw));
        let data = {};
        if (message.action === 'conversations') data = { conversations: [{ id: 'fixture-group', group: true, title: 'Fixture group', members: ['alice', 'bob', 'stranger'], names: {}, updatedAt: 1 }], nextCursor: null };
        if (message.action === 'createConversation') data = { conversation: 'fixture-direct' };
        if (message.action === 'send') { sent.push(message); data = { message: { id: 'fixture-message' } }; }
        if (message.action === 'history') data = { messages: [{ id: 'shared-dream', conversationId: 'fixture-group', senderId: 'bob', kind: 'text', text: `${base}/ambatupost/?dream=${id}`, createdAt: Date.now() }], nextCursor: null };
        socket.send(JSON.stringify({ event: 'response', requestId: message.requestId, data }));
      });
    });
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url()), path = url.pathname;
      if (path.endsWith('/profile/initialize')) return route.fulfill({ json: { username: 'Alice' } });
      if (path.endsWith('/friends/summary')) return route.fulfill({ json: { incomingCount: 0 } });
      if (path.endsWith('/friends')) return route.fulfill({ json: { friends: [{ id: 'bob', username: 'Bob', avatarUrl: null, state: 'accepted' }], nextCursor: null } });
      if (path.includes('/api/public/ambatupost')) {
        if (path.endsWith('/config')) return route.fulfill({ json: { attachmentsEnabled: true } });
        if (path.endsWith('/mine')) return route.fulfill({ json: { dreams: [], nextCursor: null } });
        if (path.endsWith('/vote')) {
          assert(member);
          const body = request.postDataJSON(), key = request.headers()['idempotency-key'];
          voteCalls.push({ body, key }); assert(key); assert(request.headers().authorization);
          if (forbidden) return route.fulfill({ status: 404, json: { error: 'DREAM_UNAVAILABLE' } });
          if (!receipts.has(key)) {
            state = { up: body.value === 1 ? 1 : 0, down: body.value === -1 ? 1 : 0, viewerVote: body.value };
            receipts.set(key, body.value);
          } else assert.equal(receipts.get(key), body.value);
          if (failNext) { failNext = false; return route.fulfill({ status: 503, json: { error: 'DREAM_SERVICE_UNAVAILABLE' } }); }
          if (holdNext) { holdNext = false; await new Promise(resolve => { releaseVote = resolve; }); }
          return route.fulfill({ json: state });
        }
        dreamReads++;
        return route.fulfill({ json: { ...dream, votes: state } });
      }
      if (url.origin === base && !path.startsWith('/api/')) return route.continue();
      return route.fulfill({ json: {} });
    });
    await page.goto(`${base}/ambatupost/?dream=${id}`);
    const up = page.locator('.dream-vote').nth(0), down = page.locator('.dream-vote').nth(1);
    try { await expect(up).toBeVisible(); }
    catch (error) { console.log(JSON.stringify({ errors, dreamReads, member })); throw error; }
    if (member) {
      holdNext = true;
      await up.click();
      await expect.poll(() => Boolean(releaseVote)).toBe(true);
      await expect(up).toHaveAttribute('aria-pressed', 'true');
      await expect(up.locator('strong')).toHaveText('1');
      await expect(up).toBeEnabled();
      await expect(page.locator('.dream-engagement .loading-indicator')).toHaveCount(0);
      await down.click();
      await expect(down).toHaveAttribute('aria-pressed', 'true');
      await expect(up.locator('strong')).toHaveText('0');
      await expect(down.locator('strong')).toHaveText('1');
      assert.equal(voteCalls.length, 1, 'rapid changes wait for the in-flight request');
      releaseVote();
      await expect.poll(() => voteCalls.length).toBe(2);
      await expect(down).toHaveAttribute('aria-pressed', 'true');
      await down.click();
      await expect(down).toHaveAttribute('aria-pressed', 'false');
      await expect.poll(() => voteCalls.length).toBe(3);
      await up.click(); await expect(up).toHaveAttribute('aria-pressed', 'true');
      await up.click(); await expect(up).toHaveAttribute('aria-pressed', 'false');
      await down.click(); await expect(down).toHaveAttribute('aria-pressed', 'true');
      await up.click(); await expect(up).toHaveAttribute('aria-pressed', 'true');
      failNext = true;
      await down.click();
      await expect(page.locator('.dream-notice[role=alert]')).toContainText(en['post.error']);
      await expect(down).toHaveAttribute('aria-pressed', 'true');
      await expect(up).toBeEnabled();
      const failed = voteCalls.at(-1);
      await page.getByRole('button', { name: en['common.retry'], exact: true }).click();
      await expect(down).toHaveAttribute('aria-pressed', 'true');
      assert.deepEqual(voteCalls.at(-1), failed, 'retry keeps the same intent and request key');
      failNext = true;
      await up.click();
      await expect(page.locator('.dream-notice[role=alert]')).toContainText(en['post.error']);
      const uncertain = voteCalls.at(-1), beforeChange = voteCalls.length;
      await down.click();
      await expect(down).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(() => voteCalls.length).toBe(beforeChange + 2);
      assert.deepEqual(voteCalls[beforeChange], uncertain, 'changing a vote first resolves the uncertain request with its original key');
      assert.equal(voteCalls.at(-1).body.value, -1, 'the latest selection is then saved');
      await expect(page.locator('.dream-notice[role=alert]')).toHaveCount(0);
      await page.screenshot({ path: '../.tmp/dream-votes-desktop.png', fullPage: true });
      await page.setViewportSize({ width: 320, height: 850 });
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      await page.screenshot({ path: '../.tmp/dream-votes-phone-dark.png', fullPage: true });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    } else {
      await up.click();
      await expect(page.getByRole('dialog')).toContainText(en['post.voteSignIn']);
      assert.equal(voteCalls.length, 0);
      await page.keyboard.press('Escape');
    }
    await page.locator('.dream-share').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(en['post.shareHint']);
    await expect(dialog).not.toContainText(dream.text);
    assert.equal(sent.length, 0, 'opening the picker never sends a message');
    await expect(dialog.locator('input[readonly]')).toHaveValue(new RegExp(`dream=${id}`));
    if (member) {
      await dialog.getByRole('button', { name: 'Bob', exact: true }).click();
      await dialog.getByRole('button', { name: 'Fixture group', exact: true }).click();
      assert.equal(sent.length, 0, 'selecting recipients never sends a message');
      await dialog.getByRole('button', { name: en['friends.send'], exact: true }).click();
      await expect.poll(() => sent.length).toBe(2);
      assert.deepEqual(new Set(sent.map(item => item.conversation)), new Set(['fixture-direct', 'fixture-group']));
      for (const message of sent) { assert(!message.text.includes(dream.text)); assert.equal(new URL(message.text).searchParams.get('dream'), id); }
      await page.keyboard.press('Escape');
      const chatPage = await context.newPage();
      await chatPage.goto(`${base}/chat/?conversation=fixture-group`);
      await expect(chatPage.locator('.chat-shared-dream')).toBeVisible();
      await expect(chatPage.locator('.chat-shared-dream')).toContainText(en['post.sharedDream']);
      await expect(chatPage.locator('.chat-shared-dream')).not.toContainText(dream.text);
      await chatPage.close();
      forbidden = true;
      await up.click();
      await expect(page.locator('.dream-detail')).toHaveCount(0);
      await expect(page.locator('.dream-notice[role=alert]')).toContainText(en['post.unavailable']);
    } else {
      await expect(dialog).toContainText(en['post.shareSignIn']);
      assert.equal(sent.length, 0);
    }
    assert.equal(dreamReads, 1, 'sharing must not fetch private preview content');
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('Passed vote toggle/switch/retry, guest gates, revocation, responsive layout, explicit friend/group link sends and private-preview exclusion.');
} finally { await browser.close(); }
