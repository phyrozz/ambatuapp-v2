export type WatchSample = { now: number; position: number; duration: number; rate: number; playing: boolean };
export function createScrollWatchTracker() {
  let previous: WatchSample | null = null, watchedMs = 0;
  return {
    sample(current: WatchSample) {
      if (previous && previous.playing && current.playing && current.duration > 0) {
        const elapsed = current.now - previous.now;
        const advanced = current.position - previous.position;
        const expected = elapsed * current.rate / 1000;
        const looped = advanced < 0 && previous.position > current.duration - expected - 0.5 && current.position < expected + 0.5;
        // Ignore stalls, seeks, hidden tabs, and timer gaps; loops cannot exceed the cap.
        if (elapsed > 0 && elapsed <= 1500 && ((advanced > 0 && advanced <= expected + 0.5) || looped)) {
          watchedMs = Math.min(120_000, watchedMs + Math.min(expected, looped ? expected : advanced) * 1000);
        }
      }
      previous = current;
      return Math.round(watchedMs);
    },
    value() { return Math.round(watchedMs); },
  };
}
