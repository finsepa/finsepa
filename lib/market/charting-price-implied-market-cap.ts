import "server-only";

import { format, parse, subDays } from "date-fns";

import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";
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

/**
 * Sets `peRatio` and `trailingPe` to `marketCap / netIncome` when both support a sensible trailing multiple.
 * Run after {@link enrichChartingPointsWithPriceImpliedMarketCap} so cap reflects price × shares where available.
 */
export function enrichChartingPointsWithTrailingPeFromImpliedMarketCap(points: ChartingSeriesPoint[]): void {
  for (const p of points) {
    const mc = p.marketCap;
    const ni = p.netIncome;
    if (mc == null || !Number.isFinite(mc) || mc <= 0) continue;
    if (ni == null || !Number.isFinite(ni) || ni <= 1e-6) continue;
    const pe = mc / ni;
    if (!impliedMultipleOk(pe)) continue;
    p.peRatio = pe;
    p.trailingPe = pe;
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
