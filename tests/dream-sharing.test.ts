import test from 'node:test';
import assert from 'node:assert/strict';
import { dreamIdFromShareUrl } from '../src/lib/share-links.ts';

test('Dream chat links accept only trusted origins, the Dream route and a single valid ID', () => {
  const id = 'c74a7d49-ed8c-4666-819d-91def00b08d1';
  const origin = 'https://www.ambatu.fun';
  assert.equal(dreamIdFromShareUrl(`${origin}/ambatupost/?dream=${id}`, origin), id);
  assert.equal(dreamIdFromShareUrl(`https://ambatu.fun/ambatupost?dream=${id}`, origin), id);
  assert.equal(dreamIdFromShareUrl(`http://localhost:3001/ambatupost/?dream=${id}`, 'http://127.0.0.1:3001'), id);
  for (const url of [
    `https://evil.invalid/ambatupost/?dream=${id}`,
    `https://www.ambatu.fun.evil.invalid/ambatupost/?dream=${id}`,
    `https://user:pass@www.ambatu.fun/ambatupost/?dream=${id}`,
    `http://localhost:3001/ambatupost/?dream=${id}`,
    `${origin}/watch/?dream=${id}`,
    `${origin}/ambatupost/?dream=${id}&dream=${id}`,
    `${origin}/ambatupost/?dream=invalid`,
    'javascript:alert(1)',
  ]) assert.equal(dreamIdFromShareUrl(url, origin), null);
});
