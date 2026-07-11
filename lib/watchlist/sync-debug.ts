/** Development-only watchlist sync instrumentation. Never logs tickers, user ids, or tokens. */

export type WatchlistSyncDebugEvent =
  | "bootstrap_cache_display"
  | "bootstrap_server_canonical_adopt"
  | "bootstrap_server_fetch_miss"
  | "bootstrap_db_unavailable"
  | "mutation_start"
  | "mutation_success"
  | "mutation_failure"
  | "full_sync_post";

function enabled(): boolean {
  return process.env.NODE_ENV === "development";
}

export function logWatchlistSync(event: WatchlistSyncDebugEvent, detail?: string): void {
  if (!enabled()) return;
  const suffix = detail ? ` (${detail})` : "";
  console.info(`[watchlist-sync] ${event}${suffix}`);
}
