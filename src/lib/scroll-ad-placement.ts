/** Session-only placement policy. Ad selection is independent of placement. */
export type AdPlacementState = {
  seen: Map<string, number>;
  clipsSinceAd: number;
  watchedMsSinceAd: number;
  lastAdAt: number | null;
};

export function createAdPlacementState(): AdPlacementState {
  return { seen: new Map(), clipsSinceAd: 0, watchedMsSinceAd: 0, lastAdAt: null };
}

export function recordAdPlacementWatch(state: AdPlacementState, id: string, watchedMs: number): void {
  if (!id || !Number.isFinite(watchedMs) || watchedMs < 2000) return;
  const previous = state.seen.get(id) ?? 0;
  const current = Math.min(watchedMs, 30000);
  if (current <= previous) return;
  state.seen.set(id, current);
  if (!previous) state.clipsSinceAd += 1;
  state.watchedMsSinceAd += current - previous;
}

export function isAdPlacementEligible(state: AdPlacementState, now: number): boolean {
  return state.clipsSinceAd >= 3 && state.watchedMsSinceAd >= 12000
    && (state.lastAdAt === null || now - state.lastAdAt >= 60000);
}

export function recordAdPlacement(state: AdPlacementState, now: number): void {
  state.clipsSinceAd = 0;
  state.watchedMsSinceAd = 0;
  state.lastAdAt = now;
}
