import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_EARNINGS_CALENDAR } from "@/lib/data/cache-policy";
import { extractMarketCapUsdFromFundamentalsRoot, fetchEodhdFundamentalsJson } from "@/lib/market/eodhd-fundamentals";
import { fetchEodhdEarningsCalendar, type EodhdRawEarningRow } from "@/lib/market/eodhd-earnings-calendar";
import type {
  EarningsCalendarItem,
  EarningsDayColumn,
  EarningsReportTiming,
  EarningsTimingBucket,
  EarningsTimingBucketId,
  EarningsWeekPayload,
} from "@/lib/market/earnings-calendar-types";
import { logoUrlFromFundamentalsRoot } from "@/lib/market/stock-logo-url";
import { listTop500EquityTickersOrdered } from "@/lib/screener/screener-earnings-universe";
import { getScreenerCompaniesStaticLayer } from "@/lib/screener/screener-companies-layers";
import { resolveEquityLogoUrlFromListingTicker } from "@/lib/screener/resolve-equity-logo-url";
import { TOP10_META, TOP10_TICKERS, type Top10Ticker } from "@/lib/screener/top10-config";
import { issuerKeyForOtcListingCollapse } from "@/lib/market/otc-duplicate-tickers";
import { runWithConcurrencyLimit } from "@/lib/utils/run-with-concurrency-limit";

/**
 * Symbols: Top-500 US equities from the Screener static universe (market-cap order). Calendar rows outside
 * that list are ignored (no per-user fan-out to fundamentals for hundreds of off-universe names).
 *
 * Set `EARNINGS_USE_FUNDAMENTALS_MC=1` to fetch fundamentals JSON for MC gating on calendar-matched tickers only.
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

/** Top-500 US equities (market-cap order) plus curated Top-10, as normalized earnings keys. */
function buildScreenerStockAllowKeys(universe: readonly { ticker: string }[]): Set<string> {
  const keys = new Set(listTop500EquityTickersOrdered(universe).map((t) => earningsUniverseKey(t)));
  for (const t of TOP10_TICKERS) {
    keys.add(earningsUniverseKey(t));
  }
  return keys;
}

/** True if `ticker` is in the Top-500 earnings universe — use to gate earnings preview API. */
export async function isTickerOnScreenerEarningsUniverse(ticker: string): Promise<boolean> {
  const { universe } = await getScreenerCompaniesStaticLayer();
  return buildScreenerStockAllowKeys(universe).has(earningsUniverseKey(ticker));
}

function buildScreenerUniverseMapForEarnings(
  staticUniverse: ReadonlyArray<{ ticker: string; name: string; marketCapUsd: number }>,
  allowKeys: Set<string>,
): Map<string, { name: string; marketCapUsd: number }> {
  const universeByKey = new Map<string, { name: string; marketCapUsd: number }>();
  for (const u of staticUniverse) {
    const k = earningsUniverseKey(u.ticker);
    if (!allowKeys.has(k)) continue;
    const mc =
      typeof u.marketCapUsd === "number" && Number.isFinite(u.marketCapUsd) ? u.marketCapUsd : 0;
    const prev = universeByKey.get(k);
    if (!prev || mc > prev.marketCapUsd) {
      universeByKey.set(k, { name: u.name.trim() || u.ticker, marketCapUsd: mc });
    }
  }
  for (const t of TOP10_TICKERS) {
    const tt = t as Top10Ticker;
    const k = earningsUniverseKey(tt);
    if (universeByKey.has(k)) continue;
    universeByKey.set(k, { name: TOP10_META[tt].name, marketCapUsd: 0 });
  }
  return universeByKey;
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
    return `${monthShort(monday)} ${dayNum(monday)} - ${dayNum(friday)}, ${year(monday)}`;
  }
  return `${monthShort(monday)} ${dayNum(monday)} - ${monthShort(friday)} ${dayNum(friday)}, ${year(friday)}`;
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

/**
 * EODHD bulk `calendar/earnings` often emits `TSLA` / `BRK-B` without a `.US` suffix; we previously skipped
 * those rows in {@link parseFilterDedupeWeek} because {@link isUsStockCode} required `.US`.
 * If `code` already contains `.` and is not `…US`, we do not guess (e.g. `SAP.DE`); the feed must use `…US`
 * for US listings with a dot in the symbol.
 */
