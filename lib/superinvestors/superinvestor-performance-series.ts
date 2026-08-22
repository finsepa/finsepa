import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_WARM_LONG } from "@/lib/data/cache-policy";
import { loadPortfolioEodBars } from "@/lib/portfolio/data/load-portfolio-eod-bars";
import {
  SUPERINVESTOR_PERFORMANCE_LOOKBACK_YEARS,
  loadSuperinvestorPerformanceBooks,
  type SuperinvestorPerformanceBook,
} from "@/lib/superinvestors/berkshire-13f";
import { superinvestorDisplayNameForSlug } from "@/lib/superinvestors/superinvestor-display-names";
import {
  readSuperinvestorPerformanceSnapshot,
  readSuperinvestorPerformanceSnapshotRow,
  shouldSkipSuperinvestorPerformanceRebuild,
  upsertSuperinvestorPerformanceSnapshot,
} from "@/lib/superinvestors/superinvestor-performance-snapshot";
import {
  SUPERINVESTOR_PERF_NOTIONAL_USD,
  SUPERINVESTOR_PERFORMANCE_CRON_SLUGS,
  isSuperinvestorPerformanceEnabled,
  superinvestorPerformanceSlugsForShard,
  type SuperinvestorPerformancePoint,
  type SuperinvestorPerformanceSeries,
} from "@/lib/superinvestors/superinvestor-performance-types";
import { SUPERINVESTOR_SLUG_CIK } from "@/lib/superinvestors/superinvestor-slug-cik";

export type { SuperinvestorPerformancePoint, SuperinvestorPerformanceSeries };
export { SUPERINVESTOR_PERF_NOTIONAL_USD, isSuperinvestorPerformanceEnabled };

const SPY_TICKER = "SPY";
/** Skip days where too few holdings have prices (avoids fake crash-to-zero). */
const MIN_COVERAGE = 0.45;
/** Cap names per book so EOD fan-out stays bounded. */
const MAX_POSITIONS_PER_BOOK = 40;
/** Daily MTM only for this recent window; older history is weekly + filing turns. */
const DAILY_EVAL_LOOKBACK_DAYS = 90;

function ymdYearsAgo(years: number, fromYmd = new Date().toISOString().slice(0, 10)): string {
  const [y, m, d] = fromYmd.split("-").map((x) => Number(x));
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCFullYear(dt.getUTCFullYear() - years);
  return dt.toISOString().slice(0, 10);
}

function ymdDaysAgo(days: number, fromYmd: string): string {
  const [y, m, d] = fromYmd.split("-").map((x) => Number(x));
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() - days);
  return dt.toISOString().slice(0, 10);
}

