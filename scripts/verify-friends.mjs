// Isolated browser and WebSocket fixtures: this script never contacts the live chat service.
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
const base = process.env.FRIENDS_UI_BASE ?? 'http://localhost:3001';
const env = await fs.readFile('.env.local', 'utf8');
const messages = JSON.parse(await fs.readFile('src/messages/en.json', 'utf8'));
const wsUrl = env
  .match(/^NEXT_PUBLIC_CHAT_WS_URL=(.*)$/m)?.[1]
  .trim()
  .replace(/^['"]|['"]$/g, '');
assert(wsUrl, 'A configured chat WebSocket URL is required for the fixture');
const friends = [
  { id: 'friend-a', username: 'Dreamer', avatarUrl: null, state: 'accepted', pinned: false },
  { id: 'friend-b', username: 'Reimu', avatarUrl: null, state: 'accepted', pinned: false },
  ...Array.from({ length: 30 }, (_, index) => ({
    id: `friend-${index}`,
    username: `Friend${String(index).padStart(2, '0')}`,
    avatarUrl: null,
    state: 'accepted',
    pinned: false,
  })),
  { id: 'request-a', username: 'NewDreamer', avatarUrl: null, state: 'incoming', pinned: false },
  { id: 'sent-a', username: 'OtherDreamer', avatarUrl: null, state: 'outgoing', pinned: false },
  { id: 'stranger', username: 'NewPlayer', avatarUrl: null, state: null, pinned: false },
];
const errors = [],
  reads = [],
  created = [],
  sent = [],
  conversations = [];
let failRecipient = '';
let failList = false;
page.on('pageerror', (error) => errors.push(error.message));
await context.routeWebSocket(wsUrl, (ws) => {
  ws.onMessage((raw) => {
    const body = JSON.parse(String(raw));
    let data = {},
      error;
    if (body.action === 'conversations')
      data = {
        conversations,
        nextCursor: null,
        ...(body.activeConversation
          ? {
              activeConversation:
                conversations.find((item) => item.id === body.activeConversation) ?? null,
            }
          : {}),
      };
    if (body.action === 'createConversation') {
      const id = body.group ? `group-${created.length}` : `dm-${body.members[0]}`;
      created.push(body);
      if (!conversations.some((item) => item.id === id))
        conversations.push({
          id,
          group: !!body.group,
          title: body.title ?? '',
          members: ['test-user', ...body.members],
          names: body.names,
          updatedAt: Date.now(),
          unreadCount: 0,
        });
      data = { conversation: id };
    }
    if (body.action === 'history') data = { messages: [], nextCursor: null };
    if (body.action === 'send') {
      if (body.conversation === `dm-${failRecipient}`) {
        error = 'fixture-failure';
        failRecipient = '';
      } else {
        sent.push(body);
        data = {
          message: {
            id: `message-${sent.length}`,
            conversationId: body.conversation,
            senderId: 'test-user',
            kind: 'text',
            text: body.text,
            createdAt: Date.now(),
            messageKey: `key-${sent.length}`,
          },
        };
      }
    }
    ws.send(
      JSON.stringify({
        event: 'response',
        requestId: body.requestId,
        data,
        ...(error ? { error } : {}),
      }),
    );
  });
});
await page.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  const path = url.pathname;
  if (route.request().method() === 'OPTIONS')
    return route.fulfill({
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': 'authorization,content-type',
        'access-control-allow-methods': 'GET,POST,OPTIONS',
      },
    });
  if (path.endsWith('/profile/initialize')) return route.fulfill({ json: { username: 'Tester' } });
  if (path.endsWith('/players/names'))
    return route.fulfill({
      json: {
        names: Object.fromEntries(
          [{ id: 'test-user', username: 'Tester' }, ...friends].map((item) => [
            item.id,
            item.username,
          ]),
        ),
        avatars: {},
      },
    });
  if (path.endsWith('/friends/summary'))
    return route.fulfill({
      json: { incomingCount: friends.filter((item) => item.state === 'incoming').length },
    });
  if (path.endsWith('/friends/search')) {
    reads.push(url.search);
    let matches = friends.filter((item) =>
      item.username.toLowerCase().startsWith(url.searchParams.get('q').toLowerCase()),
    );
    if (url.searchParams.get('state'))
      matches = matches.filter((item) => item.state === url.searchParams.get('state'));
    if (url.searchParams.get('pinned')) matches = matches.filter((item) => item.pinned);
    if (url.searchParams.get('q') === 'Empty')
      return route.fulfill({
        json: {
          friends: url.searchParams.get('cursor') ? [friends[0]] : [],
          nextCursor: url.searchParams.get('cursor') ? null : 'empty-batch',
        },
      });
    return route.fulfill({ json: { friends: matches.slice(0, 15), nextCursor: null } });
  }
  if (/\/friends\/[\w-]+$/.test(path)) {
    const friend = friends.find((item) => item.id === path.split('/').at(-1));
    return route.fulfill({
      status: friend ? 200 : 404,
      json: friend ? { friend } : { error: 'PLAYER_NOT_FOUND' },
    });
  }
  if (path.endsWith('/friends')) {
    assert.match(route.request().headers().authorization, /^Bearer /);
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      const item = friends.find((friend) => friend.id === body.targetId);
      assert(item);
      if (body.action === 'pin' || body.action === 'unpin') {
        assert.equal(item.state, 'accepted');
        item.pinned = body.action === 'pin';
      } else
        item.state =
          body.action === 'accept' ? 'accepted' : body.action === 'request' ? 'outgoing' : null;
      return route.fulfill({ json: { state: item.state, pinned: item.pinned } });
    }
    reads.push(url.search);
    if (failList) return route.fulfill({ status: 503, json: {} });
    let items = friends.filter((item) => !!item.state);
    if (url.searchParams.get('state'))
      items = items.filter((item) => item.state === url.searchParams.get('state'));
    if (url.searchParams.get('pinned')) items = items.filter((item) => item.pinned);
    const offset = Number(url.searchParams.get('cursor') ?? 0);
    return route.fulfill({
      json: {
        friends: items.slice(offset, offset + 20),
        nextCursor: items.length > offset + 20 ? String(offset + 20) : null,
      },
    });
  }
  if (path.endsWith('/scroll'))
    return route.fulfill({
      json: {
        videos: [
          {
            id: 'clip-a',
            title: 'Dreamy clip',
            description: '',
            uploader: 'Dreamer',
            uploaderId: 'friend-a',
            uploaderAvatarUrl: null,
            videoUrl: 'https://fixture.invalid/video.mp4',
            thumbnailUrl: '',
            upvotes: 0,
            downvotes: 0,
            commentCount: 0,
            userVote: 0,
          },
        ],
        nextCursor: null,
      },
    });
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return route.continue();
  if (path.endsWith('/oauth2/authorize')) return route.abort();
  return route.fulfill({ json: {} });
});
await context.addInitScript(() => {
  if (!['localhost', '127.0.0.1'].includes(location.hostname)) return;
  if (sessionStorage.getItem('fixture-signed-out')) return;
  const payload = btoa(
    JSON.stringify({ sub: 'test-user', email: 'test@example.invalid', name: 'Tester' }),
  );
  localStorage.setItem(
    'ambatuapp-cognito-session',
    JSON.stringify({
      idToken: `fixture.${payload}.fixture`,
      accessToken: 'fixture',
      refreshToken: 'fixture',
      expiresAt: Date.now() + 3600000,
    }),
  );
  localStorage.setItem('ambatuapp-locale', 'en');
  sessionStorage.setItem('ambatuapp-push-prompt-dismissed:test-user', '1');
});
const noOverflow = async () =>
  assert(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'Viewport should not overflow',
  );
