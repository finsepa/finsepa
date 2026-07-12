/** Development-only watchlist enrichment instrumentation. Never logs tickers or user ids. */

export type WatchlistEnrichDebugEvent =
  | "enrichment_load_trigger"
  | "enrichment_cache_hit"
  | "enrichment_http_post"
  | "enrichment_skipped_layout_only";

function enabled(): boolean {
  return process.env.NODE_ENV === "development";
}

export function logWatchlistEnrich(event: WatchlistEnrichDebugEvent, detail?: string): void {
  if (!enabled()) return;
  const suffix = detail ? ` (${detail})` : "";
  console.info(`[watchlist-enrich] ${event}${suffix}`);
}
