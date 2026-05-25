import { fundamentalsBarSolidAtIndex } from "@/lib/colors/fundamentals-multi-bar-colors";
import { pctChange, ymdYearLabel } from "@/lib/market/stock-financials-annual-slice";
import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";
import type {
  StockEarningsEstimatesPoint,
  StockEarningsHistoryRow,
} from "@/lib/market/stock-earnings-types";

/** Earnings Estimates chart + annual summary table — last 5 reported fiscal years (+ forward). */
export const EARNINGS_ANNUAL_HISTORY_MAX = 5;

/** Forecast period labels (chart x-axis + table fiscal year row). */
export const EARNINGS_FORECAST_LABEL_COLOR = fundamentalsBarSolidAtIndex(0);

/** 5 years × 4 quarters — Estimates quarterly chart cap (+ forward quarters). */
export const EARNINGS_QUARTERLY_HISTORY_MAX = EARNINGS_ANNUAL_HISTORY_MAX * 4;

/** Last `EARNINGS_QUARTERLY_HISTORY_MAX` reported/historical quarters, then forward consensus quarters. */
export function sliceLatestQuarterlyEstimates(
  points: StockEarningsEstimatesPoint[],
): StockEarningsEstimatesPoint[] {
  const todayYmd = todayYmdUtc();
  const sorted = [...points].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  const historical = sorted.filter((p) => !isAnnualForecastPoint(p, todayYmd));
  const forward = sorted.filter((p) => isAnnualForecastPoint(p, todayYmd));

  const historySlice =
    historical.length <= EARNINGS_QUARTERLY_HISTORY_MAX
      ? historical
      : historical.slice(-EARNINGS_QUARTERLY_HISTORY_MAX);

  const historyKeys = new Set(historySlice.map((p) => p.sortKey));
  const forwardExtra = forward.filter((p) => !historyKeys.has(p.sortKey));

  return [...historySlice, ...forwardExtra];
}

function fiscalYearFromHistoryRow(row: StockEarningsHistoryRow): number | null {
  const ymd = row.fiscalPeriodEndYmd?.trim();
  if (ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd)) return Number(ymd.slice(0, 4));
  const m = row.fiscalPeriodLabel?.match(/\b(20\d{2})\b/);
  return m ? Number(m[1]) : null;
}

/** Unreleased or future-dated report rows — kept outside the 5-year history cap. */
export function isEarningsHistoryForwardRow(
  row: StockEarningsHistoryRow,
  todayYmd = todayYmdUtc(),
): boolean {
  if (!row.reported) return true;
  if (row.reportDateYmd && row.reportDateYmd > todayYmd) return true;
  if (
    row.fiscalPeriodEndYmd &&
    /^\d{4}-\d{2}-\d{2}$/.test(row.fiscalPeriodEndYmd) &&
    row.fiscalPeriodEndYmd > todayYmd
  ) {
    return true;
  }
  return false;
}

/**
 * Reports table — last `EARNINGS_ANNUAL_HISTORY_MAX` fiscal years of reported quarters, plus all
 * upcoming / unreleased rows (same rule as Estimates chart history cap).
 */
export function sliceEarningsHistoryForReports(
  rows: StockEarningsHistoryRow[],
): StockEarningsHistoryRow[] {
  const historical = rows.filter((r) => !isEarningsHistoryForwardRow(r));
  const years = [
    ...new Set(
      historical
        .map(fiscalYearFromHistoryRow)
        .filter((y): y is number => y != null && Number.isFinite(y)),
    ),
  ].sort((a, b) => a - b);
  const keepYears = new Set(years.slice(-EARNINGS_ANNUAL_HISTORY_MAX));

  return rows.filter((r) => {
    if (isEarningsHistoryForwardRow(r)) return true;
    const y = fiscalYearFromHistoryRow(r);
    return y != null && keepYears.has(y);
  });
}

/** Consensus-only fiscal years (period not ended) — shown after the 5-year history cap. */
export function isAnnualForecastPoint(
  p: StockEarningsEstimatesPoint,
  todayYmd = todayYmdUtc(),
): boolean {
  if (/^\d{4}-\d{2}-\d{2}$/.test(p.sortKey) && p.sortKey > todayYmd) return true;
  if (p.reported) return false;
  const hasRevEst = p.revenueEstimateUsd != null && Number.isFinite(p.revenueEstimateUsd);
  const hasEpsEst = p.epsEstimate != null && Number.isFinite(p.epsEstimate);
  const hasActual =
    (p.revenueActualUsd != null && Number.isFinite(p.revenueActualUsd)) ||
    (p.epsActual != null && Number.isFinite(p.epsActual));
  return !hasActual && (hasRevEst || hasEpsEst);
}

