import "server-only";

import { fetchStockEarningsTabPayloadIrOnly } from "@/lib/market/stock-earnings-tab-data";
import {
  buildIrVaultTickerReport,
  isIrVaultAllowedUrl,
  loadEarningsIrVaultForTickers,
  mergeEarningsIrVaultRows,
} from "@/lib/market/earnings-ir-vault-store";
import { listEarningsIrVaultUniverse } from "@/lib/market/earnings-ir-vault-universe";
import {
  EARNINGS_IR_VAULT_IR_PDF_ONLY_TICKERS,
  EARNINGS_IR_VAULT_TOP_N,
  isIrVaultPeriodInScope,
  type EarningsIrVaultTickerReport,
} from "@/lib/market/earnings-ir-vault-types";
import { fetchEodhdEarningsCalendar } from "@/lib/market/eodhd-earnings-calendar";
import {
  previousUsTradingSessionYmd,
  usEquityNyCalendarYmd,
} from "@/lib/market/us-equity-market-session";

function vaultUrlPreferringIrPdf(ticker: string, url: string | null | undefined): string | null {
  if (!isIrVaultAllowedUrl(url)) return null;
  if (EARNINGS_IR_VAULT_IR_PDF_ONLY_TICKERS.has(ticker) && /sec\.gov/i.test(url)) return null;
  return url;
}

export type EarningsIrVaultBackfillTickerResult = {
  ticker: string;
  quartersSeen: number;
  written: number;
  report: EarningsIrVaultTickerReport;
  error?: string;
};

export type EarningsIrVaultBackfillResult = {
  at: string;
  topN: number;
  tickers: string[];
  perTicker: EarningsIrVaultBackfillTickerResult[];
  summary: { green: number; yellow: number; red: number };
};

/**
 * IR-only resolve for one ticker (no SEC), merge into vault with lock-once semantics,
 * ensure empty placeholder rows exist for every in-scope reported quarter.
 */
