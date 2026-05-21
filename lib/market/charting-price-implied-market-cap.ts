import "server-only";

import { format, parse, subDays } from "date-fns";

import type { ChartingSeriesPoint, FundamentalsSeriesMode } from "@/lib/market/charting-series-types";
import { fetchEodhdEodDaily, type EodhdDailyBar } from "@/lib/market/eodhd-eod";

/** UTC calendar YYYY-MM-DD from fiscal `periodEnd` (matches charting period keys). */
export function chartingPeriodEndToUtcYmd(periodEnd: string): string | null {
  const raw = periodEnd.trim();
  if (!raw) return null;
  const ts = Date.parse(raw.includes("T") ? raw : `${raw}T12:00:00.000Z`);
  if (!Number.isFinite(ts)) return null;
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Last daily bar with `date <= ymd` (bars sorted ascending by `date`). */
function adjustedCloseOnOrBefore(bars: EodhdDailyBar[], ymd: string): number | null {
  let lo = 0;
  let hi = bars.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (bars[mid]!.date <= ymd) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (best < 0) return null;
  const c = bars[best]!.close;
  return Number.isFinite(c) && c > 0 ? c : null;
}

function eodFetchWindow(points: ChartingSeriesPoint[]): { from: string; to: string } | null {
  const ymds: string[] = [];
  for (const p of points) {
    const y = chartingPeriodEndToUtcYmd(p.periodEnd);
    if (y) ymds.push(y);
  }
  if (!ymds.length) return null;
  ymds.sort((a, b) => a.localeCompare(b));
  const minYmd = ymds[0]!;
  const maxYmd = ymds[ymds.length - 1]!;
  try {
    const minDate = parse(minYmd, "yyyy-MM-dd", new Date());
    const from = format(subDays(minDate, 50), "yyyy-MM-dd");
    return { from, to: maxYmd };
  } catch {
    return null;
  }
}

/** Aligns with {@link MAX_DERIVED_VALUATION_MULTIPLE} in `eodhd-charting-series` for chart sanity. */
const MAX_IMPLIED_VAL_MULTIPLE = 5000;

function impliedMultipleOk(m: number): boolean {
  return Number.isFinite(m) && m > 0 && m < MAX_IMPLIED_VAL_MULTIPLE;
}

const TTM_ROLLING_QUARTERS = 4;

/** Sum of `netIncome` or per-share `eps` over up to four fiscal quarters ending at `index`. */
function rollingTtmSum(
  sorted: ChartingSeriesPoint[],
  index: number,
  field: "netIncome" | "eps",
): number | null {
  const start = Math.max(0, index - (TTM_ROLLING_QUARTERS - 1));
  let sum = 0;
  let n = 0;
  for (let i = start; i <= index; i++) {
    const v = sorted[i]![field];
    if (v == null || !Number.isFinite(v)) continue;
    sum += v;
    n += 1;
  }
  return n > 0 && sum > 1e-6 ? sum : null;
}

/** Period-end P/E from modelled market cap; quarterly uses trailing-four-quarter earnings (TTM). */
function deriveTrailingPeFromImpliedMarketCap(
  p: ChartingSeriesPoint,
  sorted: ChartingSeriesPoint[],
  index: number,
  mode: FundamentalsSeriesMode,
): number | null {
  const mc = p.marketCap;
  if (mc == null || !Number.isFinite(mc) || mc <= 0) return null;

  const sh = p.sharesOutstanding;
  const useTtm = mode === "quarterly";
  const ttmEps = useTtm ? rollingTtmSum(sorted, index, "eps") : null;
  const eps = useTtm ? ttmEps : p.eps;

  if (
    eps != null &&
    sh != null &&
    Number.isFinite(eps) &&
    Number.isFinite(sh) &&
    eps > 1e-6 &&
    sh > 1e-6
  ) {
    const pe = mc / sh / eps;
    if (impliedMultipleOk(pe)) return pe;
  }

  const ttmNi = useTtm ? rollingTtmSum(sorted, index, "netIncome") : null;
  const ni = useTtm ? ttmNi : p.netIncome;
  if (ni != null && Number.isFinite(ni) && ni > 1e-6) {
    const pe = mc / ni;
    if (impliedMultipleOk(pe)) return pe;
  }

  return null;
}

/**
 * Fills fiscal `peRatio` / `trailingPe` from modelled market cap (run after
 * {@link enrichChartingPointsWithPriceImpliedMarketCap}). Quarterly mode uses TTM earnings
 * (sum of last four quarters), matching ratios tables on other platforms — not MC ÷ one quarter NI.
 */
export function enrichChartingPointsWithTrailingPeFromImpliedMarketCap(
  points: ChartingSeriesPoint[],
  mode: FundamentalsSeriesMode = "annual",
): void {
  const sorted = [...points].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
  const indexByPeriod = new Map(sorted.map((row, i) => [row.periodEnd, i] as const));

  for (const p of points) {
    const index = indexByPeriod.get(p.periodEnd);
    if (index == null) continue;

    const derived = deriveTrailingPeFromImpliedMarketCap(p, sorted, index, mode);
    if (derived == null) continue;

    const existing = p.peRatio ?? p.trailingPe;
    if (mode === "annual" && existing != null && impliedMultipleOk(existing)) continue;

    p.peRatio = derived;
    p.trailingPe = derived;
  }
}

/**
 * Aligns the latest fiscal bar with Key Stats live P/E (Highlights `PERatio` / `TrailingPE`).
 */
export function patchLatestChartingPointLiveTrailingPe(
  points: ChartingSeriesPoint[],
  live: { peRatio: number | null; trailingPe: number | null },
): void {
  const pe = live.peRatio ?? live.trailingPe;
  const trail = live.trailingPe ?? live.peRatio;
  if (pe == null || !impliedMultipleOk(pe)) return;
  if (points.length === 0) return;

  const sorted = [...points].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
  const last = sorted[sorted.length - 1]!;
  last.peRatio = pe;
  if (trail != null && impliedMultipleOk(trail)) {
    last.trailingPe = trail;
  } else {
    last.trailingPe = pe;
  }
}

/**
 * P/S, P/B, Price/FCF from modelled `marketCap`; EV = MC + debt − cash; EV/EBITDA and EV/Sales from that EV.
 * Run after {@link enrichChartingPointsWithPriceImpliedMarketCap} (and ideally after trailing P/E enrich).
 */
export function enrichChartingPointsWithImpliedValuationMultiplesFromMarketCap(
  points: ChartingSeriesPoint[],
): void {
  for (const p of points) {
    const mc = p.marketCap;
    if (mc == null || !Number.isFinite(mc) || mc <= 0) continue;

    const ev = mc + (p.totalDebt ?? 0) - (p.cashOnHand ?? 0);
    if (Number.isFinite(ev) && ev > 0) {
      p.enterpriseValue = ev;
    }

    const rev = p.revenue;
    if (rev != null && Number.isFinite(rev) && Math.abs(rev) > 1e-9) {
      const ps = mc / Math.abs(rev);
      if (impliedMultipleOk(ps)) p.psRatio = ps;
    }

    const eq = p.shareholderEquity;
    if (eq != null && Number.isFinite(eq) && Math.abs(eq) > 1e-9) {
      const pb = mc / Math.abs(eq);
      if (impliedMultipleOk(pb)) p.priceBook = pb;
    }

    const fcf = p.freeCashFlow;
    if (fcf != null && Number.isFinite(fcf) && fcf > 1e-9) {
      const pfcf = mc / fcf;
      if (impliedMultipleOk(pfcf)) p.priceFcf = pfcf;
    }

    const evUse = p.enterpriseValue;
    if (evUse != null && Number.isFinite(evUse) && evUse > 0) {
      const ebitda = p.ebitda;
      if (ebitda != null && Number.isFinite(ebitda) && Math.abs(ebitda) > 1e-9) {
        const v = evUse / Math.abs(ebitda);
        if (impliedMultipleOk(v)) p.evEbitda = v;
      }
      if (rev != null && Number.isFinite(rev) && Math.abs(rev) > 1e-9) {
        const vs = evUse / Math.abs(rev);
        if (impliedMultipleOk(vs)) p.evSales = vs;
      }
    }
  }
}

/**
 * Sets `marketCap` = (last EOD **adjusted** close on or before fiscal period end) × `sharesOutstanding`
 * when both are available. Pair with {@link enrichChartingPointsWithTrailingPeFromImpliedMarketCap} for P/E charts.
 */
export async function enrichChartingPointsWithPriceImpliedMarketCap(
  ticker: string,
  points: ChartingSeriesPoint[],
): Promise<void> {
  if (points.length === 0) return;
  const win = eodFetchWindow(points);
  if (!win) return;

  const bars = await fetchEodhdEodDaily(ticker.trim(), win.from, win.to);
  if (!bars?.length) return;

  for (const p of points) {
    const ymd = chartingPeriodEndToUtcYmd(p.periodEnd);
    if (!ymd) continue;
    const px = adjustedCloseOnOrBefore(bars, ymd);
    const sh = p.sharesOutstanding;
    if (
      px == null ||
      sh == null ||
      !Number.isFinite(px) ||
      !Number.isFinite(sh) ||
      px <= 0 ||
      sh <= 0
    ) {
      continue;
    }
    p.marketCap = px * sh;
  }
}
