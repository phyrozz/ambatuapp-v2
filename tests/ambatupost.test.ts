import test from 'node:test';
import assert from 'node:assert/strict';
import { Capacitor } from '@capacitor/core';
import {
  dreamApi,
  DreamApiError,
  dreamErrorKey,
  dreamHref,
  dreamRequestKey,
} from '../src/lib/ambatupost.ts';

test('Dream transport preserves guest/member identity, mutation method and retry key without caching', async () => {
  const originalFetch = globalThis.fetch,
    originalBase = process.env.NEXT_PUBLIC_CHARACTER_API_URL,
    originalNative = Capacitor.isNativePlatform;
  process.env.NEXT_PUBLIC_CHARACTER_API_URL = 'https://fixture.invalid/api/public';
  Capacitor.isNativePlatform = () => false;
  const calls: { url: string; options: RequestInit }[] = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options: options ?? {} });
    return options?.method === 'DELETE'
      ? new Response(null, { status: 204 })
      : Response.json({ id: 'fixture' });
  };
  try {
    await dreamApi('/fixture', null);
    assert.equal(calls[0].url, 'https://fixture.invalid/api/public/ambatupost/fixture');
    assert.equal((calls[0].options.headers as Record<string, string>).authorization, undefined);
    assert.equal(calls[0].options.cache, 'no-store');
    const key = dreamRequestKey();
    await dreamApi('', 'id-token', {
      method: 'POST',
      body: { text: 'Hello', audience: 'public' },
      key,
    });
    assert.equal(
      (calls[1].options.headers as Record<string, string>).authorization,
      'Bearer id-token',
    );
    assert.equal((calls[1].options.headers as Record<string, string>)['idempotency-key'], key);
    assert.equal(calls[1].options.method, 'POST');
    assert.equal(calls[1].url, '/api/public/ambatupost');
    await dreamApi('/fixture', 'id-token', {
      method: 'PATCH',
      body: { text: 'Edited', revision: 2 },
    });
    assert.equal(calls[2].url, '/api/public/ambatupost/fixture');
    assert.equal(calls[2].options.method, 'PATCH');
    assert.equal(
      (calls[2].options.headers as Record<string, string>).authorization,
      'Bearer id-token',
    );
    assert.deepEqual(JSON.parse(calls[2].options.body as string), { text: 'Edited', revision: 2 });
    assert.equal(await dreamApi('/fixture', 'id-token', { method: 'DELETE' }), undefined);
    assert.equal(calls[3].url, '/api/public/ambatupost/fixture');
    Capacitor.isNativePlatform = () => true;
    for (const method of ['POST', 'PATCH', 'DELETE'] as const) {
      await dreamApi('/fixture', 'id-token', { method });
      assert.equal(calls.at(-1)?.url, 'https://fixture.invalid/api/public/ambatupost/fixture');
    }
  } finally {
    globalThis.fetch = originalFetch;
    Capacitor.isNativePlatform = originalNative;
    if (originalBase === undefined) delete process.env.NEXT_PUBLIC_CHARACTER_API_URL;
    else process.env.NEXT_PUBLIC_CHARACTER_API_URL = originalBase;
  }
});
test('Dream errors map to translated messages and direct links keep IDs in the query', () => {
  assert.equal(dreamErrorKey(new DreamApiError('REVISION_CONFLICT', 409)), 'post.conflict');
  assert.equal(dreamErrorKey(new DreamApiError('UNAUTHORIZED', 401)), 'post.signInAgain');
  assert.equal(dreamErrorKey(new DreamApiError('DREAM_UNAVAILABLE', 404)), 'post.unavailable');
  assert.equal(dreamErrorKey(new Error('Backend English must not be rendered')), 'post.error');
  assert.equal(dreamHref('id with spaces'), '/ambatupost/?dream=id%20with%20spaces');
});
