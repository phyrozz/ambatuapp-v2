import test from 'node:test';
import assert from 'node:assert/strict';
import { createScrollWatchTracker } from '../src/lib/scroll-watch.ts';

test('only active advancing playback counts; pause, stall, hidden tab gaps and seeks do not', () => {
  const tracker = createScrollWatchTracker();
  const sample = (now: number, position: number, playing = true) => tracker.sample({ now, position, playing, duration: 30, rate: 1 });
  sample(0, 0);
  assert.equal(sample(250, 0.25), 250);
  assert.equal(sample(500, 0.25), 250);
  assert.equal(sample(750, 0.25, false), 250);
  assert.equal(sample(1000, 0.25), 250);
  assert.equal(sample(1250, 25), 250);
  assert.equal(sample(10000, 26), 250);
  assert.equal(sample(10250, 26.25), 500);
});

test('playback speed and loops are measured, with a two-minute cap', () => {
  const tracker = createScrollWatchTracker();
  tracker.sample({ now: 0, position: 0, playing: true, duration: 1, rate: 2 });
  for (let i = 1; i <= 300; i++) tracker.sample({ now: i * 250, position: (i * 0.5) % 1, playing: true, duration: 1, rate: 2 });
  assert.equal(tracker.value(), 120000);
});
