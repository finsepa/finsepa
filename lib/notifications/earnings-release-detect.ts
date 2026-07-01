import type {
  EarningsNotifyCalendarRow,
  EarningsReleaseSnapshotRow,
} from "@/lib/notifications/earnings-notify-types";
import { quarterLabelFromPeriodEndYmd } from "@/lib/notifications/earnings-notification-model";

export const MAX_REPORT_AGE_DAYS = 14;
export const FIRST_SEEN_MAX_AGE_DAYS = 7;
/** Calendar `symbols=` returns full history — only process recent rows in cron. */
export const EARNINGS_NOTIFY_LOOKBACK_DAYS = 21;

function todayYmdUtc(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function daysBetweenYmd(fromYmd: string, toYmd: string): number {
  const a = Date.parse(`${fromYmd}T12:00:00.000Z`);
  const b = Date.parse(`${toYmd}T12:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.POSITIVE_INFINITY;
  return Math.floor(Math.abs(b - a) / 86_400_000);
}

export type DetectedEarningsRelease = {
  row: EarningsNotifyCalendarRow;
  dedupeKey: string;
  title: string;
  body: string;
  href: string;
  payload: Record<string, unknown>;
};

export function isRecentEarningsCalendarRow(
  row: EarningsNotifyCalendarRow,
  today = todayYmdUtc(),
  lookbackDays = EARNINGS_NOTIFY_LOOKBACK_DAYS,
): boolean {
  if (!row.reportDateYmd) return false;
  return daysBetweenYmd(row.reportDateYmd, today) <= lookbackDays;
}

export function shouldNotifyEarningsRelease(
  prev: EarningsReleaseSnapshotRow | null,
  row: EarningsNotifyCalendarRow,
  today = todayYmdUtc(),
): boolean {
  if (row.epsActual == null) return false;
  const reportYmd = row.reportDateYmd;
  if (!reportYmd) return false;

  const age = daysBetweenYmd(reportYmd, today);
  if (age > MAX_REPORT_AGE_DAYS) return false;

  if (!prev) {
    return age <= FIRST_SEEN_MAX_AGE_DAYS;
  }

  const hadActual = prev.eps_actual != null && Number.isFinite(prev.eps_actual);
  return !hadActual;
}

export function buildEarningsReleaseNotification(
  row: EarningsNotifyCalendarRow,
): DetectedEarningsRelease {
  const periodLabel = quarterLabelFromPeriodEndYmd(row.fiscalPeriodEndYmd!);
  const dedupeKey = `${row.ticker}:${row.fiscalPeriodEndYmd}`;
  const href = `/stock/${encodeURIComponent(row.ticker)}?tab=earnings`;

  return {
    row,
    dedupeKey,
    title: `${row.ticker} reported earnings`,
    body: periodLabel,
    href,
    payload: {
      ticker: row.ticker,
      fiscalPeriodLabel: periodLabel,
      fiscalPeriodEndYmd: row.fiscalPeriodEndYmd,
      reportDateYmd: row.reportDateYmd,
      epsActual: row.epsActual,
      epsEstimate: row.epsEstimate,
      surprisePct: row.surprisePct,
      href,
    },
  };
}
