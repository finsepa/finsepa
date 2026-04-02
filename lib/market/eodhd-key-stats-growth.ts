import "server-only";

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

  const rows: KeyStatsGrowthRow[] = [
    { label: "Quarterly Revenue (YoY)", value: qRevYoy != null ? formatPercentMetric(qRevYoy) : "—" },
    { label: "Revenue (3Y)", value: rev3y != null ? formatPercentMetric(rev3y) : "—" },
    { label: "Quarterly EPS (YoY)", value: qEpsYoy != null ? formatPercentMetric(qEpsYoy) : "—" },
    { label: "EPS (3Y)", value: eps3y != null ? formatPercentMetric(eps3y) : "—" },
  ];

  return { rows };
}