/** Last `EARNINGS_ANNUAL_HISTORY_MAX` reported/historical years, then any forward trend years. */
export function sliceLatestAnnualEstimates(
  points: StockEarningsEstimatesPoint[],
): StockEarningsEstimatesPoint[] {
  const todayYmd = todayYmdUtc();
  const sorted = [...points].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  const historical = sorted.filter((p) => !isAnnualForecastPoint(p, todayYmd));
  const forward = sorted.filter((p) => isAnnualForecastPoint(p, todayYmd));

  const historySlice =
    historical.length <= EARNINGS_ANNUAL_HISTORY_MAX
      ? historical
      : historical.slice(-EARNINGS_ANNUAL_HISTORY_MAX);

  const historyLabels = new Set(historySlice.map((p) => p.label));
  const forwardExtra = forward.filter((p) => !historyLabels.has(p.label));

  return [...historySlice, ...forwardExtra];
}

export function displayRevenueUsd(p: StockEarningsEstimatesPoint): number | null {
  if (p.revenueActualUsd != null && Number.isFinite(p.revenueActualUsd)) return p.revenueActualUsd;
  if (p.revenueEstimateUsd != null && Number.isFinite(p.revenueEstimateUsd)) return p.revenueEstimateUsd;
  return null;
}

export function displayEps(p: StockEarningsEstimatesPoint): number | null {
  if (p.epsActual != null && Number.isFinite(p.epsActual)) return p.epsActual;
  if (p.epsEstimate != null && Number.isFinite(p.epsEstimate)) return p.epsEstimate;
  return null;
}

/** Reported years used to calibrate EPS ≈ revenue × median(EPS / revenue). */
const EPS_PER_REVENUE_CALIBRATION_YEARS = 5;

function medianFinite(values: number[]): number | null {
  const v = values.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 === 1 ? v[mid]! : (v[mid - 1]! + v[mid]!) / 2;
}

/**
 * Median diluted EPS ÷ revenue (USD) on recent reported fiscal periods — scales forward revenue
 * consensus into an EPS estimate when `Earnings.Trend` has no FY EPS row.
 */
export function medianEpsPerRevenueRatio(
  points: StockEarningsEstimatesPoint[],
  todayYmd = todayYmdUtc(),
): number | null {
  const reported = [...points]
    .filter((p) => !isAnnualForecastPoint(p, todayYmd))
    .filter((p) => {
      const rev = p.revenueActualUsd;
      const eps = p.epsActual;
      return (
        rev != null &&
        eps != null &&
        Number.isFinite(rev) &&
        Number.isFinite(eps) &&
        rev > 0
      );
    })
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  const recent = reported.slice(-EPS_PER_REVENUE_CALIBRATION_YEARS);
  const ratios = recent.map((p) => p.epsActual! / p.revenueActualUsd!);
  return medianFinite(ratios);
}

