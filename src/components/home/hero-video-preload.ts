/**
 * Idle-time warm-up for carousel media the slot window has not reached yet.
 *
 * Before the media routes can stream anything they have to resolve an upstream
 * CDN URL, which is the slow half of a cold request. A two-byte ranged fetch
 * costs practically no bandwidth but leaves that resolution cached on the
 * server, so when a slot does point at the video the bytes start flowing
 * straight away instead of waiting on a lookup.
 *
 * Deliberately separate from the <video> elements: this only primes caches, so
 * distant cards cost nothing in memory or decoder capacity.
 */

const MAX_CONCURRENT = 2;
/** Give up on a warm-up rather than holding a slot in the queue forever. */
const REQUEST_TIMEOUT_MS = 12_000;

const settled = new Set<string>();
const pending = new Set<string>();
const queue: string[] = [];
let active = 0;
let draining = false;

type IdleCapableWindow = Window & {
  requestIdleCallback?: (
    callback: (deadline: { timeRemaining: () => number }) => void,
    options?: { timeout: number },
  ) => number;
};

function whenIdle(task: () => void) {
  if (typeof window === "undefined") return;
  const host = window as IdleCapableWindow;
  if (typeof host.requestIdleCallback === "function") {
    host.requestIdleCallback(() => task(), { timeout: 2000 });
    return;
  }
  window.setTimeout(task, 200);
}

function drain() {
  if (draining) return;
  draining = true;

  whenIdle(() => {
    draining = false;
    if (queue.length === 0) return;

    while (active < MAX_CONCURRENT && queue.length > 0) {
      const src = queue.shift();
      if (!src || settled.has(src)) continue;
      active += 1;
      void fetch(src, {
        // Two bytes is enough to make the route resolve and cache the upstream
        // URL. Asking for more would duplicate what the element will fetch.
        headers: { Range: "bytes=0-1" },
        credentials: "same-origin",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
        .catch(() => {
          // A failed warm-up is not worth surfacing: the element will retry the
          // request itself and fall back to the poster if that fails too.
        })
        .finally(() => {
          active -= 1;
          settled.add(src);
          pending.delete(src);
          if (queue.length > 0) drain();
        });
    }
  });
}

/** Queues a source for warming, ignoring anything already done or queued. */
export function warmMediaSource(src: string) {
  if (typeof window === "undefined") return;
  if (settled.has(src) || pending.has(src)) return;
  pending.add(src);
  queue.push(src);
  drain();
}

/** Drops queued work, leaving in-flight requests to finish on their own. */
export function clearMediaWarmQueue() {
  queue.length = 0;
  pending.clear();
}
