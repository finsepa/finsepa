import type {
  EarningsNotifyCalendarRow,
  EarningsReleaseSnapshotRow,
} from "@/lib/notifications/earnings-notify-types";

export const MAX_REPORT_AGE_DAYS = 14;
export const FIRST_SEEN_MAX_AGE_DAYS = 3;
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

function quarterLabelFromPeriodEndYmd(ymd: string): string {
  const [, ms] = ymd.split("-");
  const m = Number(ms);
  if (!Number.isFinite(m)) return ymd;
  const y = ymd.slice(0, 4);
  return `Q${Math.ceil(m / 3)} ${y}`;
}

function formatEps(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatSurprisePct(pct: number | null): string | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
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
  const epsAct = formatEps(row.epsActual!);
  const epsEst =
    row.epsEstimate != null ? formatEps(row.epsEstimate) : null;
  const surprise = formatSurprisePct(row.surprisePct);

  let body = periodLabel;
  if (epsEst != null) {
    body += ` · EPS $${epsAct} vs $${epsEst} est`;
    if (surprise) body += ` (${surprise})`;
  } else {
    body += ` · EPS $${epsAct}`;
  }

  const href = `/stock/${encodeURIComponent(row.ticker)}?tab=earnings`;

  return {
    row,
    dedupeKey,
    title: `${row.ticker} reported earnings`,
    body,
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
