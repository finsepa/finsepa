import "server-only";

import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";
import { buildChartingPointsFromFundamentalsRoot } from "@/lib/market/eodhd-charting-series";
import { fetchEodhdFundamentalsJson } from "@/lib/market/eodhd-fundamentals";
import { formatPercentMetric } from "@/lib/market/key-stats-basic-format";

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function firstNum(hl: Record<string, unknown> | null, keys: string[]): number | null {
  if (!hl) return null;
  for (const k of keys) {
    const n = num(hl[k]);
    if (n != null) return n;
  }
  return null;
}

export type KeyStatsGrowthRow = { label: string; value: string };

/** Latest period with a finite numeric value for `key` (series is oldest → newest). */
function lastFiniteMetric(points: ChartingSeriesPoint[], key: keyof ChartingSeriesPoint): number | null {
  for (let i = points.length - 1; i >= 0; i--) {
    const v = points[i]![key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

export async function fetchEodhdKeyStatsGrowth(
  ticker: string,
  fundamentalsRoot?: Record<string, unknown> | null,
): Promise<{ rows: KeyStatsGrowthRow[] } | null> {
  const root = fundamentalsRoot ?? (await fetchEodhdFundamentalsJson(ticker));
  if (!root) return null;

  const hl = root.Highlights && typeof root.Highlights === "object" ? (root.Highlights as Record<string, unknown>) : null;

  const qRevYoy = firstNum(hl, [
    "QuarterlyRevenueGrowth",
    "RevenueGrowthQuarterlyYoY",
    "QuarterlyRevenueGrowthYOY",
    "RevenueQuarterlyGrowth",
    "QuarterlyRevenueGrowthYoy",
  ]);
  const rev3y = firstNum(hl, [
    "RevenueGrowth3Y",
    "Revenue3YCAGR",
    "Revenue3YearCAGR",
    "3YearRevenueGrowth",
    "RevenueGrowth5Y",
    "FiveYearAnnualRevenueGrowthRate",
  ]);
  const qEpsYoy = firstNum(hl, [
    "QuarterlyEarningsGrowth",
    "QuarterlyEPSGrowth",
    "EPSGrowthQuarterlyYoY",
    "QuarterlyEPSGrowthYOY",
    "EpsGrowthQuarterlyYoY",
  ]);
  const eps3y = firstNum(hl, [
    "EPSGrowth3Y",
    "EPS3YCAGR",
    "EPS3YearCAGR",
    "3YearEPSGrowth",
    "EPSGrowth5Y",
    "FiveYearAnnualEPSGrowthRate",
  ]);

  const rootRec = root as Record<string, unknown>;
  const quarterlyPts = buildChartingPointsFromFundamentalsRoot(rootRec, "quarterly");
  const annualPts = buildChartingPointsFromFundamentalsRoot(rootRec, "annual");

  /** Same definitions as charting `computeGrowthSeries`: revenue/EPS YoY from quarterly (lag 4q); 3Y CAGR from annual (lag 3y) else quarterly (lag 12q). */
  const qRevYoyResolved = qRevYoy ?? lastFiniteMetric(quarterlyPts, "revenueYoy");
  const rev3yResolved =
    rev3y ?? lastFiniteMetric(annualPts, "revenue3yCagr") ?? lastFiniteMetric(quarterlyPts, "revenue3yCagr");
  const qEpsYoyResolved = qEpsYoy ?? lastFiniteMetric(quarterlyPts, "epsYoy");
  const eps3yResolved =
    eps3y ?? lastFiniteMetric(annualPts, "eps3yCagr") ?? lastFiniteMetric(quarterlyPts, "eps3yCagr");

  const rows: KeyStatsGrowthRow[] = [
    { label: "Quarterly Revenue (YoY)", value: qRevYoyResolved != null ? formatPercentMetric(qRevYoyResolved) : "—" },
    { label: "Revenue (3Y)", value: rev3yResolved != null ? formatPercentMetric(rev3yResolved) : "—" },
    { label: "Quarterly EPS (YoY)", value: qEpsYoyResolved != null ? formatPercentMetric(qEpsYoyResolved) : "—" },
    { label: "EPS (3Y)", value: eps3yResolved != null ? formatPercentMetric(eps3yResolved) : "—" },
  ];

  return { rows };
}
