import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_WARM } from "@/lib/data/cache-policy";
import { fetchEodhdFundamentalsJson } from "@/lib/market/eodhd-fundamentals";
import { buildChartingPointsFromFundamentalsRoot } from "@/lib/market/eodhd-charting-series";
import { resolveEquityLogoUrlFromTicker } from "@/lib/screener/resolve-equity-logo-url";
import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";
import type { ChartingMetricId, ChartingMetricKind } from "@/lib/market/stock-charting-metrics";
import { CHARTING_METRIC_FIELD, CHARTING_METRIC_KIND } from "@/lib/market/stock-charting-metrics";
import { formatPercentMetric, formatUsdCompact, formatUsdPrice } from "@/lib/market/key-stats-basic-format";

export type PeersCompareRow = {
  ticker: string;
  fullName: string | null;
  logoUrl: string | null;
  revGrowth: string;
  grossProfit: string;
  operIncome: string;
  netIncome: string;
  eps: string;
  epsGrowth: string;
  revenue: string;
};

function latestPoint(points: ChartingSeriesPoint[]): ChartingSeriesPoint | null {
  if (!points.length) return null;
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i];
    if (p && typeof p.periodEnd === "string" && p.periodEnd.trim()) return p;
  }
  return null;
}

function val(point: ChartingSeriesPoint | null, id: ChartingMetricId): number | null {
  if (!point) return null;
  const k = CHARTING_METRIC_FIELD[id];
  const v = point[k as keyof ChartingSeriesPoint];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function formatByKind(kind: ChartingMetricKind, v: number | null): string {
  if (v == null) return "—";
  if (kind === "percent") return formatPercentMetric(v);
  if (kind === "eps") return formatUsdPrice(v);
  if (kind === "usd") return formatUsdCompact(v);
  return formatUsdCompact(v);
}

async function loadOnePeerRow(ticker: string): Promise<PeersCompareRow> {
  const logoStr = resolveEquityLogoUrlFromTicker(ticker);
  const root = await fetchEodhdFundamentalsJson(ticker);
  if (!root || typeof root !== "object") {
    return {
      ticker,
      fullName: null,
      logoUrl: logoStr.trim() ? logoStr : null,
      revGrowth: "—",
      grossProfit: "—",
      operIncome: "—",
      netIncome: "—",
      eps: "—",
      epsGrowth: "—",
      revenue: "—",
    };
  }

  const rootRec = root as Record<string, unknown>;
  const general =
    rootRec.General && typeof rootRec.General === "object"
      ? (rootRec.General as Record<string, unknown>)
      : null;

  const fullNameRaw = general?.Name ?? general?.CompanyName ?? general?.ShortName ?? null;
  const fullName = typeof fullNameRaw === "string" && fullNameRaw.trim() ? fullNameRaw.trim() : null;

  const logoUrl = logoStr.trim() ? logoStr : null;

  // One fundamentals JSON per ticker; derive annual + quarterly locally (was 3× fundamentals before).
  const annualPoints = buildChartingPointsFromFundamentalsRoot(rootRec, "annual");
  const quarterlyPoints = buildChartingPointsFromFundamentalsRoot(rootRec, "quarterly");
  const lastAnnual = latestPoint(annualPoints);
  const lastQuarter = latestPoint(quarterlyPoints);

  return {
    ticker,
    fullName,
    logoUrl,
    revGrowth: formatByKind("percent", val(lastQuarter ?? lastAnnual, "revenue_yoy")),
    grossProfit: formatByKind(CHARTING_METRIC_KIND.gross_profit, val(lastAnnual, "gross_profit")),
    operIncome: formatByKind(CHARTING_METRIC_KIND.operating_income, val(lastAnnual, "operating_income")),
    netIncome: formatByKind(CHARTING_METRIC_KIND.net_income, val(lastAnnual, "net_income")),
    eps: formatByKind(CHARTING_METRIC_KIND.eps, val(lastAnnual, "eps")),
    epsGrowth: formatByKind("percent", val(lastQuarter ?? lastAnnual, "eps_yoy")),
    revenue: formatByKind(CHARTING_METRIC_KIND.revenue, val(lastAnnual, "revenue")),
  };
}

/**
 * Final normalized payload for the peers compare table — cached by sorted ticker set.
 * Underlying `fetchEodhdFundamentalsJson` / `fetchChartingSeries` are also cached per ticker.
 */
async function loadPeersCompareRowsUncached(tickersKey: string): Promise<PeersCompareRow[]> {
  const tickers = tickersKey.split("|").filter(Boolean);
  const settled = await Promise.allSettled(tickers.map((t) => loadOnePeerRow(t)));
  const rows: PeersCompareRow[] = [];
  for (const s of settled) {
    if (s.status === "fulfilled") rows.push(s.value);
  }
  return rows;
}

export const getPeersCompareRowsCached = unstable_cache(
  async (tickersKey: string) => loadPeersCompareRowsUncached(tickersKey),
  ["peers-compare-payload-v2-single-fundamentals"],
  { revalidate: REVALIDATE_WARM },
);