function closeOnOrBefore(
  barsByYmd: Map<string, number>,
  sortedYmds: string[],
  ymd: string,
): number | null {
  if (barsByYmd.has(ymd)) return barsByYmd.get(ymd)!;
  let lo = 0;
  let hi = sortedYmds.length - 1;
  let best: string | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const d = sortedYmds[mid]!;
    if (d <= ymd) {
      best = d;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best != null ? (barsByYmd.get(best) ?? null) : null;
}

function indexBars(bars: { date: string; close: number }[]): {
  byYmd: Map<string, number>;
  sorted: string[];
} {
  const byYmd = new Map<string, number>();
  for (const b of bars) {
    const d = b.date?.slice(0, 10);
    if (!d || !Number.isFinite(b.close) || b.close <= 0) continue;
    byYmd.set(d, b.close);
  }
  return { byYmd, sorted: [...byYmd.keys()].sort() };
}

function trimBookPositions(book: SuperinvestorPerformanceBook): SuperinvestorPerformanceBook {
  if (book.positions.length <= MAX_POSITIONS_PER_BOOK) return book;
  const positions = [...book.positions]
    .sort((a, b) => b.shares - a.shares)
    .slice(0, MAX_POSITIONS_PER_BOOK);
  return { ...book, positions };
}

function bookValueUsd(
  book: SuperinvestorPerformanceBook,
  priceLookup: (ticker: string, ymd: string) => number | null,
  ymd: string,
): { value: number; coverage: number } {
  let value = 0;
  let priced = 0;
  let total = 0;
  for (const p of book.positions) {
    total += 1;
    const px = priceLookup(p.ticker, ymd);
    if (px == null) continue;
    priced += 1;
    value += p.shares * px;
  }
  return { value, coverage: total > 0 ? priced / total : 0 };
}

function activeBookIndex(books: SuperinvestorPerformanceBook[], ymd: string): number {
  let idx = -1;
  for (let i = 0; i < books.length; i++) {
    if (books[i]!.reportDate <= ymd) idx = i;
    else break;
  }
  return idx;
}

function selectEvalDays(sessionDays: string[], books: SuperinvestorPerformanceBook[]): string[] {
  if (sessionDays.length === 0) return [];
  const toYmd = sessionDays[sessionDays.length - 1]!;
  const dailyFrom = ymdDaysAgo(DAILY_EVAL_LOOKBACK_DAYS, toYmd);

  const turnDays = new Set<string>();
  let si = 0;
  for (const book of books) {
    while (si < sessionDays.length && sessionDays[si]! < book.reportDate) si += 1;
    if (si < sessionDays.length) turnDays.add(sessionDays[si]!);
  }

  const out: string[] = [];
  for (let i = 0; i < sessionDays.length; i++) {
    const d = sessionDays[i]!;
    if (i === 0 || i === sessionDays.length - 1) {
      out.push(d);
      continue;
    }
    if (d >= dailyFrom) {
      out.push(d);
      continue;
    }
    if (turnDays.has(d)) {
      out.push(d);
      continue;
    }
    if (new Date(`${d}T12:00:00Z`).getUTCDay() === 1) out.push(d);
  }
  return out;
}

/**
 * Chain returns within each 13F book; do not treat share-count changes
 * between filings as P&L (that would look like fake crashes on sells).
 * Throws on failure so {@link unstable_cache} does not persist a null/empty result.
 */
async function buildSuperinvestorPerformanceSeriesUncached(
  slug: string,
): Promise<SuperinvestorPerformanceSeries> {
  const existing = await readSuperinvestorPerformanceSnapshotRow(slug);
  if (existing && shouldSkipSuperinvestorPerformanceRebuild(existing)) {
    return existing.series;
  }

  const cik = SUPERINVESTOR_SLUG_CIK[slug];
  if (!cik) {
    throw new Error("performance_unknown_slug");
  }

  const booksRaw = await loadSuperinvestorPerformanceBooks(cik);
  if (booksRaw.length < 2) {
    throw new Error("performance_books_unavailable");
  }

  const toYmd = new Date().toISOString().slice(0, 10);
  const targetFromYmd = ymdYearsAgo(SUPERINVESTOR_PERFORMANCE_LOOKBACK_YEARS, toYmd);
  let firstKeep = 0;
  for (let i = 0; i < booksRaw.length; i++) {
    if (booksRaw[i]!.reportDate <= targetFromYmd) firstKeep = i;
    else break;
  }
  const books = booksRaw.slice(firstKeep).map(trimBookPositions);
  if (books.length < 2) {
    throw new Error("performance_books_short");
  }

  const fromYmd = books[0]!.reportDate <= targetFromYmd ? targetFromYmd : books[0]!.reportDate;
  const barsFromYmd = books[0]!.reportDate;

  const tickers = new Set<string>([SPY_TICKER]);
  for (const b of books) {
    for (const p of b.positions) tickers.add(p.ticker);
  }

  const barsMap = await loadPortfolioEodBars([...tickers], barsFromYmd, toYmd, { retry: true });
  const indexed = new Map<string, { byYmd: Map<string, number>; sorted: string[] }>();
  for (const [sym, bars] of barsMap) {
    indexed.set(sym, indexBars(bars));
  }

  const spyIdx = indexed.get(SPY_TICKER);
  if (!spyIdx || spyIdx.sorted.length < 2) {
    throw new Error("performance_spy_bars_unavailable");
  }

  const priceLookup = (ticker: string, ymd: string): number | null => {
    const ix = indexed.get(ticker);
    if (!ix) return null;
    return closeOnOrBefore(ix.byYmd, ix.sorted, ymd);
  };

  const sessionDays = spyIdx.sorted.filter((d) => d >= fromYmd && d <= toYmd);
  if (sessionDays.length < 2) {
    throw new Error("performance_session_days_short");
  }
  const evalDays = selectEvalDays(sessionDays, books);
  if (evalDays.length < 2) {
    throw new Error("performance_eval_days_short");
  }

  let bookIndex = 1;
  let spyIndex = 1;
  let prevBookValue: number | null = null;
  let prevSpyPx: number | null = null;
  let prevBookIdx = -1;
  let coveragePct: number | null = null;
  const raw: SuperinvestorPerformancePoint[] = [];

  for (const ymd of evalDays) {
    const bi = activeBookIndex(books, ymd);
    if (bi < 0) continue;
    const { value, coverage } = bookValueUsd(books[bi]!, priceLookup, ymd);
    if (value <= 0 || coverage < MIN_COVERAGE) continue;
    const spyPx = priceLookup(SPY_TICKER, ymd);
    if (spyPx == null || spyPx <= 0) continue;

    if (prevBookValue == null || prevSpyPx == null) {
      prevBookValue = value;
      prevSpyPx = spyPx;
      prevBookIdx = bi;
      coveragePct = coverage * 100;
      raw.push({
        t: ymd,
        bookReturnPct: 0,
        spyReturnPct: 0,
        bookProfitUsd: 0,
        spyProfitUsd: 0,
      });
      continue;
    }

    if (bi === prevBookIdx) {
      bookIndex *= value / prevBookValue;
    }
    spyIndex *= spyPx / prevSpyPx;

    prevBookValue = value;
    prevSpyPx = spyPx;
    prevBookIdx = bi;

    raw.push({
      t: ymd,
      bookReturnPct: (bookIndex - 1) * 100,
      spyReturnPct: (spyIndex - 1) * 100,
      bookProfitUsd: SUPERINVESTOR_PERF_NOTIONAL_USD * (bookIndex - 1),
      spyProfitUsd: SUPERINVESTOR_PERF_NOTIONAL_USD * (spyIndex - 1),
    });
  }

  if (raw.length < 2) {
    throw new Error("performance_series_empty");
  }

  const series: SuperinvestorPerformanceSeries = {
    slug,
    label: superinvestorDisplayNameForSlug(slug),
    benchmarkLabel: "S&P 500",
    notionalUsd: SUPERINVESTOR_PERF_NOTIONAL_USD,
    fromYmd: raw[0]!.t,
    toYmd: raw[raw.length - 1]!.t,
    points: raw,
    coveragePct,
    disclaimer:
      "Estimated from SEC 13F long equity holdings, marked to market between filings. Not fund NAV or investor returns. Excludes cash, shorts, options, and non‑US names.",
  };

  void upsertSuperinvestorPerformanceSnapshot(slug, series);
  return series;
}

function getSuperinvestorPerformanceSeriesCached(slug: string) {
  return unstable_cache(
    () => buildSuperinvestorPerformanceSeriesUncached(slug),
    ["superinvestor-performance-v8-durable", slug],
    { revalidate: REVALIDATE_WARM_LONG },
  )();
}

export async function loadSuperinvestorPerformanceSeries(
  slug: string,
): Promise<SuperinvestorPerformanceSeries | null> {
  if (!isSuperinvestorPerformanceEnabled(slug)) return null;

  // User path: durable snapshot only. SEC rebuild is cron/ops via {@link rebuildSuperinvestorPerformanceSeries}.
  return readSuperinvestorPerformanceSnapshot(slug);
}

/** Cron / authenticated ops: rebuild performance series from SEC + EOD and persist. */
export async function rebuildSuperinvestorPerformanceSeries(
  slug: string,
): Promise<SuperinvestorPerformanceSeries | null> {
  if (!isSuperinvestorPerformanceEnabled(slug)) return null;
  if (!SUPERINVESTOR_SLUG_CIK[slug]) return null;

  try {
    return await getSuperinvestorPerformanceSeriesCached(slug);
  } catch {
    try {
      return await buildSuperinvestorPerformanceSeriesUncached(slug);
    } catch (error) {
      console.error(
        "[superinvestor-performance] rebuild failed",
        slug,
        error instanceof Error ? error.message : error,
      );
      return null;
    }
  }
}

export type SuperinvestorPerformanceRebuildResult = {
  slug: string;
  ok: boolean;
  skipped?: boolean;
};

async function rebuildSuperinvestorPerformanceSlugs(
  slugs: readonly string[],
): Promise<SuperinvestorPerformanceRebuildResult[]> {
  const results: SuperinvestorPerformanceRebuildResult[] = [];

  for (const slug of slugs) {
    const row = await readSuperinvestorPerformanceSnapshotRow(slug);
    if (row && shouldSkipSuperinvestorPerformanceRebuild(row)) {
      results.push({ slug, ok: true, skipped: true });
      continue;
    }

    const series = await rebuildSuperinvestorPerformanceSeries(slug);
    results.push({ slug, ok: Boolean(series) });
  }

  return results;
}

/** Warm performance for every cron slug (ops / manual). */
export async function rebuildAllEnabledSuperinvestorPerformanceSeries(): Promise<
  SuperinvestorPerformanceRebuildResult[]
> {
  return rebuildSuperinvestorPerformanceSlugs(SUPERINVESTOR_PERFORMANCE_CRON_SLUGS);
}

/** Sharded cron warm — ~5 managers per shard when shards=6. */
export async function rebuildSuperinvestorPerformanceShard(args: {
  shard: number;
  shards: number;
}): Promise<SuperinvestorPerformanceRebuildResult[]> {
  const slugs = superinvestorPerformanceSlugsForShard(args.shard, args.shards);
  return rebuildSuperinvestorPerformanceSlugs(slugs);
}
