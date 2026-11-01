import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function setup(fetcher: typeof fetch) {
  const saved: string[] = [];
  const evaluated = { exports: {} as { downloadChatMedia: (user: string, conversation: string, key: string, url: string, kind: 'image' | 'video') => Promise<Blob | null> } };
  const code = ts.transpileModule(readFileSync(new URL('../src/lib/chat-media-cache.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    module: evaluated, exports: evaluated.exports, fetch: fetcher,
    require: () => ({ maxChatMediaBytes: 5 * 1024 * 1024, saveCachedChatMedia: async (user: string, conversation: string, key: string) => { saved.push(`${user}:${conversation}:${key}`); } }),
  });
  return { ...evaluated.exports, saved };
}

test('concurrent requests for the same attachment download and store it once', async () => {
  let requests = 0;
  const cache = setup(async () => {
    requests++;
    return new Response(new Blob(['image'], { type: 'image/png' }));
  });
  const [first, second] = await Promise.all([
    cache.downloadChatMedia('a', 'room', 'key', 'https://example.test/image', 'image'),
    cache.downloadChatMedia('a', 'room', 'key', 'https://example.test/image', 'image'),
  ]);
  assert.equal(requests, 1);
  assert.equal(await first?.text(), 'image');
  assert.equal(first, second);
  assert.deepEqual(cache.saved, ['a:room:key']);
});

test('failed and unexpected media responses are not cached', async () => {
  const cache = setup(async () => new Response('not an image', { headers: { 'content-type': 'text/plain' } }));
  assert.equal(await cache.downloadChatMedia('a', 'room', 'key', 'https://example.test/image', 'image'), null);
  assert.deepEqual(cache.saved, []);
});
