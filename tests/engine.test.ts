import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { makeMines, neighbors, nextSnake, revealCells, spawnFood } from '../src/lib/game-engine.ts';
import { parseVideos, parseProfile, httpsUrl } from '../src/lib/feeds.ts';
test('Every migrated image and sound exists in the standalone public bundle', () => {
  const root = resolve(import.meta.dirname, '..');
  const data = JSON.parse(readFileSync(resolve(root, 'src/data/legacy.json'), 'utf8'));
  assert.equal(data.sounds.length, 26);
  assert.equal(data.characters.length, 13);
  for (const path of [
    ...data.sounds.map((s: { file: string }) => s.file),
    ...data.characters.flatMap((c: { image: string; header: string }) => [c.image, c.header]),
  ])
    assert.ok(existsSync(resolve(root, 'public', path.slice(1))), `Missing ${path}`);
});
test('Minesweeper first move and its neighbors are safe at every difficulty', () => {
  for (const [size, count] of [
    [8, 10],
    [10, 20],
    [12, 30],
  ])
    for (const safe of [0, size + 1, size * size - 1]) {
      const mines = makeMines(size, count, safe, () => 0.42);
      assert.equal(mines.size, count);
      for (const i of [safe, ...neighbors(safe, size)]) assert.ok(!mines.has(i));
    }
});
test('Neighbor counts do not wrap across board edges', () => {
  assert.deepEqual(neighbors(0, 8), [1, 8, 9]);
  assert.equal(neighbors(27, 8).length, 8);
  assert.equal(neighbors(7, 8).length, 3);
});
test('Flood reveal respects flagged cells and mines', () => {
  const mines = new Set([15]),
    flags = new Set([1]);
  const result = revealCells(0, 4, mines, new Set(), flags);
  assert.ok(result.has(0));
  assert.ok(result.has(14));
  assert.ok(!result.has(15));
  assert.ok(!result.has(1));
  assert.equal(result.size, 14);
});
test('Snake grows when eating and detects walls and body collisions', () => {
  const snake = [
    { x: 2, y: 2 },
    { x: 1, y: 2 },
    { x: 0, y: 2 },
  ];
  const next = nextSnake(snake, { x: 1, y: 0 }, { x: 3, y: 2 }, 4);
  assert.equal(next.ate, true);
  assert.equal(next.snake.length, 4);
  assert.equal(next.dead, false);
  assert.equal(nextSnake(next.snake, { x: 1, y: 0 }, { x: 0, y: 0 }, 4).dead, true);
  assert.equal(nextSnake(snake, { x: -1, y: 0 }, { x: 3, y: 3 }, 4).dead, true);
});
test('Snake can enter the vacated tail cell and handles a full board', () => {
  const snake = [
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
    { x: 0, y: 0 },
  ];
  assert.equal(nextSnake(snake, { x: -1, y: 0 }, { x: 3, y: 3 }, 4).dead, false);
  assert.equal(spawnFood(snake, 2), null);
  const food = spawnFood(snake, 3, () => 0);
  assert.deepEqual(food, { x: 2, y: 0 });
});
test('Public feeds reject unsafe links and normalize legacy field names', () => {
  assert.equal(httpsUrl('javascript:alert(1)'), '');
  assert.equal(httpsUrl('http://example.com'), '');
  const data = parseVideos([
    {
      title: 'A clip',
      url: 'https://www.youtube.com/watch?v=123',
      thumbnailUrl: 'https://example.com/a.jpg',
      channelName: 'Creator',
    },
    { title: 'Bad', url: 'javascript:alert(1)' },
  ]);
  assert.equal(data.length, 1);
  assert.equal(data[0].channel, 'Creator');
  assert.throws(() => parseVideos({}));
  const profile = parseProfile([{ username: 'Dreamy', followersCount: 42, friendsCount: 3 }]);
  assert.equal(profile.followers, 42);
  assert.throws(() => parseProfile([]));
});
