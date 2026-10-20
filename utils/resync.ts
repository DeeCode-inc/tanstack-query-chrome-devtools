/**
 * Delay before the first resync, and again after a quiet period. Folds the
 * drops of a burst into one resync.
 */
export const RESYNC_MIN_DELAY_MS = 1000;

/**
 * Longest delay between resyncs, reached by doubling. Also the quiet period:
 * a drop this long after the last resync starts over from the minimum.
 */
export const RESYNC_MAX_DELAY_MS = 60_000;

export interface ResyncScheduler {
  /**
   * Asks for a resync. It runs after the current delay; requests made while
   * one is scheduled are folded into it.
   */
  request(): void;
  /**
   * Drops a scheduled resync, e.g. because a fresh snapshot is coming anyway.
   * The backoff is kept.
   */
  cancel(): void;
}

/**
 * Rate-limits `resync` with exponential backoff. A resync makes the page
 * build and post a whole snapshot, which takes the page's main thread for as
 * long as encoding its cache does, so a drop that keeps recurring must not
 * turn into a stream of snapshots: they come at most once per
 * `RESYNC_MAX_DELAY_MS` once the delay has grown.
 */
export function createResyncScheduler(resync: () => void): ResyncScheduler {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let delay = RESYNC_MIN_DELAY_MS;
  let lastResyncAt = Number.NEGATIVE_INFINITY;

  return {
    request() {
      if (timer !== null) return;
      if (Date.now() - lastResyncAt >= RESYNC_MAX_DELAY_MS) {
        delay = RESYNC_MIN_DELAY_MS;
      }
      timer = setTimeout(() => {
        timer = null;
        lastResyncAt = Date.now();
        delay = Math.min(delay * 2, RESYNC_MAX_DELAY_MS);
        resync();
      }, delay);
    },
    cancel() {
      if (timer === null) return;
      clearTimeout(timer);
      timer = null;
    },
  };
}
