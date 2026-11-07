// Isolated browser/API/WebSocket fixtures; never uses real accounts or services.
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base = process.env.BLOCKS_UI_BASE ?? 'http://localhost:3118';
const en = JSON.parse(await fs.readFile('src/messages/en.json', 'utf8'));
const env = await fs.readFile('.env.local', 'utf8');
const wsUrl = env.match(/^NEXT_PUBLIC_CHAT_WS_URL=(.*)$/m)?.[1].trim().replace(/^['"]|['"]$/g, '');
assert(wsUrl, 'Chat URL must be configured for the intercepted fixture');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    if (!['localhost','127.0.0.1'].includes(location.hostname)) return;
    const payload = btoa(JSON.stringify({ sub: 'test-user', email: 'test@example.invalid', name: 'Tester' }));
    localStorage.setItem('ambatuapp-cognito-session', JSON.stringify({ idToken: `fixture.${payload}.fixture`, accessToken: 'fixture', refreshToken: 'fixture', expiresAt: Date.now()+3600000 }));
    localStorage.setItem('ambatuapp-locale', 'en');
    sessionStorage.setItem('ambatuapp-push-prompt-dismissed:test-user', '1');
  });
  const blocked = new Set(), actions = [], reads = [], errors = [];
  const conversation = { id: 'group-fixture', group: true, title: 'Fixture group', members: ['test-user','bob'], names: { 'test-user': 'Tester' }, blockedIds: ['bob'], updatedAt: Date.now(), unreadCount: 0 };
  await context.routeWebSocket(wsUrl, ws => ws.onMessage(raw => {
    const body = JSON.parse(raw);
    let data = {};
    if (body.action === 'authenticate') data = { userId: 'test-user' };
    if (body.action === 'conversations') data = { conversations: [conversation], nextCursor: null, activeConversation: conversation };
    if (body.action === 'history') data = { messages: [{ id: 'message-1', conversationId: conversation.id, senderId: 'bob', senderBlocked: true, kind: 'text', text: 'Fixture message', createdAt: Date.now(), messageKey: 'MSG#1700000000000#aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }], nextCursor: null };
    ws.send(JSON.stringify({ event: 'response', requestId: body.requestId, data }));
  }));
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), pathname = url.pathname;
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization,content-type', 'access-control-allow-methods': 'GET,POST,PUT,DELETE' } });
    if (pathname.endsWith('/profile/initialize')) return route.fulfill({ json: { username: 'Tester' } });
    if (pathname.endsWith('/friends/summary')) return route.fulfill({ json: { incomingCount: 0 } });
    if (pathname.endsWith('/players/names')) return route.fulfill({ json: { names: { 'test-user': 'Tester' }, avatars: {}, blocked: ['bob'] } });
    if (/\/blocks\/[^/]+$/.test(pathname)) {
      const id = pathname.split('/').at(-1);
      actions.push({ method: request.method(), id });
      if (request.method() === 'PUT') blocked.add(id); else blocked.delete(id);
      return route.fulfill({ json: { blocked: blocked.has(id) } });
    }
    if (pathname.endsWith('/blocks')) {
      reads.push(url.searchParams.get('cursor'));
      const people = [...blocked].map(id => ({ id, username: id === 'bob' ? 'Bob' : id }));
      const offset = url.searchParams.has('cursor') ? 20 : 0;
      return route.fulfill({ json: { items: people.slice(offset,offset+20), nextCursor: offset === 0 && people.length > 20 ? 'fixture-next' : null } });
    }
    if (pathname.endsWith('/friends')) return route.fulfill({ json: { friends: blocked.has('bob') ? [] : [{ id: 'bob', username: 'Bob', avatarUrl: null, state: 'accepted', pinned: false }], nextCursor: null } });
    if (url.origin === base) return route.continue();
    return route.fulfill({ json: {} });
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/friends/`);
  await expect(page.getByText('Bob', { exact: true })).toBeVisible();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.getByRole('button', { name: en['blocks.block'], exact: true }).click();
  const confirm = page.getByRole('dialog', { name: en['blocks.confirmTitle'] });
  await expect(confirm).toBeVisible();
  await page.screenshot({ path: '../.tmp/player-block-confirm-mobile.png' });
  await confirm.getByRole('button', { name: en['blocks.block'], exact: true }).click();
  await expect(confirm).toBeHidden();
  assert(actions.some(action => action.method === 'PUT' && action.id === 'bob'));
  for (let i=0;i<21;i++) blocked.add(`fixture-${i}`);
  await page.getByRole('button', { name: en['blocks.manage'], exact: true }).click();
  const dialog = page.getByRole('dialog', { name: en['blocks.manage'] });
  await expect(dialog.getByText(en['blocks.unblockHint'])).toBeVisible();
  await dialog.locator('.blocked-player-list').evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect.poll(() => reads.includes('fixture-next')).toBe(true);
  await dialog.locator('article').filter({ hasText: 'Bob' }).getByRole('button', { name: en['blocks.unblock'], exact: true }).click();
  await expect.poll(() => actions.some(action => action.method === 'DELETE' && action.id === 'bob')).toBe(true);
  await page.keyboard.press('Escape');
  await page.goto(`${base}/chat/?conversation=${conversation.id}`);
  const message = page.locator('.chat-bubble').filter({ hasText: 'Fixture message' });
  await expect(message.getByText(en['blocks.blockedThug'], { exact: true })).toBeVisible();
  await expect(message.locator('.chat-message-avatar')).toHaveText('');
  await expect(message.locator('small img')).toHaveCount(0);
  await page.getByRole('button', { name: en['chat.moreActions'], exact: true }).click();
  await page.locator('#chat-actions-menu').getByRole('button', { name: en['chat.actionMembers'], exact: true }).click();
  const members = page.getByRole('dialog', { name: en['chat.manageMembers'] });
  const bob = members.locator('.chat-member-row').filter({ hasText: en['blocks.blockedThug'] });
  await expect(bob.locator('.chat-avatar')).toHaveText('');
  await expect(bob.locator('img')).toHaveCount(0);
  await members.getByRole('button', { name: en['friends.addToGroup'], exact: true }).click();
  const picker = page.getByRole('dialog', { name: en['friends.addToGroup'], exact: true });
  await expect(picker).toBeVisible();
  await page.keyboard.press('Tab');
  assert(await picker.evaluate(element => element.contains(document.activeElement)));
  await page.keyboard.press('Escape');
  await expect(picker).toBeHidden();
  await expect(members).toBeVisible();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: '../.tmp/player-blocks-mobile.png' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: '../.tmp/player-blocks-desktop.png' });
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  await page.screenshot({ path: '../.tmp/player-blocks-dark.png' });
  assert.deepEqual(errors, []);
  console.log('Passed block confirmation, unblock, infinite scrolling, group identity/avatar and mobile layout fixtures.');
} finally { await browser.close(); }
