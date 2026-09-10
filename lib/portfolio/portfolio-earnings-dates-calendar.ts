import "server-only";

import { getEodhdApiKey } from "@/lib/env/server";
import {
  earningsDaysLeftFromYmd,
  parseEarningsReportYmd,
} from "@/lib/market/earnings-countdown";
import { fetchEodhd } from "@/lib/market/eodhd-fetch";
import { traceEodhdHttp } from "@/lib/market/provider-trace";
import type { PortfolioEarningsDateEntry } from "@/lib/portfolio/portfolio-earnings-dates";
import {
  canonicalNotifyTicker,
  eodhdCalendarCodeFromTicker,
  isEarningsNotifiableTicker,
} from "@/lib/notifications/ticker-notify-eligibility";
import { chunkTickers, EARNINGS_NOTIFY_CALENDAR_BATCH_SIZE } from "@/lib/notifications/earnings-calendar-batch";
import { isSupportedCryptoAssetSymbol } from "@/lib/crypto/crypto-logo-url";
import { cryptoRouteBase } from "@/lib/crypto/crypto-symbol-base";
import { isStockDetailEtf } from "@/lib/stock/stock-etf";

/** Max tickers per POST — chunked into {@link EARNINGS_NOTIFY_CALENDAR_BATCH_SIZE} EODHD calls. */
export const PORTFOLIO_EARNINGS_DATES_MAX_SYMBOLS = 240;

/** Look ahead ~2 quarters for the next report date. */
const FORWARD_DAYS = 180;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function utcYmd(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function forwardWindow(): { from: string; to: string } {
  const from = new Date();
  const to = new Date();
  to.setUTCDate(to.getUTCDate() + FORWARD_DAYS);
  return { from: utcYmd(from), to: utcYmd(to) };
}

function ymdToDisplay(ymd: string): string {
  const parsed = parseEarningsReportYmd(ymd);
  if (!parsed) return ymd;
  return new Date(parsed.utcMs).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function naEntry(): PortfolioEarningsDateEntry {
  return {
    earningsDateDisplay: null,
    fiscalQuarter: null,
    earningsDateYmd: null,
    daysLeft: null,
    notApplicable: true,
  };
}

function emptyEntry(): PortfolioEarningsDateEntry {
  return {
    earningsDateDisplay: null,
    fiscalQuarter: null,
    earningsDateYmd: null,
    daysLeft: null,
    notApplicable: false,
  };
}

function entryFromYmd(ymd: string): PortfolioEarningsDateEntry {
  return {
    earningsDateDisplay: ymdToDisplay(ymd),
    fiscalQuarter: null,
    earningsDateYmd: ymd,
    daysLeft: earningsDaysLeftFromYmd(ymd),
    notApplicable: false,
  };
}

function parseReportYmd(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;
  return utcYmd(new Date(t));
}

type CalendarHit = { ticker: string; reportDateYmd: string };

/**
 * Upcoming earnings dates via EODHD `calendar/earnings?symbols=` (chunked).
 * ~1 API credit per 80 tickers — replaces per-symbol fundamentals fan-out.
 */
export async function buildPortfolioEarningsDatesFromCalendar(
  symbols: readonly string[],
): Promise<Record<string, PortfolioEarningsDateEntry>> {
  const unique = [
    ...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean)),
  ].slice(0, PORTFOLIO_EARNINGS_DATES_MAX_SYMBOLS);

  const bySymbol: Record<string, PortfolioEarningsDateEntry> = {};
  const calendarTickers: string[] = [];

  for (const sym of unique) {
    const cryptoKey = cryptoRouteBase(sym);
    if (isSupportedCryptoAssetSymbol(cryptoKey) || isStockDetailEtf(sym)) {
      bySymbol[sym] = naEntry();
      continue;
    }
    if (!isEarningsNotifiableTicker(sym)) {
      bySymbol[sym] = naEntry();
      continue;
    }
    calendarTickers.push(canonicalNotifyTicker(sym));
    bySymbol[sym] = emptyEntry();
  }

  if (calendarTickers.length === 0) return bySymbol;

  const key = getEodhdApiKey();
  if (!key) return bySymbol;

  const { from, to } = forwardWindow();
  const today = utcYmd(new Date());
  const nextByTicker = new Map<string, string>();

  for (const batch of chunkTickers(calendarTickers, EARNINGS_NOTIFY_CALENDAR_BATCH_SIZE)) {
    const hits = await fetchUpcomingCalendarBatch(batch, from, to, key);
    for (const hit of hits) {
      if (hit.reportDateYmd < today) continue;
      const prev = nextByTicker.get(hit.ticker);
      if (!prev || hit.reportDateYmd < prev) {
        nextByTicker.set(hit.ticker, hit.reportDateYmd);
      }
    }
  }

  for (const sym of unique) {
    if (bySymbol[sym]?.notApplicable) continue;
    const canonical = canonicalNotifyTicker(sym);
    const ymd = nextByTicker.get(canonical);
    bySymbol[sym] = ymd ? entryFromYmd(ymd) : emptyEntry();
  }

  return bySymbol;
}

async function fetchUpcomingCalendarBatch(
  canonicalTickers: readonly string[],
  from: string,
  to: string,
  apiToken: string,
): Promise<CalendarHit[]> {
  if (canonicalTickers.length === 0) return [];

  const symbols = canonicalTickers.map(eodhdCalendarCodeFromTicker).join(",");
  const params = new URLSearchParams({
    symbols,
    from,
    to,
    api_token: apiToken,
    fmt: "json",
  });
  const url = `https://eodhd.com/api/calendar/earnings?${params.toString()}`;

  try {
    if (!traceEodhdHttp("fetchPortfolioEarningsDatesCalendarBatch", { count: canonicalTickers.length })) {
      return [];
    }
    const res = await fetchEodhd(url, { cache: "no-store" });
    if (!res.ok) return [];
    const json = (await res.json()) as { earnings?: unknown };
    const arr = json?.earnings;
    if (!Array.isArray(arr)) return [];

    const out: CalendarHit[] = [];
    for (const raw of arr) {
      if (!raw || typeof raw !== "object") continue;
      const o = raw as Record<string, unknown>;
      const code = typeof o.code === "string" ? o.code.trim().toUpperCase() : "";
      if (!code.endsWith(".US")) continue;
      const ticker = canonicalNotifyTicker(code.replace(/\.US$/i, "").replace(/-/g, "."));
      const reportDateYmd =
        parseReportYmd(o.report_date ?? o.ReportDate ?? o.reportDate) ?? parseReportYmd(o.date);
      if (!reportDateYmd) continue;
      out.push({ ticker, reportDateYmd });
    }
    return out;
  } catch {
    return [];
  }
}
