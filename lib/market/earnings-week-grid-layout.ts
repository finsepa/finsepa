import type {
  EarningsCalendarItem,
  EarningsDayColumn,
  EarningsReportTiming,
  EarningsTimingBucket,
} from "./earnings-calendar-types";
import { canonicalEarningsScopeKey } from "./earnings-scope-filter";

/** Fixed company grid per timing section. */
export const EARNINGS_TIMING_GRID_COLS = 3;
export const EARNINGS_TIMING_GRID_ROWS = 4;
export const EARNINGS_TIMING_GRID_SLOTS = EARNINGS_TIMING_GRID_COLS * EARNINGS_TIMING_GRID_ROWS;

function normalizedEarningsSymbol(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\.US$/i, "")
    .replace(/\//g, ".")
    .replace(/-/g, ".");
}

function earningsGridDedupeKey(it: EarningsCalendarItem): string {
  const base = canonicalEarningsScopeKey(it.ticker);
  return `${it.reportDate}|b:${base}|${it.timing}`;
}

function earningsItemPreferenceScore(it: EarningsCalendarItem): number {
  const raw = normalizedEarningsSymbol(it.ticker);
  let s = 0;
  if (/\.A$/.test(raw)) s -= 200;
  if (/\.(PD|PR|PRB|PRC|PRE|PF|PFD)$/i.test(raw)) s += 120;
  if (/\.P$/.test(raw)) s += 80;
  const rank = it.screenerRank;
  if (rank != null) s += rank;
  s += raw.length * 0.001;
  return s;
}

function pickPreferredEarningsItem(a: EarningsCalendarItem, b: EarningsCalendarItem): EarningsCalendarItem {
  const sa = earningsItemPreferenceScore(a);
  const sb = earningsItemPreferenceScore(b);
  if (sa !== sb) return sa < sb ? a : b;
  const ca = normalizedEarningsSymbol(a.ticker);
  const cb = normalizedEarningsSymbol(b.ticker);
  return ca.localeCompare(cb) <= 0 ? a : b;
}

export function dedupeEarningsCalendarItems(items: readonly EarningsCalendarItem[]): EarningsCalendarItem[] {
  const byKey = new Map<string, EarningsCalendarItem>();
  for (const it of items) {
    const k = earningsGridDedupeKey(it);
    const prev = byKey.get(k);
    byKey.set(k, prev ? pickPreferredEarningsItem(prev, it) : it);
  }
  return [...byKey.values()];
}

/** List view — largest market cap first (`screenerRank` ascending). */
export function sortEarningsCalendarItemsByMarketCap(
  items: readonly EarningsCalendarItem[],
): EarningsCalendarItem[] {
  return [...items].sort((a, b) => {
    const ra = a.screenerRank;
    const rb = b.screenerRank;
    if (ra != null && rb != null && ra !== rb) return ra - rb;
    if (ra != null && rb == null) return -1;
    if (ra == null && rb != null) return 1;
    return a.ticker.localeCompare(b.ticker);
  });
}

export function timingBucketHasContent(bucket: EarningsTimingBucket): boolean {
  return bucket.items.length > 0 || bucket.overflowCount > 0;
}

/** Preview rows needed for one day bucket (expand tile stays in the last grid cell). */
export function computeBucketPreviewGridRows(bucket: EarningsTimingBucket): number {
  if (!timingBucketHasContent(bucket)) return 0;
  const items = dedupeEarningsCalendarItems(bucket.items);
  if (bucket.overflowCount > 0) return EARNINGS_TIMING_GRID_ROWS;
  return Math.min(
    EARNINGS_TIMING_GRID_ROWS,
    Math.ceil(Math.min(items.length, EARNINGS_TIMING_GRID_SLOTS) / EARNINGS_TIMING_GRID_COLS),
  );
}

export type WeekTimingGridRows = Record<EarningsReportTiming, number>;

/** Max preview rows per timing band across the week — keeps sections aligned between columns. */
export function computeWeekTimingGridRows(days: readonly EarningsDayColumn[]): WeekTimingGridRows {
  const rows: WeekTimingGridRows = { bmo: 0, amc: 0, unknown: 0 };
  for (const day of days) {
    rows.bmo = Math.max(rows.bmo, computeBucketPreviewGridRows(day.beforeMarket));
    rows.amc = Math.max(rows.amc, computeBucketPreviewGridRows(day.afterMarket));
    rows.unknown = Math.max(rows.unknown, computeBucketPreviewGridRows(day.timeTbd));
  }
  return rows;
}
