import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avatarUrlExpiresAt, selectChatAvatar } from '../src/lib/chat-cache.ts';

const now = Date.UTC(2026, 0, 1, 12, 0, 0);
const signed = (path: string, time = '20260101T120000Z') => `https://images.example/${path}?X-Amz-Date=${time}&X-Amz-Expires=3600&X-Amz-Signature=abc`;

test('reuses an unexpired signed URL for the same image despite a new signature', () => {
  const original = selectChatAvatar('a', signed('avatar-a'), undefined, now)!;
  const refreshed = signed('avatar-a', '20260101T121000Z');
  assert.equal(selectChatAvatar('a', refreshed, original, now + 10 * 60_000), original);
  assert.equal(avatarUrlExpiresAt(signed('avatar-a'), now), now + 55 * 60_000);
});

test('replaces changed or nearly expired images and rejects expired URLs', () => {
  const original = selectChatAvatar('a', signed('avatar-a'), undefined, now)!;
  assert.equal(selectChatAvatar('a', signed('avatar-b'), original, now)?.url, signed('avatar-b'));
  const refreshed = signed('avatar-a', '20260101T125400Z');
  assert.equal(selectChatAvatar('a', refreshed, original, now + 54 * 60_000)?.url, refreshed);
  assert.equal(selectChatAvatar('a', signed('avatar-a'), undefined, now + 60 * 60_000), null);
  assert.equal(selectChatAvatar('a', 'javascript:alert(1)', undefined, now), null);
});
