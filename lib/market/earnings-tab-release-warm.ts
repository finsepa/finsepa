import "server-only";

import { warmStockEarningsDocumentCache } from "@/lib/market/stock-earnings-tab-data";

const inflight = new Map<string, Promise<void>>();

/**
 * After push cron detects a new actual: one bounded warm per ticker (fundamentals + SEC/IR
 * persist into document cache). Not on the user page path — visitors only read Supabase
 * overlays. Concurrent schedules for the same ticker collapse to one run.
 */
export function scheduleEarningsTabWarmAfterRelease(ticker: string): void {
  const sym = ticker.trim().toUpperCase();
  if (!sym || inflight.has(sym)) return;

  const p = (async () => {
    try {
      await warmStockEarningsDocumentCache(sym);
    } catch (err) {
      console.warn(
        `earnings_tab_release_warm_failed:${sym}`,
        err instanceof Error ? err.message : err,
      );
    }
  })().finally(() => {
    if (inflight.get(sym) === p) inflight.delete(sym);
  });

  inflight.set(sym, p);
}
