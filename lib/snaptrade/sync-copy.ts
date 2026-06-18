import { format, parseISO } from "date-fns";

export function formatPortfolioLastSyncLine(syncedAt: string): string {
  const parsed = parseISO(syncedAt);
  if (!Number.isFinite(parsed.getTime())) return "Last synced recently";
  return `Last synced at ${format(parsed, "MMM d, yyyy 'at' h:mm a")}`;
}

/** SnapTrade holdings refresh cadence for the connected brokerage. */
export function snapTradeHoldingsCadenceLine(isRealTimeConnection: boolean): string {
  return isRealTimeConnection ?
      "Holdings refresh on each sync (SnapTrade real-time)"
    : "Holdings refresh about once per day via SnapTrade";
}

/** SnapTrade transaction cache policy (same for real-time and daily plans). */
export const SNAPTRADE_TRANSACTIONS_CADENCE_LINE =
  "Transactions update once per day (T+1) via SnapTrade";

export const FINSEPA_MANUAL_SYNC_LINE = "Click the sync icon next to the portfolio name to refresh anytime.";

/** Short bullets for Edit portfolio → brokerage connection. */
export function brokerageSyncExplanationBullets(isRealTimeConnection?: boolean | null): string[] {
  const holdingsLine =
    typeof isRealTimeConnection === "boolean" ?
      snapTradeHoldingsCadenceLine(isRealTimeConnection)
    : "Holdings and cash refresh when you sync or once per day automatically.";

  return [
    "Finsepa syncs linked portfolios automatically about once a day while you use the app.",
    holdingsLine,
    SNAPTRADE_TRANSACTIONS_CADENCE_LINE,
    "Manual sync imports transactions from your chosen start date and always refreshes current holdings and cash.",
    "If broker balances differ from imported history, Finsepa adds small adjustments so positions stay correct.",
    FINSEPA_MANUAL_SYNC_LINE,
  ];
}

export function formatPortfolioSyncTooltipLines({
  syncedAt,
  brokerageName,
  isRealTimeConnection,
}: {
  syncedAt: string;
  brokerageName?: string | null;
  isRealTimeConnection?: boolean | null;
}): string {
  const lines = [formatPortfolioLastSyncLine(syncedAt)];
  const brokerage = brokerageName?.trim();
  if (brokerage) lines.push(brokerage);
  if (typeof isRealTimeConnection === "boolean") {
    lines.push(snapTradeHoldingsCadenceLine(isRealTimeConnection));
  }
  lines.push(SNAPTRADE_TRANSACTIONS_CADENCE_LINE);
  lines.push(FINSEPA_MANUAL_SYNC_LINE);
  return lines.join("\n");
}