export async function backfillEarningsIrVaultForTicker(
  listingTicker: string,
): Promise<EarningsIrVaultBackfillTickerResult> {
  const ticker = listingTicker.trim().toUpperCase();
  try {
    const payload = await fetchStockEarningsTabPayloadIrOnly(ticker);
    const history = (payload?.history ?? []).filter(
      (r) => r.reported && isIrVaultPeriodInScope(r.fiscalPeriodEndYmd),
    );

    const expected = history
      .filter((r): r is typeof r & { fiscalPeriodEndYmd: string } => Boolean(r.fiscalPeriodEndYmd))
      .map((r) => ({
        fiscalPeriodEndYmd: r.fiscalPeriodEndYmd,
        fiscalPeriodLabel: r.fiscalPeriodLabel,
        reportDateYmd: r.reportDateYmd,
      }));

    const mergeRows = expected.map((q) => {
      const row = history.find((h) => h.fiscalPeriodEndYmd === q.fiscalPeriodEndYmd);
      return {
        ticker,
        fiscalPeriodEndYmd: q.fiscalPeriodEndYmd,
        fiscalPeriodLabel: q.fiscalPeriodLabel,
        reportDateYmd: q.reportDateYmd,
        slidesUrl: vaultUrlPreferringIrPdf(ticker, row?.secSlidesUrl),
        filingsUrl: vaultUrlPreferringIrPdf(ticker, row?.secFilingsUrl),
        irWebsite: payload?.documentHub.irWebsite ?? payload?.documentHub.companyWebsite ?? null,
        resolutionNote: "ir_only_backfill",
      };
    });

    const { written } = await mergeEarningsIrVaultRows(mergeRows);
    const stored = await loadEarningsIrVaultForTickers([ticker]);
    const report = buildIrVaultTickerReport(ticker, stored, expected);

    return {
      ticker,
      quartersSeen: expected.length,
      written,
      report,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "backfill_failed";
    return {
      ticker,
      quartersSeen: 0,
      written: 0,
      report: {
        ticker,
        irWebsite: null,
        quarters: [],
        green: 0,
        yellow: 0,
        red: 0,
        trafficLight: "red",
      },
      error: message,
    };
  }
}

export async function backfillEarningsIrVaultUniverse(
  options?: { topN?: number; tickers?: readonly string[] },
): Promise<EarningsIrVaultBackfillResult> {
  const topN = options?.topN ?? EARNINGS_IR_VAULT_TOP_N;
  const tickers = options?.tickers?.length
    ? [...options.tickers].map((t) => t.trim().toUpperCase()).filter(Boolean)
    : await listEarningsIrVaultUniverse(topN);

  const perTicker: EarningsIrVaultBackfillTickerResult[] = [];
  for (const ticker of tickers) {
    perTicker.push(await backfillEarningsIrVaultForTicker(ticker));
  }

  const summary = perTicker.reduce(
    (acc, row) => {
      if (row.report.trafficLight === "green") acc.green += 1;
      else if (row.report.trafficLight === "yellow") acc.yellow += 1;
      else acc.red += 1;
      return acc;
    },
    { green: 0, yellow: 0, red: 0 },
  );

  return {
    at: new Date().toISOString(),
    topN,
    tickers,
    perTicker,
    summary,
  };
}

function listingTickerFromCalendarCode(code: string | undefined): string | null {
  const raw = code?.trim().toUpperCase();
  if (!raw) return null;
  return raw.replace(/\.US$/i, "").replace(/\./g, "-");
}

function calendarReportYmd(reportDate: string | undefined): string | null {
  const raw = reportDate?.trim() ?? "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return null;
}

/**
 * Earnings-day watcher: IR-resolve vault names reporting today in America/New_York
 * (calendar + incomplete vault rows). Open+1 also retries the prior session so late AMC
 * PDFs are not stuck until the next earnings date. Full top-N is `mode=backfill`.
 */
export async function pullEarningsIrVaultForRecentReports(
  options?: { topN?: number; now?: Date; includePriorSession?: boolean },
): Promise<EarningsIrVaultBackfillResult> {
  const topN = options?.topN ?? EARNINGS_IR_VAULT_TOP_N;
  const now = options?.now ?? new Date();
  const includePriorSession = options?.includePriorSession ?? true;
  const universe = await listEarningsIrVaultUniverse(topN);
  const universeSet = new Set(universe);
  const nyToday = usEquityNyCalendarYmd(now);
  const priorSession = includePriorSession ? previousUsTradingSessionYmd(nyToday) : null;

  const recent = new Set<string>();
  const calRows = await fetchEodhdEarningsCalendar(nyToday, nyToday);
  for (const row of calRows) {
    const ticker = listingTickerFromCalendarCode(row.code);
    if (!ticker || !universeSet.has(ticker)) continue;
    const reportYmd = calendarReportYmd(row.report_date);
    if (reportYmd && reportYmd !== nyToday) continue;
    recent.add(ticker);
  }

  const stored = await loadEarningsIrVaultForTickers(universe);
  for (const row of stored) {
    if (!row.report_date) continue;
    const onToday = row.report_date === nyToday;
    const onPrior = priorSession != null && row.report_date === priorSession;
    if (!onToday && !onPrior) continue;
    if (row.slides_locked && row.filings_locked) continue;
    recent.add(row.ticker.trim().toUpperCase());
  }

  const tickers = universe.filter((t) => recent.has(t));
  const perTicker: EarningsIrVaultBackfillTickerResult[] = [];
  for (const ticker of tickers) {
    perTicker.push(await backfillEarningsIrVaultForTicker(ticker));
  }

  const summary = perTicker.reduce(
    (acc, row) => {
      if (row.report.trafficLight === "green") acc.green += 1;
      else if (row.report.trafficLight === "yellow") acc.yellow += 1;
      else acc.red += 1;
      return acc;
    },
    { green: 0, yellow: 0, red: 0 },
  );

  return {
    at: new Date().toISOString(),
    topN,
    tickers,
    perTicker,
    summary,
  };
}

export function formatIrVaultChecklistText(result: EarningsIrVaultBackfillResult): string {
  const lines: string[] = [];
  lines.push(`Earnings IR vault checklist @ ${result.at}`);
  lines.push(`Universe: top ${result.topN} (${result.tickers.length} tickers)`);
  lines.push(
    `Summary: green=${result.summary.green} yellow=${result.summary.yellow} red=${result.summary.red}`,
  );
  lines.push("");

  for (const row of result.perTicker) {
    const light = row.report.trafficLight.toUpperCase();
    lines.push(
      `[${light}] ${row.ticker}  G${row.report.green}/Y${row.report.yellow}/R${row.report.red}  quarters=${row.quartersSeen} written=${row.written}${row.error ? ` ERROR=${row.error}` : ""}`,
    );
    for (const q of row.report.quarters) {
      const mark =
        q.trafficLight === "green" ? "OK" : q.trafficLight === "yellow" ? "PARTIAL" : "MISS";
      lines.push(
        `  ${mark} ${q.fiscalPeriodLabel ?? q.fiscalPeriodEndYmd}  slides=${q.slidesStatus} filings=${q.filingsStatus}  reports=${q.reportCount}`,
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}
