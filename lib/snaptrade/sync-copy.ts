import { format, parseISO } from "date-fns";

export function formatPortfolioLastSyncLine(syncedAt: string): string {
  const parsed = parseISO(syncedAt);
  if (!Number.isFinite(parsed.getTime())) return "Synced recently";
  return `Synced ${format(parsed, "MMM d 'at' h:mm a")}`;
}

/** Holdings refresh cadence for the connected brokerage. */
export function snapTradeHoldingsCadenceLine(isRealTimeConnection: boolean): string {
  return isRealTimeConnection ?
      "Holdings update when you sync."
    : "Holdings update about once a day.";
}

/** Broker transaction cache policy (same for real-time and daily plans). */
export const SNAPTRADE_TRANSACTIONS_CADENCE_LINE = "New trades can take about a day to show up.";

export const FINSEPA_MANUAL_SYNC_LINE = "Tap Sync anytime to refresh.";

/** Sync modal — incremental update from a chosen date. */
export const SNAPTRADE_SYNC_WITH_DATE_LABEL = "With date";
export const SNAPTRADE_SYNC_WITH_DATE_DESCRIPTION =
  "Updates holdings, cash, and new trades from this date.";

/** Sync modal — full history reload (date cleared / “first transaction”). */
export const SNAPTRADE_SYNC_FIRST_TRANSACTION_LABEL = "First transaction";
export const SNAPTRADE_SYNC_FIRST_TRANSACTION_DESCRIPTION =
  "Pulls your full broker history again. Manual entries stay.";

export const SNAPTRADE_SYNC_NOT_SYNCED_TOOLTIP = "Connected — tap to sync.";

function formatPortfolioSyncTooltipHint(isRealTimeConnection?: boolean | null): string {
  if (isRealTimeConnection === false) {
    return "Tap to refresh. Data may be up to a day old.";
  }
  return "Tap to refresh. New trades can take about a day.";
}

/** Short bullets for Edit portfolio → brokerage connection. */
export function brokerageSyncExplanationBullets(isRealTimeConnection?: boolean | null): string[] {
  const holdingsLine =
    typeof isRealTimeConnection === "boolean" ?
      snapTradeHoldingsCadenceLine(isRealTimeConnection)
    : "Holdings and cash update when you sync, or about once a day automatically.";

  return [
    "We auto-sync about once a day while you use the app.",
    holdingsLine,
    SNAPTRADE_TRANSACTIONS_CADENCE_LINE,
    "Manual sync lets you pick how far back to import trades.",
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
  let firstLine = formatPortfolioLastSyncLine(syncedAt);
  const brokerage = brokerageName?.trim();
  if (brokerage) firstLine = `${firstLine} · ${brokerage}`;
  return `${firstLine}\n${formatPortfolioSyncTooltipHint(isRealTimeConnection)}`;
}