function roundEpsEstimate(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * When forward periods have revenue consensus but no EPS trend, impute EPS from revenue using
 * recent reported EPS/revenue (table, annual chart, quarterly chart).
 */
export function applyDerivedEpsToForwardEstimates(
  points: StockEarningsEstimatesPoint[],
  calibrationSource?: StockEarningsEstimatesPoint[],
): StockEarningsEstimatesPoint[] {
  const todayYmd = todayYmdUtc();
  const ratio = medianEpsPerRevenueRatio(calibrationSource ?? points, todayYmd);
  if (ratio == null || !Number.isFinite(ratio) || ratio <= 0) return points;

  return points.map((p) => {
    if (p.epsEstimate != null && Number.isFinite(p.epsEstimate)) return p;
    if (!isAnnualForecastPoint(p, todayYmd)) return p;
    const rev = p.revenueEstimateUsd;
    if (rev == null || !Number.isFinite(rev) || rev <= 0) return p;
    const eps = roundEpsEstimate(rev * ratio);
    if (!Number.isFinite(eps) || eps <= 0) return p;
    return { ...p, epsEstimate: eps };
  });
}

function todayYmdUtc(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/**
 * Fill reported revenue/EPS from fundamentals charting annual series when EODHD earnings
 * blocks omit early fiscal years (e.g. 2016–2017 still present on Financials).
 */
export function mergeFundamentalsIntoAnnualEstimates(
  annual: StockEarningsEstimatesPoint[],
  fundamentals: ChartingSeriesPoint[],
): StockEarningsEstimatesPoint[] {
  const todayYmd = todayYmdUtc();
  const byYear = new Map<string, StockEarningsEstimatesPoint>();
  for (const p of annual) {
    byYear.set(p.label, p);
  }

  const sortedFund = [...fundamentals].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
  for (const f of sortedFund) {
    const ymd = f.periodEnd.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) continue;
    const label = ymdYearLabel(ymd);
    const ended = ymd <= todayYmd;
    const rev = f.revenue;
    const eps = f.eps;
    const existing = byYear.get(label);

    if (existing) {
      const fundEps = ended && eps != null && Number.isFinite(eps) ? eps : null;
      const preferFundEps =
        fundEps != null &&
        existing.epsActual != null &&
        Number.isFinite(existing.epsActual) &&
        existing.revenueActualUsd != null &&
        existing.revenueActualUsd > 50e9 &&
        existing.epsActual < 4 &&
        fundEps >= 4;
      byYear.set(label, {
        ...existing,
        sortKey: existing.sortKey || ymd,
        revenueActualUsd:
          existing.revenueActualUsd ?? (ended && rev != null && Number.isFinite(rev) ? rev : null),
        epsActual: preferFundEps
          ? fundEps
          : (existing.epsActual ?? fundEps),
        reported: existing.reported || ended,
      });
      continue;
    }

    if (rev == null && eps == null) continue;
    byYear.set(label, {
      sortKey: ymd,
      label,
      revenueEstimateUsd: null,
      revenueActualUsd: ended && rev != null && Number.isFinite(rev) ? rev : null,
      epsEstimate: null,
      epsActual: ended && eps != null && Number.isFinite(eps) ? eps : null,
      reported: ended,
    });
  }

  return [...byYear.values()].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

export type EarningsAnnualChartRow = {
  label: string;
  estimate: number | null;
  actual: number | null;
};

/** Chart rows — same display rules as the annual summary table. */
export function annualPointsToChartRows(
  points: StockEarningsEstimatesPoint[],
  metric: "revenue" | "earnings",
): EarningsAnnualChartRow[] {
  const out: EarningsAnnualChartRow[] = [];
  for (const p of points) {
    if (metric === "revenue") {
      const actual = p.revenueActualUsd;
      const estimate = p.revenueEstimateUsd;
      const hasA = actual != null && Number.isFinite(actual);
      const hasE = estimate != null && Number.isFinite(estimate);
      if (!hasA && !hasE) {
        const fallback = displayRevenueUsd(p);
        if (fallback == null || !Number.isFinite(fallback)) continue;
        out.push({ label: p.label, estimate: null, actual: fallback });
        continue;
      }
      out.push({
        label: p.label,
        estimate: hasE ? estimate! : null,
        actual: hasA ? actual! : null,
      });
      continue;
    }

    const actual = p.epsActual;
    const estimate = p.epsEstimate;
    const hasA = actual != null && Number.isFinite(actual);
    const hasE = estimate != null && Number.isFinite(estimate);
    if (!hasA && !hasE) {
      const fallback = displayEps(p);
      if (fallback == null || !Number.isFinite(fallback)) continue;
      out.push({ label: p.label, estimate: null, actual: fallback });
      continue;
    }
    out.push({
      label: p.label,
      estimate: hasE ? estimate! : null,
      actual: hasA ? actual! : null,
    });
  }
  return out;
}

export function annualRevenueGrowthSeries(points: StockEarningsEstimatesPoint[]): (number | null)[] {
  const vals = points.map(displayRevenueUsd);
  return vals.map((_, i) => (i === 0 ? null : pctChange(vals[i]!, vals[i - 1]!)));
}

export function annualEpsGrowthSeries(points: StockEarningsEstimatesPoint[]): (number | null)[] {
  const vals = points.map(displayEps);
  return vals.map((_, i) => (i === 0 ? null : pctChange(vals[i]!, vals[i - 1]!)));
}
