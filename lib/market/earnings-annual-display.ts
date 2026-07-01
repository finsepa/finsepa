import { fundamentalsBarSolidAtIndex } from "@/lib/colors/fundamentals-multi-bar-colors";
import { pctChange, ymdYearLabel } from "@/lib/market/stock-financials-annual-slice";
import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";
import type {
  StockEarningsEstimatesPoint,
  StockEarningsHistoryRow,
} from "@/lib/market/stock-earnings-types";

function finiteEps(n: number | null | undefined): number | null {
  return n != null && Number.isFinite(n) ? n : null;
}

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
  if (p.reported) return false;
  const hasActual =
    (p.revenueActualUsd != null && Number.isFinite(p.revenueActualUsd)) ||
    (p.epsActual != null && Number.isFinite(p.epsActual));
  if (hasActual) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(p.sortKey) && p.sortKey > todayYmd) return true;
  const hasRevEst = p.revenueEstimateUsd != null && Number.isFinite(p.revenueEstimateUsd);
  const hasEpsEst = p.epsEstimate != null && Number.isFinite(p.epsEstimate);
  return hasRevEst || hasEpsEst;
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
  const ratio =
    (calibrationSource ? medianEpsPerRevenueRatio(calibrationSource, todayYmd) : null) ??
    medianEpsPerRevenueRatio(points, todayYmd);
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

function fiscalYearTokenFromHistoryRow(r: StockEarningsHistoryRow): string | null {
  const ymd = r.fiscalPeriodEndYmd?.trim();
  if (ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymdYearLabel(ymd);
  const m = r.fiscalPeriodLabel?.match(/\b(20\d{2})\b/);
  return m ? m[1]! : null;
}

function fiscalYearTokenFromEstimatePoint(p: StockEarningsEstimatesPoint): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(p.sortKey)) return ymdYearLabel(p.sortKey);
  const m = p.label.match(/\b(20\d{2})\b/);
  return m ? m[1]! : p.label.trim();
}

function parseYmdUtcMs(ymd: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const t = Date.parse(`${ymd}T12:00:00.000Z`);
  return Number.isFinite(t) ? t : null;
}

/** FY EPS from `Earnings.Trend` annual map — same calendar-year window as yearly income period ends. */
function nearestAnnualEpsTrendForYmd(ymd: string, annualEpsTrend: Map<string, number>): number | null {
  const direct = annualEpsTrend.get(ymd);
  if (direct != null) return direct;
  const targetMs = parseYmdUtcMs(ymd);
  if (targetMs == null) return null;
  const yPrefix = ymd.slice(0, 4);
  let best: number | null = null;
  let bestDist = Infinity;
  const maxMs = 125 * 24 * 60 * 60 * 1000;
  for (const [k, v] of annualEpsTrend) {
    if (!k.startsWith(yPrefix)) continue;
    const km = parseYmdUtcMs(k);
    if (km == null) continue;
    const d = Math.abs(km - targetMs);
    if (d <= maxMs && d < bestDist) {
      bestDist = d;
      best = v;
    }
  }
  return best;
}

/** Reject single-quarter EPS mistaken for diluted FY EPS when no actual is available. */
export function isPlausibleAnnualEpsEstimate(estimate: number, actual: number | null): boolean {
  if (!Number.isFinite(estimate) || estimate <= 0) return false;
  if (actual == null || !Number.isFinite(actual) || actual <= 0) {
    return estimate >= 0.5;
  }
  const ratio = estimate / actual;
  return ratio >= 0.4 && ratio <= 1.6;
}

function roundAnnualEpsEstimate(v: number): number {
  return Math.round(v * 100) / 100;
}

function historyRowsForAnnualPoint(
  p: StockEarningsEstimatesPoint,
  history: StockEarningsHistoryRow[],
): StockEarningsHistoryRow[] {
  const year = fiscalYearTokenFromEstimatePoint(p);
  return history.filter(
    (r) =>
      r.fiscalPeriodEndYmd === p.sortKey ||
      (fiscalYearTokenFromHistoryRow(r) != null && fiscalYearTokenFromHistoryRow(r) === year),
  );
}

function epsEstimateImpliedFromHistorySurprise(
  p: StockEarningsEstimatesPoint,
  history: StockEarningsHistoryRow[],
): number | null {
  const actual = finiteEps(p.epsActual);
  if (actual == null) return null;

  for (const r of historyRowsForAnnualPoint(p, history)) {
    const sp = r.surprisePct;
    if (sp == null || !Number.isFinite(sp) || Math.abs(sp) >= 500 || sp === -100) continue;
    const denom = 1 + sp / 100;
    if (Math.abs(denom) < 1e-6) continue;
    const implied = actual / denom;
    if (isPlausibleAnnualEpsEstimate(implied, actual)) return roundAnnualEpsEstimate(implied);
  }
  return null;
}

