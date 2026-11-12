import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createAdPlacementState, isAdPlacementEligible, recordAdPlacement, recordAdPlacementWatch } from '../src/lib/scroll-ad-placement.ts';

test('requires both engaged viewing and distinct clips', () => {
  const state = createAdPlacementState();
  recordAdPlacementWatch(state, 'one', 6000);
  recordAdPlacementWatch(state, 'one', 6000);
  recordAdPlacementWatch(state, 'skip', 1000);
  assert.equal(isAdPlacementEligible(state, 100000), false);
  for (const id of ['two', 'three']) recordAdPlacementWatch(state, id, 3000);
  assert.equal(isAdPlacementEligible(state, 100000), true);
});

test('a short feed still requires meaningful viewing before the first ad', () => {
  const state = createAdPlacementState();
  for (const id of ['one', 'two', 'three']) recordAdPlacementWatch(state, id, 3000);
  assert.equal(isAdPlacementEligible(state, 100000), false);
  recordAdPlacementWatch(state, 'three', 6000);
  assert.equal(isAdPlacementEligible(state, 100000), true);
});

test('applies spacing and cooldown after a placement', () => {
  const state = createAdPlacementState();
  for (const id of ['a', 'b', 'c', 'd']) recordAdPlacementWatch(state, id, 15000);
  recordAdPlacement(state, 100000);
  for (const id of ['e', 'f', 'g', 'h']) recordAdPlacementWatch(state, id, 15000);
  assert.equal(isAdPlacementEligible(state, 159999), false);
  assert.equal(isAdPlacementEligible(state, 160000), true);
});

test('incremental watch samples add only new viewing time', () => {
  const state = createAdPlacementState();
  recordAdPlacementWatch(state, 'one', 2000);
  recordAdPlacementWatch(state, 'one', 10000);
  recordAdPlacementWatch(state, 'one', 5000);
  assert.equal(state.clipsSinceAd, 1);
  assert.equal(state.watchedMsSinceAd, 10000);
  recordAdPlacement(state, 1000);
  recordAdPlacementWatch(state, 'one', 10000);
  assert.equal(state.clipsSinceAd, 0);
});