try {
  await page.goto(`${base}/friends/`);
  await page.getByRole('button', { name: 'Pin Dreamer', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Accept', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Pin Dreamer', exact: true }).click();
  await page.getByRole('button', { name: 'Unpin Dreamer', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Pinned', exact: true }).click();
  await expect(page.locator('.friend-card')).toHaveCount(1);
  await page.reload();
  await page.getByRole('button', { name: 'Unpin Dreamer', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Requests', exact: false }).click();
  await page.getByRole('button', { name: 'Accept', exact: true }).click();
  await page.getByText("You're all caught up. No new friend requests.", { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Sent', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel request', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Find people', exact: true }).click();
  await page.getByRole('searchbox').fill('NewPlayer');
  await page.getByRole('button', { name: 'Add friend', exact: true }).click();
  await page.getByText('Request sent', { exact: true }).waitFor();
  await page.goto(`${base}/friends/?user=stranger`);
  await page.locator('.friends-link-card').getByText('NewPlayer', { exact: true }).waitFor();
  await page.goto(`${base}/friends/?user=missing-player`);
  await page
    .getByText('This friend link is invalid or the person is no longer available.')
    .waitFor();
  await page.goto(`${base}/friends/`);
  await page.getByRole('button', { name: 'Share friend link', exact: true }).click();
  const linkDialog = page.getByRole('dialog');
  assert.match(await linkDialog.locator('input').inputValue(), /\/friends\/\?user=test-user$/);
  assert.equal(await linkDialog.locator('[role="img"] svg').count(), 1);
  await page.keyboard.press('Shift+Tab');
  assert(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')));
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Share friend link', exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole('button', { name: 'Share friend link', exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await noOverflow();
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(350);
  await page.screenshot({ path: '../.tmp/friends-mobile-new.png' });
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await page.getByText('Friend29', { exact: true }).waitFor();
  assert(reads.some((query) => new URLSearchParams(query).get('cursor') === '20'));
  await page.goto(`${base}/chat/?compose=group`);
  const picker = page.getByRole('dialog', { name: 'New group with friends' });
  await picker.getByText('Dreamer', { exact: true }).waitFor();
  await picker.getByRole('textbox', { name: 'Group name', exact: true }).fill('Our circle');
  await picker.getByRole('button', { name: 'Dreamer', exact: true }).click();
  await picker.getByRole('button', { name: 'Reimu', exact: true }).click();
  assert.equal(created.filter((item) => item.group).length, 0);
  await picker.getByRole('button', { name: 'Create group', exact: true }).click();
  await page.locator('.chat-thread h2').getByText('Our circle', { exact: true }).waitFor();
  const group = created.find((item) => item.group);
  assert.deepEqual(group.members, ['friend-a', 'friend-b']);
  assert.equal(group.title, 'Our circle');
  await page.goto(`${base}/games/ambatutap/`);
  await page.getByRole('button', { name: 'Invite friends to play' }).click();
  const invite = page.getByRole('dialog', { name: 'Invite friends to play' });
  await invite.getByRole('button', { name: 'Dreamer', exact: true }).click();
  await invite.getByRole('button', { name: 'Reimu', exact: true }).click();
  assert.equal(sent.length, 0);
  failRecipient = 'friend-b';
  await invite.getByRole('button', { name: 'Send', exact: true }).click();
  await invite.getByRole('alert').waitFor();
  assert.equal(sent.length, 1);
  await invite.getByRole('button', { name: 'Send', exact: true }).click();
  await page.getByRole('dialog', { name: 'Sent to 2 friends' }).waitFor();
  assert.equal(sent.length, 2, 'Retry must skip acknowledged recipients');
  assert(sent.every((message) => /\/games\/ambatutap\//.test(message.text)));
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.goto(`${base}/scroll/`);
  await page.getByRole('button', { name: 'Send to friends', exact: true }).click();
  const share = page.getByRole('dialog', { name: 'Send to friends' });
  await share.getByRole('searchbox').fill('Empty');
  await share.getByRole('button', { name: 'Dreamer', exact: true }).waitFor();
  assert(reads.some((query) => new URLSearchParams(query).get('cursor') === 'empty-batch'));
  await share.getByRole('button', { name: 'Dreamer', exact: true }).click();
  await share.getByRole('button', { name: 'Send', exact: true }).click();
  await page.getByRole('dialog', { name: 'Sent to 1 friend' }).waitFor();
  assert.match(sent.at(-1).text, /\/watch\/clip-a\//);
  assert(!/fixture.invalid/.test(sent.at(-1).text), 'Share permanent app URLs, not signed media');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}/friends/`);
    await page.getByRole('button', { name: 'Unpin Dreamer', exact: true }).waitFor();
    await noOverflow();
    await page.waitForTimeout(350);
    await page.screenshot({ path: `../.tmp/friends-${width}.png` });
    await page.getByRole('button', { name: 'Share friend link', exact: true }).click();
    await noOverflow();
    await page.waitForTimeout(350);
    await page.screenshot({ path: `../.tmp/friends-share-${width}.png` });
    await page.keyboard.press('Escape');
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
    localStorage.setItem('ambatuapp-theme', 'dark');
  });
  await page.goto(`${base}/friends/`);
  await page.getByRole('button', { name: 'Unpin Dreamer', exact: true }).waitFor();
  assert.equal(
    await page.locator('.friends-hero').evaluate((el) => getComputedStyle(el).animationName),
    'none',
  );
  await page.screenshot({ path: '../.tmp/friends-dark-new.png' });
  await page.getByRole('link', { name: 'New group with friends' }).click();
  await page.getByRole('dialog', { name: 'New group with friends' }).waitFor();
  assert.equal(
    await page.locator('.friends-dialog').evaluate((el) => getComputedStyle(el).animationName),
    'none',
  );
  await page.screenshot({ path: '../.tmp/friends-picker-dark.png' });
  await page.keyboard.press('Escape');
  failList = true;
  await page.goto(`${base}/friends/`);
  await page.getByRole('button', { name: messages['social.retry'], exact: true }).waitFor();
  failList = false;
  await page.getByRole('button', { name: messages['social.retry'], exact: true }).click();
  await page.getByRole('button', { name: 'Unpin Dreamer', exact: true }).waitFor();
  await page.evaluate(() => {
    sessionStorage.setItem('fixture-signed-out', '1');
    localStorage.removeItem('ambatuapp-cognito-session');
  });
  await page.goto(`${base}/friends/?user=stranger`);
  const authorize = page.waitForRequest((request) => request.url().includes('/oauth2/authorize'));
  await page.getByRole('button', { name: messages['profile.googleSignIn'], exact: true }).click();
  await authorize;
  await page.goto(`${base}/friends/?user=stranger`);
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem('ambatuapp-cognito-return-to')),
    '/friends/?user=stranger',
  );
  assert.deepEqual(errors, []);
  console.log(
    'Passed: request separation, persistent private pins, friend links and auth return, QR and focus, list/picker cursor scrolling, empty search batches, group creation, explicit game/clip sends, safe retry, phone/desktop/dark/reduced-motion layouts, no browser errors.',
  );
} catch (error) {
  await page.screenshot({ path: '../.tmp/friends-failure.png', fullPage: true });
  console.log(
    (
      await page
        .locator('body')
        .innerText()
        .catch(() => '')
    ).slice(-1800),
  );
  throw error;
} finally {
  await browser.close();
}
