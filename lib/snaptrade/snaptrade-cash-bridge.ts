/**
 * Pure helpers for Connected cash NAV bridging (no SDK / server-only).
 */

import { format, parseISO, subDays } from "date-fns";

import type { SnapTradeSyncDraftTransaction } from "@/lib/snaptrade/snaptrade-normalize-activity";

export function cashBridgeNote(brokerCash: number, ledgerCash: number): string {
  return `Opening cash inferred to match brokerage (broker $${brokerCash.toFixed(2)}, ledger was $${ledgerCash.toFixed(2)}). Funding activity was missing from the broker API.`;
}

/** Day before earliest activity so Dietz/NAV treat cash as funded before first trade. */
export function openingCashBridgeDate(
  txs: readonly Pick<SnapTradeSyncDraftTransaction, "date">[],
  syncDate: string,
): string {
  let earliest: string | null = null;
  for (const t of txs) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date)) continue;
    if (earliest == null || t.date < earliest) earliest = t.date;
  }
  if (!earliest) return syncDate;
  try {
    return format(subDays(parseISO(earliest), 1), "yyyy-MM-dd");
  } catch {
    return syncDate;
  }
}
