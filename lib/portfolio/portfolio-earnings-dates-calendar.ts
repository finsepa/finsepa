import "server-only";

import { unstable_cache } from "next/cache";

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
  isEarningsNotifiableTicker,
} from "@/lib/notifications/ticker-notify-eligibility";
import { usCalendarCode } from "@/lib/notifications/earnings-calendar-batch";
import { isSupportedCryptoAssetSymbol } from "@/lib/crypto/crypto-logo-url";
import { cryptoRouteBase } from "@/lib/crypto/crypto-symbol-base";
import { isStockDetailEtf } from "@/lib/stock/stock-etf";

/** Max tickers per POST. */
export const PORTFOLIO_EARNINGS_DATES_MAX_SYMBOLS = 240;

/** Look ahead ~2 quarters for the next report date. */
const FORWARD_DAYS = 180;
/**
 * One whole-market call (1 EODHD credit; `symbols=` would bill per ticker) shared by every user.
 * Report dates move rarely.
 */
const CALENDAR_MARKET_REVALIDATE_SEC = 3 * 3600;

export type PortfolioEarningsDatesResult = {
  bySymbol: Record<string, PortfolioEarningsDateEntry>;
  /** True when a calendar batch failed — entries without a date are unknown, not "no earnings". */
  incomplete: boolean;
};

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

/** Upcoming earnings dates from one shared whole-market EODHD calendar window. */
export async function buildPortfolioEarningsDatesFromCalendar(
  symbols: readonly string[],
): Promise<PortfolioEarningsDatesResult> {
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

  if (calendarTickers.length === 0) return { bySymbol, incomplete: false };

  if (!getEodhdApiKey()) return { bySymbol, incomplete: true };

  const { from, to } = forwardWindow();
  let nextByTicker: Record<string, string>;
  try {
    nextByTicker = await getCachedUpcomingReportDates(from, to);
  } catch {
    return { bySymbol, incomplete: true };
  }

  for (const sym of unique) {
    if (bySymbol[sym]?.notApplicable) continue;
    const ymd = nextByTicker[canonicalNotifyTicker(sym)];
    bySymbol[sym] = ymd ? entryFromYmd(ymd) : emptyEntry();
  }

  return { bySymbol, incomplete: false };
}

/**
 * Whole-market forward window reduced to `canonical ticker → earliest report date` (~4k US tickers).
 * Throws on any upstream failure so `unstable_cache` never stores an empty miss as "no earnings".
 */
async function fetchUpcomingReportDatesByTicker(from: string, to: string): Promise<Record<string, string>> {
  const apiToken = getEodhdApiKey();
  if (!apiToken) throw new Error("EODHD key missing");

  const params = new URLSearchParams({ from, to, api_token: apiToken, fmt: "json" });
  const url = `https://eodhd.com/api/calendar/earnings?${params.toString()}`;

  if (!traceEodhdHttp("fetchPortfolioEarningsDatesCalendarMarket", { from, to })) {
    throw new Error("EODHD request budget exhausted");
  }
  const res = await fetchEodhd(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`EODHD calendar HTTP ${res.status}`);
  const json = (await res.json()) as { earnings?: unknown };
  const arr = json?.earnings;
  if (!Array.isArray(arr)) throw new Error("EODHD calendar: malformed payload");

  const out: Record<string, string> = {};
  for (const raw of arr) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const code = usCalendarCode(o.code);
    if (!code) continue;
    const ticker = canonicalNotifyTicker(code.replace(/\.US$/i, "").replace(/-/g, "."));
    const reportDateYmd =
      parseReportYmd(o.report_date ?? o.ReportDate ?? o.reportDate) ?? parseReportYmd(o.date);
    if (!reportDateYmd || reportDateYmd < from) continue;
    const prev = out[ticker];
    if (!prev || reportDateYmd < prev) out[ticker] = reportDateYmd;
  }
  if (Object.keys(out).length === 0) throw new Error("EODHD calendar: no US rows");
  return out;
}

const getCachedUpcomingReportDates = unstable_cache(
  async (from: string, to: string) => fetchUpcomingReportDatesByTicker(from, to),
  ["portfolio-earnings-calendar-market-v1"],
  { revalidate: CALENDAR_MARKET_REVALIDATE_SEC },
);
