import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_WARM_LONG } from "@/lib/data/cache-policy";
import {
  extractMarketCapUsdFromFundamentalsRoot,
  fetchEodhdFundamentalsJson,
} from "@/lib/market/eodhd-fundamentals";
import { fetchEodhdEarningsCalendar, type EodhdRawEarningRow } from "@/lib/market/eodhd-earnings-calendar";
import type {
  EarningsCalendarItem,
  EarningsDayColumn,
  EarningsReportTiming,
  EarningsWeekPayload,
} from "@/lib/market/earnings-calendar-types";
import { getTop500Universe } from "@/lib/screener/top500-companies";
import { logoUrlFromFundamentalsRoot } from "@/lib/market/stock-logo-url";
import { runWithConcurrencyLimit } from "@/lib/utils/run-with-concurrency-limit";

/**
 * Default (fast): gate rows with the cached top-by-market-cap universe (`getTop500Universe`): each row must
 * resolve to a symbol with `marketCapUsd >= MIN_MARKET_CAP_USD` from that snapshot (no per-ticker fundamentals).
 * Names outside that universe cannot be priced here without enabling the slow path.
 *
 * Set `EARNINGS_USE_FUNDAMENTALS_MC=1` for per-symbol fundamentals + parsed MC from EODHD (slow; use if you need
 * off–top-500 large caps).
 */
function isEarningsFundamentalsMcFilterEnabled(): boolean {
  return process.env.EARNINGS_USE_FUNDAMENTALS_MC === "1";
}

/** Align screener tickers (e.g. BRK-B) with earnings calendar tickers (BRK.B). */
function earningsUniverseKey(ticker: string): string {
  return ticker
    .trim()
    .toUpperCase()
    .replace(/\.US$/i, "")
    .replace(/-/g, ".");
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function toYmdUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/**
 * Canonical calendar key for placing an earnings row in a day column.
 *
 * - Plain `YYYY-MM-DD` (EODHD’s usual shape): treat as that **UTC calendar day** (noon anchor) so
 *   we never reinterpret it in the server’s local timezone.
 * - ISO datetimes (`…T…Z`, offsets): use **UTC** year/month/day of that instant so the column matches
 *   the same strategy as `toYmdUtc` column headers.
 *
 * We never use fiscal `date` here — only normalized `report_date` (announcement day).
 */
function normalizeReportDateYmdUtc(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [ys, ms, ds] = s.split("-");
    const y = Number(ys);
    const mo = Number(ms);
    const d = Number(ds);
    if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
    const t = Date.UTC(y, mo - 1, d, 12, 0, 0, 0);
    if (!Number.isFinite(t)) return null;
    const check = new Date(t);
    if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
    return `${y}-${pad2(mo)}-${pad2(d)}`;
  }

  const tMs = Date.parse(s);
  if (!Number.isFinite(tMs)) return null;
  return toYmdUtc(new Date(tMs));
}

