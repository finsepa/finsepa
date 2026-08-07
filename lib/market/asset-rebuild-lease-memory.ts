/**
 * In-memory lease store mirroring Postgres try_acquire / release / fail RPCs.
 * Used for concurrent cold-miss simulations (no live Supabase/EODHD required).
 */

export type MemLeaseRow = {
  key: string;
  segment: string;
  ownerId: string;
  expiresAtMs: number;
  status: "building" | "failed";
};

export function createMemoryRebuildLeaseStore(clock: { now: () => number }) {
  const rows = new Map<string, MemLeaseRow>();
  const id = (key: string, segment: string) => `${key}\0${segment}`;

  return {
    rows,
    tryAcquire(key: string, segment: string, ownerId: string, ttlSeconds: number): boolean {
      const k = id(key, segment);
      const now = clock.now();
      const existing = rows.get(k);
      if (
        !existing ||
        existing.expiresAtMs < now ||
        existing.status === "failed"
      ) {
        rows.set(k, {
          key,
          segment,
          ownerId,
          expiresAtMs: now + ttlSeconds * 1000,
          status: "building",
        });
        return true;
      }
      return false;
    },
    release(key: string, segment: string, ownerId: string): void {
      const k = id(key, segment);
      const existing = rows.get(k);
      if (existing && existing.ownerId === ownerId) rows.delete(k);
    },
    fail(key: string, segment: string, ownerId: string): void {
      const k = id(key, segment);
      const existing = rows.get(k);
      if (existing && existing.ownerId === ownerId) {
        rows.set(k, {
          ...existing,
          status: "failed",
          expiresAtMs: clock.now(),
        });
      }
    },
  };
}