function epsEstimateFromHistoryForAnnual(
  p: StockEarningsEstimatesPoint,
  history: StockEarningsHistoryRow[],
): number | null {
  const actual = finiteEps(p.epsActual);
  const rows = historyRowsForAnnualPoint(p, history).filter((r) => finiteEps(r.epsEstimateRaw) != null);
  if (rows.length === 0) return null;

  const exact = rows.find((r) => r.fiscalPeriodEndYmd === p.sortKey);
  if (exact) {
    const est = finiteEps(exact.epsEstimateRaw);
    if (est != null && isPlausibleAnnualEpsEstimate(est, actual)) return est;
  }

  const plausible = rows
    .map((r) => finiteEps(r.epsEstimateRaw)!)
    .filter((est) => isPlausibleAnnualEpsEstimate(est, actual));
  if (plausible.length === 0) return null;
  return plausible.sort((a, b) => b - a)[0]!;
}

/**
 * Ensure reported fiscal years use FY diluted EPS estimates (annual `Earnings.Trend`), never
 * single-quarter consensus. Replaces mistaken ~$1–2 quarterly values on annual chart bars.
 */
function epsEstimateFromRevenueRatio(
  p: StockEarningsEstimatesPoint,
  calibrationAnnual: StockEarningsEstimatesPoint[],
): number | null {
  const revEst = p.revenueEstimateUsd;
  if (revEst == null || !Number.isFinite(revEst) || revEst <= 0) return null;
  const ratio = medianEpsPerRevenueRatio(calibrationAnnual);
  if (ratio == null) return null;
  const est = roundAnnualEpsEstimate(revEst * ratio);
  const actual = finiteEps(p.epsActual);
  return isPlausibleAnnualEpsEstimate(est, actual) ? est : null;
}

export function resolveAnnualEpsEstimate(
  p: StockEarningsEstimatesPoint,
  history: StockEarningsHistoryRow[],
  annualEpsTrend: Map<string, number>,
  calibrationAnnual: StockEarningsEstimatesPoint[] = [],
): number | null {
  const actual = finiteEps(p.epsActual);
  const current = finiteEps(p.epsEstimate);
  if (current != null && isPlausibleAnnualEpsEstimate(current, actual)) return current;

  const fromTrend =
    annualEpsTrend.get(p.sortKey) ?? nearestAnnualEpsTrendForYmd(p.sortKey, annualEpsTrend);
  if (fromTrend != null && isPlausibleAnnualEpsEstimate(fromTrend, actual)) return fromTrend;

  const fromSurprise = epsEstimateImpliedFromHistorySurprise(p, history);
  if (fromSurprise != null) return fromSurprise;

  const fromHistory = epsEstimateFromHistoryForAnnual(p, history);
  if (fromHistory != null) return fromHistory;

  return epsEstimateFromRevenueRatio(p, calibrationAnnual);
}

export function backfillAnnualEpsEstimates(
  annual: StockEarningsEstimatesPoint[],
  history: StockEarningsHistoryRow[],
  annualEpsTrend: Map<string, number> = new Map(),
): StockEarningsEstimatesPoint[] {
  const todayYmd = todayYmdUtc();
  return annual.map((p) => {
    if (isAnnualForecastPoint(p, todayYmd)) return p;
    const resolved = resolveAnnualEpsEstimate(p, history, annualEpsTrend, annual);
    const current = finiteEps(p.epsEstimate);
    if (resolved != null) {
      if (resolved === current) return p;
      return { ...p, epsEstimate: resolved };
    }
    if (current != null && !isPlausibleAnnualEpsEstimate(current, finiteEps(p.epsActual))) {
      return { ...p, epsEstimate: null };
    }
    return p;
  });
}

/** Bar + Beat/Miss line values for the Estimates chart (raw estimate/actual fields). */
export function estimatesChartBarValues(
  p: StockEarningsEstimatesPoint,
  metric: "revenue" | "eps",
): { estimate: number | null; actual: number | null } {
  if (metric === "revenue") {
    return {
      estimate:
        p.revenueEstimateUsd != null && Number.isFinite(p.revenueEstimateUsd)
          ? p.revenueEstimateUsd
          : null,
      actual:
        p.revenueActualUsd != null && Number.isFinite(p.revenueActualUsd)
          ? p.revenueActualUsd
          : null,
    };
  }
  return {
    estimate: finiteEps(p.epsEstimate),
    actual: finiteEps(p.epsActual),
  };
}

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
