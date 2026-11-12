/**
 * Browser-side cache for chart API JSON (line ranges + candle intervals).
 * Range/interval switches read a fresh entry (or join the in-flight request) instead of
 * waiting on a new round trip; idle prefetch fills entries before the user clicks.
 * Past `ttlMs` but within `staleMs`, the last good response is returned at once and refreshed
 * in the background (stale-while-revalidate).
 */

type Entry = {
  at: number;
  promise: Promise<unknown>;
  /** Last successful JSON — set once the request resolves. */
  value?: unknown;
  revalidating?: boolean;
};

const entries = new Map<string, Entry>();
const MAX_ENTRIES = 80;

function evictOldest() {
  if (entries.size <= MAX_ENTRIES) return;
  let oldestKey: string | null = null;
  let oldestAt = Infinity;
  for (const [key, entry] of entries) {
    if (entry.at < oldestAt) {
      oldestAt = entry.at;
      oldestKey = key;
    }
  }
  if (oldestKey) entries.delete(oldestKey);
}

async function fetchJson<T>(path: string): Promise<T | null> {
  const res = await fetch(path, { credentials: "include" });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

function startRequest<T>(path: string): Promise<T | null> {
  const entry: Entry = { at: Date.now(), promise: Promise.resolve(null) };
  const promise = fetchJson<T>(path).then(
    (json) => {
      if (entries.get(path) !== entry) return json;
      if (json == null) entries.delete(path);
      else entry.value = json;
      return json;
    },
    (err: unknown) => {
      if (entries.get(path) === entry) entries.delete(path);
      throw err;
    },
  );
  entry.promise = promise;
  entries.set(path, entry);
  evictOldest();
  return promise;
}

/**
 * Fresh cached JSON for `path`, or a new (shared) request. With `staleMs > ttlMs`, an older
 * successful response is served immediately while a background request refreshes it.
 * Failed loads are not cached.
 */
export function fetchChartJsonCached<T>(path: string, ttlMs: number, staleMs = ttlMs): Promise<T | null> {
  const hit = entries.get(path);
  if (hit) {
    const age = Date.now() - hit.at;
    if (age < ttlMs) return hit.promise as Promise<T | null>;
    if (age < staleMs && hit.value !== undefined) {
      if (!hit.revalidating) {
        hit.revalidating = true;
        void fetchJson<T>(path)
          .then((json) => {
            if (json != null) primeChartJsonCache(path, json);
          })
          .catch(() => {})
          .finally(() => {
            hit.revalidating = false;
          });
      }
      return Promise.resolve(hit.value as T);
    }
  }
  return startRequest<T>(path);
}

/** Store a response fetched outside the cache (e.g. a background refresh) for later reads. */
export function primeChartJsonCache(path: string, json: unknown) {
  entries.set(path, { at: Date.now(), promise: Promise.resolve(json), value: json });
  evictOldest();
}

const PREFETCH_GAP_MS = 150;

/**
 * Warm `paths` one at a time while the browser is idle and the tab is visible.
 * Returns a cancel function (stops paths not yet started).
 */
export function prefetchChartJsonWhenIdle(paths: readonly string[], ttlMs: number): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let idleId: number | null = null;
  const queue = [...paths];

  const runNext = () => {
    if (cancelled) return;
    const path = queue.shift();
    if (!path) return;
    if (typeof document !== "undefined" && document.hidden) {
      queue.unshift(path);
      timer = setTimeout(scheduleNext, 2_000);
      return;
    }
    void fetchChartJsonCached(path, ttlMs)
      .catch(() => null)
      .finally(() => {
        if (!cancelled) timer = setTimeout(scheduleNext, PREFETCH_GAP_MS);
      });
  };

  const scheduleNext = () => {
    if (cancelled) return;
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(runNext, { timeout: 2_000 });
    } else {
      timer = setTimeout(runNext, 50);
    }
  };

  scheduleNext();
  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    if (idleId != null && typeof window !== "undefined" && "cancelIdleCallback" in window) {
      window.cancelIdleCallback(idleId);
    }
  };
}