/** Monday 00:00 UTC of the week containing `date` (week starts Monday). */
export function mondayOfWeekUtc(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

export function addDaysUtc(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

export function parseWeekMondayParam(week: string | undefined): Date | null {
  if (!week?.trim()) return null;
  const t = Date.parse(`${week.trim()}T12:00:00.000Z`);
  if (!Number.isFinite(t)) return null;
  return mondayOfWeekUtc(new Date(t));
}

export function formatWeekRangeLabel(monday: Date, friday: Date): string {
  const sameMonth =
    monday.getUTCMonth() === friday.getUTCMonth() && monday.getUTCFullYear() === friday.getUTCFullYear();
  const monthShort = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const dayNum = (d: Date) => d.getUTCDate();
  const year = (d: Date) => d.getUTCFullYear();
  if (sameMonth) {
    return `${monthShort(monday)} ${dayNum(monday)} – ${dayNum(friday)}, ${year(monday)}`;
  }
  return `${monthShort(monday)} ${dayNum(monday)} – ${monthShort(friday)} ${dayNum(friday)}, ${year(friday)}`;
}

function weekdayShortUtc(ymd: string): string {
  const t = Date.parse(`${ymd}T12:00:00.000Z`);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
}

function timingFromProvider(beforeAfter: string | null | undefined): {
  timing: EarningsReportTiming;
  timingLabel: string;
} {
  const s = (beforeAfter ?? "").toLowerCase();
  if (s.includes("before")) return { timing: "bmo", timingLabel: "BMO" };
  if (s.includes("after")) return { timing: "amc", timingLabel: "AMC" };
  return { timing: "unknown", timingLabel: "" };
}

function isUsStockCode(code: string): boolean {
  return /\.US$/i.test(code) && !/\.CC$/i.test(code);
}

function tickerFromCode(code: string): string {
  return code.replace(/\.US$/i, "").replace(/-/g, ".");
}

function nameFromRawRow(row: EodhdRawEarningRow): string | null {
  const n = row.name ?? row.company_name ?? row.CompanyName;
  if (typeof n === "string" && n.trim()) return n.trim();
  return null;
}

/** Max earnings cards per weekday column (MVP performance). */
const MAX_EARNINGS_PER_DAY = 10;

/** USD — exclude smaller names before enrichment (data quality + fewer downstream calls). */
const MIN_MARKET_CAP_USD = 1_000_000_000;

/**
 * Parallel fundamentals fetches for market-cap filtering. Previously a fixed chunk size of 10 ran
 * chunks **sequentially**; with 300+ symbols that became tens of back-to-back waves and multi‑minute
 * first loads. A bounded pool keeps many requests in flight without unbounded memory.
 */
const EARNINGS_FUNDAMENTALS_CONCURRENCY = 24;

function logEarningsPipelineStats(payload: {
  weekStartYmd: string;
  rawRows: number;
  afterDateFilter: number;
  afterPrimaryListingDedupe: number;
  uniqueTickersFundamentalsFetched: number;
  afterMarketCapFilter: number;
  finalRendered: number;
  filterMode: "universe_mc" | "fundamentals_mc";
  timingMs?: {
    calendar: number;
    parseDedupe: number;
    fundamentalsFetch: number;
    mcFilterSlice: number;
    displayBundles: number;
    total: number;
  };
}) {
  if (process.env.NODE_ENV !== "development") return;
  const droppedDate = payload.rawRows - payload.afterDateFilter;
  const droppedPreferredDup = payload.afterDateFilter - payload.afterPrimaryListingDedupe;
  const droppedMc = payload.afterPrimaryListingDedupe - payload.afterMarketCapFilter;
  console.info("[earnings calendar]", {
    week: payload.weekStartYmd,
    totalRawRows: payload.rawRows,
    afterExactDateDedupe: payload.afterDateFilter,
    droppedByDateOrDedupe: droppedDate,
    afterPrimaryListingDedupe: payload.afterPrimaryListingDedupe,
    droppedPreferredOrSiblingListing: droppedPreferredDup,
    uniqueTickersFundamentalsFetched: payload.uniqueTickersFundamentalsFetched,
    filterMode: payload.filterMode,
    afterMarketCapGte1B: payload.afterMarketCapFilter,
    droppedByMarketCapOrMissing: droppedMc,
    finalRenderedCards: payload.finalRendered,
    ...(payload.timingMs ? { timingMs: payload.timingMs } : {}),
  });
}

type TickerFundamentalsBundle = {
  marketCapUsd: number | null;
  name: string;
  logoUrl: string;
};

type PreparedEarning = {
  ticker: string;
  reportDate: string;
  timing: EarningsReportTiming;
  timingLabel: string;
  fallbackName: string | null;
};

/** Fast path: calendar name + cached universe row — logos empty (UI shows placeholder when missing). */
function fundamentalsBundleFastPath(
  p: PreparedEarning,
  universeByKey: Map<string, { name: string; marketCapUsd: number }>,
): TickerFundamentalsBundle {
  const key = earningsUniverseKey(p.ticker);
  const row = universeByKey.get(key);
  return {
    marketCapUsd: row?.marketCapUsd ?? null,
    name: p.fallbackName ?? row?.name ?? p.ticker,
    logoUrl: "",
  };
}

/** Legacy path: name/logo from cached fundamentals JSON — call only for visible rows. */
function fundamentalsBundleFromRoot(ticker: string, root: Record<string, unknown> | null): TickerFundamentalsBundle {
  if (!root) return { marketCapUsd: null, name: ticker, logoUrl: "" };
  const r = root;
  const marketCapUsd = extractMarketCapUsdFromFundamentalsRoot(r);
  const general = r.General && typeof r.General === "object" ? (r.General as Record<string, unknown>) : null;
  const nameRaw = general?.Name ?? general?.CompanyName ?? general?.ShortName;
  const name = typeof nameRaw === "string" && nameRaw.trim() ? nameRaw.trim() : ticker;
  const logoUrl = logoUrlFromFundamentalsRoot(r);
  return { marketCapUsd, name, logoUrl };
}

/**
 * One fundamentals JSON per ticker (cached per symbol). Used for market-cap gating; failures are
 * isolated so one bad symbol does not fail the week.
 */
async function fetchFundamentalsRootsForMarketCap(
  tickers: string[],
): Promise<Map<string, Record<string, unknown> | null>> {
  const unique = [...new Set(tickers)];
  const rows = await runWithConcurrencyLimit(unique, EARNINGS_FUNDAMENTALS_CONCURRENCY, async (t) => {
    try {
      const root = await fetchEodhdFundamentalsJson(t);
      return { t, root: root as Record<string, unknown> | null };
    } catch {
      return { t, root: null as Record<string, unknown> | null };
    }
  });
  const map = new Map<string, Record<string, unknown> | null>();
  for (const row of rows) {
    map.set(row.t, row.root);
  }
  return map;
}

function timingSortOrder(t: EarningsReportTiming): number {
  if (t === "bmo") return 0;
  if (t === "amc") return 1;
  return 2;
}

function comparePreparedForDay(a: PreparedEarning, b: PreparedEarning): number {
  const ot = timingSortOrder(a.timing) - timingSortOrder(b.timing);
  if (ot !== 0) return ot;
  return a.ticker.localeCompare(b.ticker);
}

/**
 * Keep only US listings, exact normalized report date in Mon–Fri set, one row per (date, ticker).
 * Rows without a parseable `report_date` are skipped (never fall back to fiscal `date`).
 */
function parseFilterDedupeWeek(
  rows: EodhdRawEarningRow[],
  allowedReportDates: Set<string>,
): PreparedEarning[] {
  const seen = new Set<string>();
  const out: PreparedEarning[] = [];
  for (const row of rows) {
    const code = row.code?.trim();
    const rawReport = row.report_date?.trim();
    if (!code || !rawReport || !isUsStockCode(code)) continue;

    const reportDate = normalizeReportDateYmdUtc(rawReport);
    if (!reportDate) continue;
    if (!allowedReportDates.has(reportDate)) continue;

    const ticker = tickerFromCode(code);
    const key = `${reportDate}|${ticker}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const { timing, timingLabel } = timingFromProvider(row.before_after_market);
    out.push({
      ticker,
      reportDate,
      timing,
      timingLabel,
      fallbackName: nameFromRawRow(row),
    });
  }
  return out;
}

/**
 * Preferred / non-common US listings often use a dotted suffix whose last segment matches `P` + alphanumerics
 * (e.g. BAC.PB, BAC.PE, BAC.PK). Those are grouped with the root symbol (BAC) for the same report date so we
 * show one row per issuer — the primary listing — and skip duplicate-looking cards.
 *
 * Excluded from winning when a plain root exists: tickers matching /\.P[A-Z0-9]+$/i (preferred-style suffix).
 * Not collapsed: hyphenated tickers (BRK-A vs BRK-B), single-segment symbols, or dotted suffixes that do not
 * match this pattern (kept separate to avoid merging unrelated names).
 *
 * Winner per (reportDate, issuerGroupKey): lowest `listingRank` (plain symbol without dot first), then shortest
 * ticker, then lexicographic.
 */
const PREFERRED_STYLE_SUFFIX_RE = /\.P[A-Z0-9]+$/i;

function issuerGroupKey(ticker: string): string {
  const t = ticker.trim().toUpperCase();
  const stripped = t.replace(PREFERRED_STYLE_SUFFIX_RE, "");
  if (stripped !== t) return stripped;
  return t;
}

function listingRank(ticker: string): number {
  const t = ticker.toUpperCase();
  if (!t.includes(".")) return 0;
  if (PREFERRED_STYLE_SUFFIX_RE.test(t)) return 2;
  return 1;
}

function dedupePrimaryListings(rows: PreparedEarning[]): PreparedEarning[] {
  const byKey = new Map<string, PreparedEarning[]>();
  for (const row of rows) {
    const gk = `${row.reportDate}|${issuerGroupKey(row.ticker)}`;
    const list = byKey.get(gk) ?? [];
    list.push(row);
    byKey.set(gk, list);
  }
  const out: PreparedEarning[] = [];
  for (const [, candidates] of byKey) {
    if (candidates.length === 1) {
      out.push(candidates[0]!);
      continue;
    }
    candidates.sort((a, b) => {
      const ra = listingRank(a.ticker);
      const rb = listingRank(b.ticker);
      if (ra !== rb) return ra - rb;
      if (a.ticker.length !== b.ticker.length) return a.ticker.length - b.ticker.length;
      return a.ticker.localeCompare(b.ticker);
    });
    out.push(candidates[0]!);
  }
  return out;
}

function preparedToCalendarItem(
  p: PreparedEarning,
  bundle: TickerFundamentalsBundle | undefined,
): EarningsCalendarItem {
  return {
    ticker: p.ticker,
    companyName: p.fallbackName ?? bundle?.name ?? p.ticker,
    logoUrl: bundle?.logoUrl ?? "",
    reportDate: p.reportDate,
    timing: p.timing,
    timingLabel: p.timingLabel,
  };
}

async function buildEarningsWeekPayloadUncached(
  weekMondayUtc: Date,
  strictMc: boolean,
): Promise<EarningsWeekPayload> {
  const t0 = performance.now();
  const monday = new Date(weekMondayUtc);
  const friday = addDaysUtc(monday, 4);
  const fromYmd = toYmdUtc(monday);
  const toYmd = toYmdUtc(friday);

  const weekdayYmds: string[] = [];
  const allowedReportDates = new Set<string>();
  for (let i = 0; i < 5; i++) {
    const ymd = toYmdUtc(addDaysUtc(monday, i));
    weekdayYmds.push(ymd);
    allowedReportDates.add(ymd);
  }

  const tCal0 = performance.now();
  const raw = await fetchEodhdEarningsCalendar(fromYmd, toYmd);
  const msCalendar = performance.now() - tCal0;

  const tParse0 = performance.now();
  const rawCount = raw.length;
  const afterDate = parseFilterDedupeWeek(raw, allowedReportDates);
  const prepared = dedupePrimaryListings(afterDate);
  const msParseDedupe = performance.now() - tParse0;

  const uniqueTickers = [...new Set(prepared.map((p) => p.ticker))];

  let fundamentalsRootByTicker: Map<string, Record<string, unknown> | null> | null = null;
  /** Fast path: one row per normalized ticker key; MC from cached universe (same source as screener top list). */
  const universeByKey = new Map<string, { name: string; marketCapUsd: number }>();

  const tFund0 = performance.now();
  if (strictMc) {
    fundamentalsRootByTicker = await fetchFundamentalsRootsForMarketCap(uniqueTickers);
  } else {
    const universe = await getTop500Universe();
    for (const u of universe) {
      const k = earningsUniverseKey(u.ticker);
      const prev = universeByKey.get(k);
      if (!prev || u.marketCapUsd > prev.marketCapUsd) {
        universeByKey.set(k, { name: u.name, marketCapUsd: u.marketCapUsd });
      }
    }
  }
  const msFundamentalsFetch = performance.now() - tFund0;

  const tMc0 = performance.now();
  let preparedMarketCap: PreparedEarning[];
  if (strictMc) {
    const roots = fundamentalsRootByTicker!;
    preparedMarketCap = prepared.filter((p) => {
      const root = roots.get(p.ticker);
      if (!root) return false;
      const mc = extractMarketCapUsdFromFundamentalsRoot(root);
      return mc != null && mc >= MIN_MARKET_CAP_USD;
    });
  } else if (universeByKey.size === 0) {
    // Failed universe load: do not show unfiltered calendar (would include small caps).
    preparedMarketCap = [];
  } else {
    preparedMarketCap = prepared.filter((p) => {
      const row = universeByKey.get(earningsUniverseKey(p.ticker));
      return row != null && row.marketCapUsd >= MIN_MARKET_CAP_USD;
    });
  }

  const byDate = new Map<string, PreparedEarning[]>();
  for (const p of preparedMarketCap) {
    const list = byDate.get(p.reportDate) ?? [];
    list.push(p);
    byDate.set(p.reportDate, list);
  }

  const slicedByDate = new Map<string, PreparedEarning[]>();
  for (const ymd of weekdayYmds) {
    const list = [...(byDate.get(ymd) ?? [])];
    list.sort(comparePreparedForDay);
    slicedByDate.set(ymd, list.slice(0, MAX_EARNINGS_PER_DAY));
  }

  const visible = weekdayYmds.flatMap((ymd) => slicedByDate.get(ymd) ?? []);
  const msMcFilterSlice = performance.now() - tMc0;

  const tDisp0 = performance.now();
  const bundleByTicker = new Map<string, TickerFundamentalsBundle>();
  for (const p of visible) {
    if (bundleByTicker.has(p.ticker)) continue;
    if (strictMc) {
      const root = fundamentalsRootByTicker!.get(p.ticker) ?? null;
      bundleByTicker.set(p.ticker, fundamentalsBundleFromRoot(p.ticker, root));
    } else {
      bundleByTicker.set(p.ticker, fundamentalsBundleFastPath(p, universeByKey));
    }
  }
  const msDisplayBundles = performance.now() - tDisp0;

  const msTotal = performance.now() - t0;

  logEarningsPipelineStats({
    weekStartYmd: fromYmd,
    rawRows: rawCount,
    afterDateFilter: afterDate.length,
    afterPrimaryListingDedupe: prepared.length,
    uniqueTickersFundamentalsFetched: strictMc ? uniqueTickers.length : 0,
    afterMarketCapFilter: preparedMarketCap.length,
    finalRendered: visible.length,
    filterMode: strictMc ? "fundamentals_mc" : "universe_mc",
    timingMs: {
      calendar: Math.round(msCalendar),
      parseDedupe: Math.round(msParseDedupe),
      fundamentalsFetch: Math.round(msFundamentalsFetch),
      mcFilterSlice: Math.round(msMcFilterSlice),
      displayBundles: Math.round(msDisplayBundles),
      total: Math.round(msTotal),
    },
  });

  const days: EarningsDayColumn[] = [];
  for (let i = 0; i < 5; i++) {
    const d = addDaysUtc(monday, i);
    const ymd = weekdayYmds[i]!;
    const colPrepared = slicedByDate.get(ymd) ?? [];
    const colItems: EarningsCalendarItem[] = colPrepared.map((p) =>
      preparedToCalendarItem(p, bundleByTicker.get(p.ticker)),
    );
    days.push({
      date: ymd,
      weekdayLabel: weekdayShortUtc(ymd),
      dayNumber: String(d.getUTCDate()),
      items: colItems,
    });
  }

  const hasAnyEvents = visible.length > 0;
  return {
    weekMondayYmd: fromYmd,
    weekLabel: formatWeekRangeLabel(monday, friday),
    days,
    hasAnyEvents,
    datasetFilter: strictMc ? "fundamentals_mc" : "universe_mc",
  };
}

type EarningsCacheMode = "universe" | "fund";

const getEarningsWeekPayloadCached = unstable_cache(
  async (weekMondayYmd: string, mode: EarningsCacheMode) => {
    const t = Date.parse(`${weekMondayYmd}T12:00:00.000Z`);
    const monday = Number.isFinite(t) ? mondayOfWeekUtc(new Date(t)) : mondayOfWeekUtc(new Date());
    return buildEarningsWeekPayloadUncached(monday, mode === "fund");
  },
  ["earnings-week-v12"],
  { revalidate: REVALIDATE_WARM_LONG },
);

export async function getEarningsWeekPayload(weekMondayUtc: Date): Promise<EarningsWeekPayload> {
  const ymd = toYmdUtc(mondayOfWeekUtc(weekMondayUtc));
  const mode: EarningsCacheMode = isEarningsFundamentalsMcFilterEnabled() ? "fund" : "universe";
  return getEarningsWeekPayloadCached(ymd, mode);
}
