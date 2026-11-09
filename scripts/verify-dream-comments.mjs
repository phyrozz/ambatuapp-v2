// Intercepted localhost browser fixtures: no managed database, uploads or real accounts.
import { chromium, expect as baseExpect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base = process.env.DREAM_UI_BASE ?? 'http://localhost:3001';
const en = JSON.parse(await fs.readFile('src/messages/en.json', 'utf8'));
const expect = baseExpect.configure({ timeout: 30000 });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const dreamId = 'c74a7d49-ed8c-4666-819d-91def00b08d1';
const commentId = (index) => `c74a7d49-ed8c-4666-819d-${String(index).padStart(12, '0')}`;
const blankVotes = () => ({ up: 0, down: 0, viewerVote: 0 });
try {
  for (const { member, width } of [
    { member: true, width: 1440 },
    { member: true, width: 320 },
    { member: false, width: 320 },
  ]) {
    const context = await browser.newContext({
      viewport: { width, height: width < 600 ? 850 : 1000 },
      reducedMotion: member ? 'no-preference' : 'reduce',
    });
    await context.addInitScript(
      ({ member, width }) => {
        localStorage.setItem('ambatuapp-locale', 'en');
        localStorage.setItem('ambatuapp-theme', width < 600 ? 'dark' : 'light');
        if (member) {
          const payload = btoa(
            JSON.stringify({ sub: 'alice', email: 'alice@example.invalid', name: 'Alice' }),
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
          sessionStorage.setItem('ambatuapp-push-prompt-dismissed:alice', '1');
          localStorage.setItem('ambatuapp-mydreamy-tour:alice', 'completed');
        }
      },
      { member, width },
    );
    const page = await context.newPage(),
      errors = [],
      calls = [],
      receipts = new Map();
    const avatar = `${base}/fixture-comment-avatar.svg`;
    const make = (index, authorId, text, parentId = null) => ({
      id: commentId(index),
      authorId,
      authorName: authorId === 'alice' ? 'Alice' : 'Bob',
      authorAvatarUrl: avatar,
      text,
      parentId,
      deleted: false,
      revision: 1,
      createdAt: '2026-11-08T00:00:00.999Z',
      updatedAt: '2026-11-08T00:00:00.999Z',
      votes: blankVotes(),
    });
    const first = make(
      1,
      'bob',
      'A public comment with <script>window.commentInjected=true</script>',
    );
    const own = make(2, 'alice', 'My comment fixture');
    const tail = make(3, 'bob', 'Next comment batch');
    const reply = make(4, 'bob', 'A reply fixture', first.id);
    const otherReply = make(5, 'bob', 'Another author reply', own.id);
    const roots = [first, own],
      replies = new Map([
        [first.id, [reply]],
        [own.id, [otherReply]],
      ]);
    let generated = 10,
      failCreate = member,
      failVote = false,
      forbidden = false;
    page.on('pageerror', (error) => errors.push(error.message));
    await context.route('**/*', async (route) => {
      const request = route.request(),
        url = new URL(request.url()),
        path = url.pathname;
      if (path === '/fixture-comment-avatar.svg')
        return route.fulfill({
          contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#c65f38"/><circle cx="40" cy="40" r="22" fill="#ffe4b7"/></svg>',
        });
      if (path.endsWith('/profile/initialize'))
        return route.fulfill({
          json: { username: 'Alice', birthDate: '2000-01-01', avatarUrl: avatar },
        });
      if (path.endsWith('/friends/summary')) return route.fulfill({ json: { incomingCount: 0 } });
      if (path.includes('/api/public/ambatupost')) {
        if (path.endsWith('/config')) return route.fulfill({ json: { attachmentsEnabled: false } });
        if (path.endsWith('/feed'))
          return route.fulfill({
            json: {
              dreams: [
                {
                  id: dreamId,
                  authorId: 'bob',
                  authorName: 'Bob',
                  authorAvatarUrl: avatar,
                  text: 'Dream with comments',
                  audience: 'public',
                  publication: 'published',
                  revision: 1,
                  createdAt: '2026-11-08T00:00:00Z',
                  updatedAt: '2026-11-08T00:00:00Z',
                  publishedAt: '2026-11-08T00:00:00Z',
                  votes: blankVotes(),
                },
              ],
              nextCursor: null,
            },
          });
        if (path.includes('/comments')) {
          calls.push({
            method: request.method(),
            path,
            query: url.search,
            body: request.postDataJSON(),
            key: request.headers()['idempotency-key'],
            authenticated: Boolean(request.headers().authorization),
          });
          if (forbidden)
            return route.fulfill({ status: 404, json: { error: 'DREAM_UNAVAILABLE' } });
          const parts = path.split('/').filter(Boolean),
            index = parts.indexOf('comments'),
            id = parts[index + 1],
            body = request.postDataJSON();
          if (request.method() === 'GET') {
            await new Promise((resolve) => setTimeout(resolve, 250));
            const parent = url.searchParams.get('parent');
            return route.fulfill({
              json: {
                comments: parent
                  ? (replies.get(parent) ?? [])
                  : url.searchParams.has('cursor')
                    ? [tail]
                    : roots,
                nextCursor: !parent && !url.searchParams.has('cursor') ? 'next-comments' : null,
              },
            });
          }
          assert(member, 'guest attempted an actual comment mutation');
          if (parts.at(-1) === 'vote') {
            const item = [...roots, ...[...replies.values()].flat()].find((row) => row.id === id);
            const key = request.headers()['idempotency-key'];
            if (!receipts.has(key)) {
              item.votes = {
                up: body.value === 1 ? 1 : 0,
                down: body.value === -1 ? 1 : 0,
                viewerVote: body.value,
              };
              receipts.set(key, { value: body.value });
            }
            await new Promise((resolve) => setTimeout(resolve, 500));
            if (failVote) {
              failVote = false;
              return route.fulfill({ status: 503, json: { error: 'DREAM_SERVICE_UNAVAILABLE' } });
            }
            return route.fulfill({ json: item.votes });
          }
          if (request.method() === 'PATCH') {
            const item = [...roots, ...[...replies.values()].flat()].find((row) => row.id === id);
            Object.assign(item, {
              text: body.text,
              revision: item.revision + 1,
              updatedAt: '2026-11-08T00:01:00Z',
            });
            return route.fulfill({ json: item });
          }
          if (request.method() === 'DELETE') {
            const item = roots.find((row) => row.id === id);
            Object.assign(item, {
              text: null,
              authorId: null,
              authorName: null,
              authorAvatarUrl: null,
              deleted: true,
              revision: item.revision + 1,
              votes: blankVotes(),
            });
            return route.fulfill({ json: item });
          }
          const key = request.headers()['idempotency-key'];
          let result = receipts.get(key);
          if (!result) {
            result = make(generated++, 'alice', body.text, body.parentId);
            if (body.parentId)
              replies.set(body.parentId, [result, ...(replies.get(body.parentId) ?? [])]);
            else roots.unshift(result);
            receipts.set(key, result);
          }
          if (failCreate) {
            failCreate = false;
            return route.fulfill({ status: 503, json: { error: 'DREAM_SERVICE_UNAVAILABLE' } });
          }
          return route.fulfill({ status: 201, json: result });
        }
      }
      if (url.origin === base) return route.continue();
      return route.fulfill({ json: {} });
    });
    await page.goto(`${base}/ambatupost/`);
    const card = page.locator('.dream-feed-card');
    await expect(card).toHaveCount(1);
    assert.equal(calls.length, 0, 'collapsed comments make no requests');
    await card.getByRole('button', { name: en['post.comments'], exact: true }).click();
    await expect(card.locator('.dream-comment-scaffold')).toBeVisible();
    const region = card.getByRole('region', { name: en['post.comments'], exact: true });
    await expect(region).toContainText(first.text);
    assert.equal(
      await page.evaluate(() => window.commentInjected),
      undefined,
      'comment text is escaped',
    );
    assert.equal(calls[0].authenticated, member);
    const firstItem = region.locator(`[data-comment-id="${first.id}"]`);
    await firstItem
      .getByRole('button', { name: en[member ? 'post.reply' : 'post.replies'], exact: true })
      .click();
    await expect(firstItem).toContainText(reply.text);
    if (member) {
      const replyComposer = firstItem
        .locator('.dream-comment-replies')
        .getByRole('textbox', { name: en['post.replyBody'], exact: true })
        .first();
      await replyComposer.fill('A member reply');
      await firstItem.getByRole('button', { name: en['post.replySend'], exact: true }).click();
      // First create has an ambiguous failure; retry the same content/key safely.
      await expect(firstItem).toContainText(en['post.error']);
      await firstItem.getByRole('button', { name: en['post.replySend'], exact: true }).click();
      await expect(firstItem).toContainText('A member reply');
      const creates = calls.filter(
        (call) => call.method === 'POST' && !call.path.endsWith('/vote'),
      );
      assert.equal(creates[0].key, creates[1].key);
      await expect(
        firstItem.locator('.dream-comment-body').filter({ hasText: 'A member reply' }),
      ).toHaveCount(1);
      const ownReply = firstItem.locator(`[data-comment-id="${commentId(10)}"]`);
      await ownReply.getByRole('button', { name: en['chat.moreActions'], exact: true }).click();
      await ownReply.getByRole('button', { name: en['post.editComment'], exact: true }).click();
      await ownReply
        .getByRole('textbox', { name: en['post.replyBody'], exact: true })
        .fill('Edited member reply');
      assert(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
        'reply editor horizontal overflow',
      );
      await ownReply.getByRole('button', { name: en['post.saveComment'], exact: true }).click();
      await expect(ownReply).toContainText('Edited member reply');
      const voting = firstItem.locator(':scope > .dream-comment-voting');
      await voting
        .getByRole('button', {
          name: en['post.commentUpvoteLabel'].replace('{count}', '0'),
          exact: true,
        })
        .click();
      await expect(
        voting.getByRole('button', {
          name: en['post.commentUpvoteLabel'].replace('{count}', '1'),
          exact: true,
        }),
      ).toHaveAttribute('aria-pressed', 'true');
      await voting
        .getByRole('button', {
          name: en['post.commentDownvoteLabel'].replace('{count}', '0'),
          exact: true,
        })
        .click();
      await expect(
        voting.getByRole('button', {
          name: en['post.commentDownvoteLabel'].replace('{count}', '1'),
          exact: true,
        }),
      ).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(() => calls.filter((call) => call.path.endsWith('/vote')).length).toBe(2);
      await expect.poll(() => first.votes.viewerVote).toBe(-1);
      failVote = true;
      await voting
        .getByRole('button', {
          name: en['post.commentUpvoteLabel'].replace('{count}', '0'),
          exact: true,
        })
        .click();
      await expect(voting).toContainText(en['post.error']);
      await voting.getByRole('button', { name: en['common.retry'], exact: true }).click();
      await expect(voting.locator('[role="alert"]')).toHaveCount(0);
      const votes = calls.filter((call) => call.path.endsWith('/vote'));
      assert.equal(votes.at(-1).key, votes.at(-2).key, 'vote retry keeps its intent key');
      const ownItem = region.locator(`[data-comment-id="${own.id}"]`);
      await ownItem.getByRole('button', { name: en['chat.moreActions'], exact: true }).click();
      await ownItem.getByRole('button', { name: en['post.editComment'], exact: true }).click();
      await ownItem
        .getByRole('textbox', { name: en['post.commentBody'], exact: true })
        .fill('Edited comment fixture');
      await ownItem.getByRole('button', { name: en['post.saveComment'], exact: true }).click();
      await expect(ownItem).toContainText('Edited comment fixture');
      await ownItem.getByRole('button', { name: en['post.reply'], exact: true }).click();
      await expect(ownItem).toContainText(otherReply.text);
      await ownItem.getByRole('button', { name: en['chat.moreActions'], exact: true }).click();
      await ownItem.getByRole('button', { name: en['post.deleteComment'], exact: true }).click();
      const confirm = page.getByRole('dialog', { name: en['post.deleteCommentConfirm'] });
      await confirm.getByRole('button', { name: en['post.deleteComment'], exact: true }).click();
      await expect(region).toContainText(en['post.commentDeleted']);
      await expect(region).toContainText(otherReply.text);
    } else {
      await firstItem.locator(':scope > .dream-comment-voting').getByRole('button').first().click();
      await expect(page.getByRole('dialog', { name: en['post.commentSignIn'] })).toBeVisible();
      await page.getByRole('button', { name: en['chat.dismiss'], exact: true }).click();
      assert.equal(calls.filter((call) => call.method !== 'GET').length, 0);
      await expect(region.getByRole('textbox')).toHaveCount(0);
    }
    await region.locator('.dream-comment-sentinel').last().scrollIntoViewIfNeeded();
    await expect(region).toContainText(tail.text);
    await region.evaluate((element) => {
      window.scrollTo(0, Math.max(0, element.getBoundingClientRect().top + window.scrollY - 200));
    });
    await page.screenshot({
      path: `../.tmp/dream-comments-${member ? (width < 600 ? 'member-phone-dark' : 'desktop-light') : 'phone-dark'}.png`,
    });
    assert(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      'horizontal overflow',
    );
    assert.deepEqual(errors, []);
    forbidden = true;
    await region
      .getByRole('button', { name: en['post.refreshComments'], exact: true })
      .first()
      .click();
    await expect(card).toHaveCount(0, 'revoked Dream is removed after a comments request');
    await context.close();
  }
  console.log(
    'Dream comments browser fixtures passed: guest/member, replies, pagination, escaped text, retry keys, optimistic votes, edit/delete and revocation.',
  );
} finally {
  await browser.close();
}
