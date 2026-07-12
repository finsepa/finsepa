/** Development-only add/remove mutation latency instrumentation. */

export type WatchlistMembershipMutationKind = "add" | "remove";

export type WatchlistMutationTiming = {
  kind: WatchlistMembershipMutationKind;
  startedAt: number;
};

function enabled(): boolean {
  return process.env.NODE_ENV === "development";
}

function logMs(label: string, ms: number, kind: WatchlistMembershipMutationKind): void {
  if (!enabled()) return;
  console.info(`[watchlist-mutation-timing] ${label}=${ms}ms (${kind})`);
}

export function startWatchlistMutationTiming(
  kind: WatchlistMembershipMutationKind,
): WatchlistMutationTiming {
  const timing = { kind, startedAt: performance.now() };
  logMs("mutation_click_ms", 0, kind);
  return timing;
}

export function markWatchlistMutationOptimisticApplied(timing: WatchlistMutationTiming): void {
  logMs("optimistic_applied_ms", Math.round(performance.now() - timing.startedAt), timing.kind);
}

export function markWatchlistMutationHttpConfirmed(timing: WatchlistMutationTiming): void {
  logMs("mutation_http_confirmed_ms", Math.round(performance.now() - timing.startedAt), timing.kind);
}

export function markWatchlistMutationToastShown(timing: WatchlistMutationTiming): void {
  logMs("toast_shown_ms", Math.round(performance.now() - timing.startedAt), timing.kind);
}

export function markWatchlistMutationQueueReleased(timing: WatchlistMutationTiming): void {
  logMs("queue_released_ms", Math.round(performance.now() - timing.startedAt), timing.kind);
}

export function logWatchlistCanonicalRefetchMs(ms: number): void {
  if (!enabled()) return;
  console.info(`[watchlist-mutation-timing] canonical_refetch_ms=${ms}ms`);
}

export function logWatchlistBackgroundReconcileResult(
  result: "confirmed" | "contradicted_rollback" | "stale_skipped" | "fetch_miss",
  kind: WatchlistMembershipMutationKind,
): void {
  if (!enabled()) return;
  console.info(`[watchlist-mutation-timing] background_reconcile_result=${result} (${kind})`);
}
