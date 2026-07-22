/**
 * Prefer SnapTrade activities over executed-order fallbacks when both describe the same fill.
 * Pure / isomorphic.
 */

import type { SnapTradeSyncDraftTransaction } from "@/lib/snaptrade/snaptrade-normalize-activity";

/** Content key for economic identity of a trade (full precision — no rounding). */
export function snaptradeTradeDedupeKey(t: Pick<
  SnapTradeSyncDraftTransaction,
  "kind" | "date" | "operation" | "symbol" | "shares" | "price"
>): string | null {
  if (t.kind !== "trade") return null;
  return [
    t.date,
    t.operation.trim().toLowerCase(),
    t.symbol.trim().toUpperCase(),
    String(t.shares),
    String(t.price),
  ].join("|");
}

/**
 * Drop order drafts that duplicate an activity fill (same date/side/symbol/qty/price).
 * Activities win; orders are only a fallback when the activity stream missed the fill.
 */
export function dedupeSnaptradeOrdersAgainstActivities(
  activities: readonly SnapTradeSyncDraftTransaction[],
  orders: readonly SnapTradeSyncDraftTransaction[],
): { kept: SnapTradeSyncDraftTransaction[]; dropped: number } {
  const activityKeys = new Set<string>();
  for (const t of activities) {
    const k = snaptradeTradeDedupeKey(t);
    if (k) activityKeys.add(k);
  }

  const kept: SnapTradeSyncDraftTransaction[] = [];
  let dropped = 0;
  for (const o of orders) {
    const k = snaptradeTradeDedupeKey(o);
    if (k && activityKeys.has(k)) {
      dropped += 1;
      continue;
    }
    kept.push(o);
  }
  return { kept, dropped };
}
