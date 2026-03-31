import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeWatchlistTicker, WatchlistValidationError } from "@/lib/watchlist/operations";
import { fetchEodhdFundamentalsJson } from "@/lib/market/eodhd-fundamentals";
import { companyLogoUrlFromDomain } from "@/lib/screener/company-logo-url";
import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";
import type { ChartingMetricId, ChartingMetricKind } from "@/lib/market/stock-charting-metrics";
import { CHARTING_METRIC_FIELD, CHARTING_METRIC_KIND } from "@/lib/market/stock-charting-metrics";
import { fetchChartingSeries } from "@/lib/market/eodhd-charting-series";
import { formatPercentMetric, formatUsdCompact, formatUsdPrice } from "@/lib/market/key-stats-basic-format";

type CompareRow = {
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

function domainFromUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(s.includes("://") ? s : `https://${s}`);
    const host = u.hostname.replace(/^www\./, "").trim().toLowerCase();
    return host || null;
  } catch {
    return null;
  }
}

function latestPoint(points: ChartingSeriesPoint[]): ChartingSeriesPoint | null {
  if (!points.length) return null;
  // series is typically chronological; pick the last with a valid date.
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i];
    if (p && typeof p.periodEnd === "string" && p.periodEnd.trim()) return p;
  }
  return null;
}

function val(point: ChartingSeriesPoint | null, id: ChartingMetricId): number | null {
  if (!point) return null;
  const k = CHARTING_METRIC_FIELD[id];
  const v = (point as any)[k];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function formatByKind(kind: ChartingMetricKind, v: number | null): string {
  if (v == null) return "—";
  if (kind === "percent") return formatPercentMetric(v);
  if (kind === "eps") return formatUsdPrice(v);
  if (kind === "usd") return formatUsdCompact(v);
  return formatUsdCompact(v);
}

async function loadAnnualSeries(ticker: string): Promise<ChartingSeriesPoint[]> {
  const bundle = await fetchChartingSeries(ticker, "annual");
  return bundle?.points ?? [];
}

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { tickers?: unknown };
  const raw = Array.isArray(body?.tickers) ? body!.tickers : [];

  const tickers: string[] = [];
  for (const t of raw) {
    if (typeof t !== "string") continue;
    try {
      tickers.push(normalizeWatchlistTicker(t));
    } catch (e) {
      if (e instanceof WatchlistValidationError) continue;
    }
  }

  const unique = Array.from(new Set(tickers)).slice(0, 12);

  const settled = await Promise.allSettled(
    unique.map(async (ticker) => {
      const root = await fetchEodhdFundamentalsJson(ticker);
      const general =
        root && typeof root === "object" && root.General && typeof root.General === "object"
          ? (root.General as Record<string, unknown>)
          : null;

      const fullNameRaw = general?.Name ?? general?.CompanyName ?? general?.ShortName ?? null;
      const fullName = typeof fullNameRaw === "string" && fullNameRaw.trim() ? fullNameRaw.trim() : null;

      const host =
        domainFromUrl(general?.WebURL ?? general?.Website ?? general?.URL) ??
        domainFromUrl((root as any)?.WebURL ?? (root as any)?.Website ?? (root as any)?.URL);
      const logoUrl = host ? companyLogoUrlFromDomain(host) : null;

      const points = await loadAnnualSeries(ticker);
      const last = latestPoint(points);

      const row: CompareRow = {
        ticker,
        fullName,
        logoUrl,
        revGrowth: formatByKind("percent", val(last, "revenue_yoy")),
        grossProfit: formatByKind(CHARTING_METRIC_KIND.gross_profit, val(last, "gross_profit")),
        operIncome: formatByKind(CHARTING_METRIC_KIND.operating_income, val(last, "operating_income")),
        netIncome: formatByKind(CHARTING_METRIC_KIND.net_income, val(last, "net_income")),
        eps: formatByKind(CHARTING_METRIC_KIND.eps, val(last, "eps")),
        epsGrowth: formatByKind("percent", val(last, "eps_yoy")),
        revenue: formatByKind(CHARTING_METRIC_KIND.revenue, val(last, "revenue")),
      };

      return row;
    }),
  );

  const rows: CompareRow[] = [];
  for (const s of settled) {
    if (s.status === "fulfilled") rows.push(s.value);
  }

  return NextResponse.json({ rows });
}