function normalizeEarningsCalendarCodeToUs(code: string): string | null {
  const c = code.trim();
  if (!c) return null;
  if (/\.CC$/i.test(c)) return null;
  if (/\.US$/i.test(c)) return c;
  if (c.includes(".")) return null;
  if (!/^[A-Za-z0-9\-]+$/i.test(c)) return null;
  return `${c}.US`;
}

function tickerFromCode(code: string): string {
  return code.replace(/\.US$/i, "").replace(/-/g, ".");
}

function nameFromRawRow(row: EodhdRawEarningRow): string | null {
  const n = row.name ?? row.company_name ?? row.CompanyName;
  if (typeof n === "string" && n.trim()) return n.trim();
  return null;
}

/**
 * USD — exclude smaller names before enrichment (data quality + fewer downstream calls).
 */
const MIN_MARKET_CAP_USD = 1_000_000_000;

/** Max earnings rows per weekday column before timing split (calendar density cap). */
const EARNINGS_TOP500_PER_DAY_CAP = 48;
/** SSR + initial paint: first N names per timing bucket; overflow loads via `/api/earnings/week-bucket`. */
const EARNINGS_BUCKET_PREVIEW_COUNT = 7;

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
  afterScreenerAllowlist: number;
  uniqueTickersFundamentalsFetched: number;
  afterMarketCapFilter: number;
  finalPreparedRows: number;
  previewCardsRendered: number;
  overflowRowsPrepared: number;
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
  const droppedScreener = payload.afterPrimaryListingDedupe - payload.afterScreenerAllowlist;
  const droppedMc = payload.afterScreenerAllowlist - payload.afterMarketCapFilter;
  console.info("[earnings calendar]", {
    week: payload.weekStartYmd,
    totalRawRows: payload.rawRows,
    afterExactDateDedupe: payload.afterDateFilter,
    droppedByDateOrDedupe: droppedDate,
    afterPrimaryListingDedupe: payload.afterPrimaryListingDedupe,
    droppedPreferredOrSiblingListing: droppedPreferredDup,
    afterScreenerAllowlist: payload.afterScreenerAllowlist,
    droppedNotOnScreener: droppedScreener,
    finalPreparedRows: payload.finalPreparedRows,
    previewCardsRendered: payload.previewCardsRendered,
    overflowRowsPrepared: payload.overflowRowsPrepared,
    uniqueTickersFundamentalsFetched: payload.uniqueTickersFundamentalsFetched,
    filterMode: payload.filterMode,
    afterMarketCapGte1B: payload.afterMarketCapFilter,
    droppedByMarketCapOrMissing: droppedMc,
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

/** Fast path: calendar name + cached universe row — logos match screener (Logo.dev / top-10 domains). */
function fundamentalsBundleFastPath(
  p: PreparedEarning,
  universeByKey: Map<string, { name: string; marketCapUsd: number }>,
): TickerFundamentalsBundle {
  const key = earningsUniverseKey(p.ticker);
  const row = universeByKey.get(key);
  return {
    marketCapUsd: row?.marketCapUsd ?? null,
    name: p.fallbackName ?? row?.name ?? p.ticker,
    logoUrl: resolveEquityLogoUrlFromListingTicker(p.ticker),
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
  const logoUrl = logoUrlFromFundamentalsRoot(r, ticker);
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

/**
 * Before {@link EARNINGS_TOP500_PER_DAY_CAP}: sort by static-universe market cap (largest first), then
 * screener rank. Sorting only by timing (all BMO before AMC) would drop every after-market name when a
 * weekday has 48+ before-market rows — e.g. large AMC reporters like INTC never reached the bucket split.
 */
function sortPreparedForDayCap(
  rows: readonly PreparedEarning[],
  universeByKey: ReadonlyMap<string, { marketCapUsd: number }>,
  rankByKey: ReadonlyMap<string, number>,
): PreparedEarning[] {
  return [...rows].sort((a, b) => {
    const ka = earningsUniverseKey(a.ticker);
    const kb = earningsUniverseKey(b.ticker);
    const mcA = universeByKey.get(ka)?.marketCapUsd ?? 0;
    const mcB = universeByKey.get(kb)?.marketCapUsd ?? 0;
    if (mcB !== mcA) return mcB - mcA;
    const ra = rankByKey.get(ka) ?? 99_999;
    const rb = rankByKey.get(kb) ?? 99_999;
    if (ra !== rb) return ra - rb;
    return a.ticker.localeCompare(b.ticker);
  });
}

/**
 * One row per (report date, universe ticker): listing collapse can still surface duplicate issuers for the
 * same calendar cell; keep the first occurrence in {@link preparedMarketCap} iteration order.
 */
function dedupePreparedByReportDateAndTicker(rows: readonly PreparedEarning[]): PreparedEarning[] {
  const out: PreparedEarning[] = [];
  const seen = new Set<string>();
  for (const p of rows) {
    const k = `${p.reportDate}|${earningsUniverseKey(p.ticker)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}

/** Within one timing bucket: largest market cap first (grid reads L→R, T→B), unknown caps last. */
function sortPreparedByMarketCapUsdDesc(
  rows: readonly PreparedEarning[],
  bundleByTicker: ReadonlyMap<string, TickerFundamentalsBundle>,
): PreparedEarning[] {
  const mcFor = (ticker: string): number | null => {
    const mc = bundleByTicker.get(ticker)?.marketCapUsd;
    return mc != null && Number.isFinite(mc) && mc > 0 ? mc : null;
  };
  return [...rows].sort((a, b) => {
    const ma = mcFor(a.ticker);
    const mb = mcFor(b.ticker);
    if (ma == null && mb == null) return a.ticker.localeCompare(b.ticker);
    if (ma == null) return 1;
    if (mb == null) return -1;
    if (mb !== ma) return mb - ma;
    return a.ticker.localeCompare(b.ticker);
  });
}

function splitPreparedByTiming(rows: readonly PreparedEarning[]): {
  bmo: PreparedEarning[];
  amc: PreparedEarning[];
  unknown: PreparedEarning[];
} {
  const bmo: PreparedEarning[] = [];
  const amc: PreparedEarning[] = [];
  const unknown: PreparedEarning[] = [];
  for (const p of rows) {
    if (p.timing === "bmo") bmo.push(p);
    else if (p.timing === "amc") amc.push(p);
    else unknown.push(p);
  }
  return { bmo, amc, unknown };
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
    const rawCode = row.code?.trim();
    const canon = rawCode ? normalizeEarningsCalendarCodeToUs(rawCode) : null;
    const rawReport = row.report_date?.trim();
    if (!canon || !rawReport || !isUsStockCode(canon)) continue;

    const reportDate = normalizeReportDateYmdUtc(rawReport);
    if (!reportDate) continue;
    if (!allowedReportDates.has(reportDate)) continue;

    const ticker = tickerFromCode(canon);
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
  const t = ticker.trim().toUpperCase().replace(/-/g, ".");
  const afterOtc = issuerKeyForOtcListingCollapse(t);
  const stripped = afterOtc.replace(PREFERRED_STYLE_SUFFIX_RE, "");
  if (stripped !== afterOtc) return stripped;
  return afterOtc;
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

function buildScreenerRankByOrderedTickers(tickersOrdered: readonly string[]): Map<string, number> {
  const map = new Map<string, number>();
  tickersOrdered.forEach((t, i) => {
    map.set(earningsUniverseKey(t), i + 1);
  });
  return map;
}

function preparedToCalendarItem(
  p: PreparedEarning,
  bundle: TickerFundamentalsBundle | undefined,
  rankByKey: Map<string, number>,
): EarningsCalendarItem {
  const key = earningsUniverseKey(p.ticker);
  return {
    ticker: p.ticker,
    companyName: p.fallbackName ?? bundle?.name ?? p.ticker,
    logoUrl: bundle?.logoUrl ?? "",
    screenerRank: rankByKey.get(key) ?? null,
    reportDate: p.reportDate,
    timing: p.timing,
    timingLabel: p.timingLabel,
  };
}

type EarningsWeekDataPackage = {
  payload: EarningsWeekPayload;
  overflowByKey: Record<string, EarningsCalendarItem[]>;
};

async function buildEarningsWeekDataPackageUncached(
  weekMondayUtc: Date,
  strictMc: boolean,
): Promise<EarningsWeekDataPackage> {
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

  const { universe: staticUniverse } = await getScreenerCompaniesStaticLayer();
  const top500TickerList = listTop500EquityTickersOrdered(staticUniverse);
  const allowKeys = buildScreenerStockAllowKeys(staticUniverse);
  const screenerRankByKey = buildScreenerRankByOrderedTickers(top500TickerList);
  const preparedScreener = prepared.filter((p) => allowKeys.has(earningsUniverseKey(p.ticker)));

  const uniqueTickers = [...new Set(preparedScreener.map((p) => p.ticker))];

  let fundamentalsRootByTicker: Map<string, Record<string, unknown> | null> | null = null;
  const universeByKey = buildScreenerUniverseMapForEarnings(staticUniverse, allowKeys);

  const tFund0 = performance.now();
  if (strictMc) {
    fundamentalsRootByTicker = await fetchFundamentalsRootsForMarketCap(uniqueTickers);
  }
  const msFundamentalsFetch = performance.now() - tFund0;

  const tMc0 = performance.now();
  let preparedMarketCap: PreparedEarning[];
  if (strictMc) {
    const roots = fundamentalsRootByTicker!;
    preparedMarketCap = preparedScreener.filter((p) => {
      const root = roots.get(p.ticker);
      if (!root) return false;
      const mc = extractMarketCapUsdFromFundamentalsRoot(root);
      return mc != null && mc >= MIN_MARKET_CAP_USD;
    });
  } else if (universeByKey.size === 0) {
    preparedMarketCap = [];
  } else {
    preparedMarketCap = preparedScreener;
  }

  const preparedForWeek = dedupePreparedByReportDateAndTicker(preparedMarketCap);

  const byDate = new Map<string, PreparedEarning[]>();
  for (const p of preparedForWeek) {
    const list = byDate.get(p.reportDate) ?? [];
    list.push(p);
    byDate.set(p.reportDate, list);
  }

  const slicedByDate = new Map<string, PreparedEarning[]>();
  for (const ymd of weekdayYmds) {
    const list = sortPreparedForDayCap(byDate.get(ymd) ?? [], universeByKey, screenerRankByKey);
    slicedByDate.set(ymd, list.slice(0, EARNINGS_TOP500_PER_DAY_CAP));
  }

  const cappedFlat = weekdayYmds.flatMap((ymd) => slicedByDate.get(ymd) ?? []);
  const msMcFilterSlice = performance.now() - tMc0;

  const tDisp0 = performance.now();
  const bundleByTicker = new Map<string, TickerFundamentalsBundle>();
  for (const p of cappedFlat) {
    if (bundleByTicker.has(p.ticker)) continue;
    if (strictMc) {
      const root = fundamentalsRootByTicker!.get(p.ticker) ?? null;
      const b = fundamentalsBundleFromRoot(p.ticker, root);
      if (!b.logoUrl.trim()) b.logoUrl = resolveEquityLogoUrlFromListingTicker(p.ticker);
      bundleByTicker.set(p.ticker, b);
    } else {
      bundleByTicker.set(p.ticker, fundamentalsBundleFastPath(p, universeByKey));
    }
  }
  const msDisplayBundles = performance.now() - tDisp0;

  const overflowByKey: Record<string, EarningsCalendarItem[]> = {};

  function bucketForTiming(ymd: string, timing: EarningsReportTiming, timingRows: PreparedEarning[]): EarningsTimingBucket {
    const ordered = sortPreparedByMarketCapUsdDesc(timingRows, bundleByTicker);
    const preview = ordered.slice(0, EARNINGS_BUCKET_PREVIEW_COUNT);
    const rest = ordered.slice(EARNINGS_BUCKET_PREVIEW_COUNT);
    const key = `${ymd}:${timing}`;
    overflowByKey[key] = rest.map((p) =>
      preparedToCalendarItem(p, bundleByTicker.get(p.ticker), screenerRankByKey),
    );
    return {
      items: preview.map((p) => preparedToCalendarItem(p, bundleByTicker.get(p.ticker), screenerRankByKey)),
      overflowCount: rest.length,
    };
  }

  const days: EarningsDayColumn[] = [];
  let previewCardsRendered = 0;
  for (let i = 0; i < 5; i++) {
    const d = addDaysUtc(monday, i);
    const ymd = weekdayYmds[i]!;
    const colPrepared = slicedByDate.get(ymd) ?? [];
    const { bmo, amc, unknown } = splitPreparedByTiming(colPrepared);
    const beforeMarket = bucketForTiming(ymd, "bmo", bmo);
    const afterMarket = bucketForTiming(ymd, "amc", amc);
    const timeTbd = bucketForTiming(ymd, "unknown", unknown);
    previewCardsRendered += beforeMarket.items.length + afterMarket.items.length + timeTbd.items.length;
    days.push({
      date: ymd,
      weekdayLabel: weekdayShortUtc(ymd),
      dayNumber: String(d.getUTCDate()),
      beforeMarket,
      afterMarket,
      timeTbd,
    });
  }

  const overflowRowsPrepared = Object.values(overflowByKey).reduce((n, xs) => n + xs.length, 0);
  const msTotal = performance.now() - t0;

  logEarningsPipelineStats({
    weekStartYmd: fromYmd,
    rawRows: rawCount,
    afterDateFilter: afterDate.length,
    afterPrimaryListingDedupe: prepared.length,
    afterScreenerAllowlist: preparedScreener.length,
    uniqueTickersFundamentalsFetched: strictMc ? uniqueTickers.length : 0,
    afterMarketCapFilter: preparedMarketCap.length,
    finalPreparedRows: preparedForWeek.length,
    previewCardsRendered,
    overflowRowsPrepared,
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

  const hasAnyEvents =
    previewCardsRendered > 0 ||
    days.some(
      (day) =>
        day.beforeMarket.overflowCount + day.afterMarket.overflowCount + day.timeTbd.overflowCount > 0,
    );
  const payload: EarningsWeekPayload = {
    weekMondayYmd: fromYmd,
    weekLabel: formatWeekRangeLabel(monday, friday),
    days,
    hasAnyEvents,
    datasetFilter: strictMc ? "fundamentals_mc" : "universe_mc",
  };

  return { payload, overflowByKey };
}

type EarningsCacheMode = "universe" | "fund";

const getEarningsWeekDataPackageCached = unstable_cache(
  async (weekMondayYmd: string, mode: EarningsCacheMode): Promise<EarningsWeekDataPackage> => {
    const t = Date.parse(`${weekMondayYmd}T12:00:00.000Z`);
    const monday = Number.isFinite(t) ? mondayOfWeekUtc(new Date(t)) : mondayOfWeekUtc(new Date());
    return buildEarningsWeekDataPackageUncached(monday, mode === "fund");
  },
  ["earnings-week-v26-calendar-bare-us"],
  { revalidate: REVALIDATE_EARNINGS_CALENDAR },
);

async function getEarningsWeekDataPackage(weekMondayUtc: Date): Promise<EarningsWeekDataPackage> {
  const ymd = toYmdUtc(mondayOfWeekUtc(weekMondayUtc));
  const mode: EarningsCacheMode = isEarningsFundamentalsMcFilterEnabled() ? "fund" : "universe";
  return getEarningsWeekDataPackageCached(ymd, mode);
}

export async function getEarningsWeekPayload(weekMondayUtc: Date): Promise<EarningsWeekPayload> {
  const pack = await getEarningsWeekDataPackage(weekMondayUtc);
  return pack.payload;
}

/** Overflow cards for one weekday timing bucket — backed by the same `unstable_cache` entry as the week grid. */
export async function getEarningsTimingBucketOverflow(
  weekMondayUtc: Date,
  dayYmd: string,
  timing: EarningsTimingBucketId,
): Promise<EarningsCalendarItem[]> {
  const monday = mondayOfWeekUtc(weekMondayUtc);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayYmd)) return [];
  let inWeek = false;
  for (let i = 0; i < 5; i++) {
    if (toYmdUtc(addDaysUtc(monday, i)) === dayYmd) {
      inWeek = true;
      break;
    }
  }
  if (!inWeek) return [];

  const pack = await getEarningsWeekDataPackage(weekMondayUtc);
  return pack.overflowByKey[`${dayYmd}:${timing}`] ?? [];
}
