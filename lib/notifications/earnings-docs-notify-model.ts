/** In-app + APNs kinds for earnings document availability (Pro activity alerts). */
export const EARNINGS_SLIDES_KIND = "earnings_slides_available" as const;
export const EARNINGS_REPORTS_KIND = "earnings_reports_available" as const;

export type EarningsDocsNotifyKind =
  | typeof EARNINGS_SLIDES_KIND
  | typeof EARNINGS_REPORTS_KIND;

/** Only notify for quarters reported within this many days (matches earnings-results window). */
export const EARNINGS_DOCS_NOTIFY_MAX_REPORT_AGE_DAYS = 14;

export type EarningsDocsAvailabilityEvent = {
  ticker: string;
  fiscalPeriodEndYmd: string;
  reportDateYmd: string | null;
  kind: EarningsDocsNotifyKind;
  /** Slides URL or first SEC report URL (8-K preferred). */
  documentUrl: string | null;
};

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

/** Recent report only — skips historical vault/cache backfill spam. */
export function isRecentEarningsDocsReportDate(
  reportDateYmd: string | null | undefined,
  today = todayYmdUtc(),
  maxAgeDays = EARNINGS_DOCS_NOTIFY_MAX_REPORT_AGE_DAYS,
): boolean {
  if (!reportDateYmd || !/^\d{4}-\d{2}-\d{2}$/.test(reportDateYmd)) return false;
  return daysBetweenYmd(reportDateYmd, today) <= maxAgeDays;
}

export function formatEarningsDocsPeriodLabel(fiscalPeriodEndYmd: string): string {
  const [, ms] = fiscalPeriodEndYmd.split("-");
  const m = Number(ms);
  if (!Number.isFinite(m)) return fiscalPeriodEndYmd;
  const y = fiscalPeriodEndYmd.slice(0, 4);
  return `Q${Math.ceil(m / 3)} · ${y}`;
}

export function formatEarningsSlidesPushCopy(args: {
  ticker: string;
  periodLabel: string;
}): { title: string; body: string } {
  const ticker = args.ticker.trim().toUpperCase();
  return {
    title: `${ticker} slides available`,
    body: `${args.periodLabel} earnings presentation is ready`,
  };
}

export function formatEarningsReportsPushCopy(args: {
  ticker: string;
  periodLabel: string;
}): { title: string; body: string } {
  const ticker = args.ticker.trim().toUpperCase();
  return {
    title: `${ticker} SEC reports available`,
    body: `${args.periodLabel} 8-K or 10-Q/10-K filing is ready`,
  };
}

export function earningsDocsDedupeKey(
  kind: EarningsDocsNotifyKind,
  ticker: string,
  fiscalPeriodEndYmd: string,
): string {
  return `${ticker.trim().toUpperCase()}:${fiscalPeriodEndYmd}:${kind === EARNINGS_SLIDES_KIND ? "slides" : "reports"}`;
}

/**
 * Diff prior cache vs next persisted URLs.
 * Slides: first presentation PDF.
 * Reports: first time either 8-K or 10-Q/10-K appears (one notify for the pair).
 */
export function detectNewlyAvailableEarningsDocs(args: {
  ticker: string;
  fiscalPeriodEndYmd: string;
  reportDateYmd: string | null;
  priorSlides: string | null;
  nextSlides: string | null;
  priorEightK: string | null;
  nextEightK: string | null;
  priorForm10: string | null;
  nextForm10: string | null;
}): EarningsDocsAvailabilityEvent[] {
  const ticker = args.ticker.trim().toUpperCase();
  if (!ticker || !args.fiscalPeriodEndYmd) return [];
  if (!isRecentEarningsDocsReportDate(args.reportDateYmd)) return [];

  const out: EarningsDocsAvailabilityEvent[] = [];

  if (args.nextSlides && !args.priorSlides) {
    out.push({
      ticker,
      fiscalPeriodEndYmd: args.fiscalPeriodEndYmd,
      reportDateYmd: args.reportDateYmd,
      kind: EARNINGS_SLIDES_KIND,
      documentUrl: args.nextSlides,
    });
  }

  const priorHadReport = Boolean(args.priorEightK || args.priorForm10);
  const nextReportUrl = args.nextEightK || args.nextForm10;
  if (nextReportUrl && !priorHadReport) {
    out.push({
      ticker,
      fiscalPeriodEndYmd: args.fiscalPeriodEndYmd,
      reportDateYmd: args.reportDateYmd,
      kind: EARNINGS_REPORTS_KIND,
      documentUrl: nextReportUrl,
    });
  }

  return out;
}
