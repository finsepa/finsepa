import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getTop500Universe } from "@/lib/screener/top500-companies";
import { fetchEodhdEodDaily } from "@/lib/market/eodhd-eod";
import { fetchEodhdUsRealtime } from "@/lib/market/eodhd-realtime";
import { fetchEodhdFundamentalsJson } from "@/lib/market/eodhd-fundamentals";
import { companyLogoUrlFromDomain } from "@/lib/screener/company-logo-url";
import {
  deriveMetricsFromDailyBars,
  eodFetchWindowUtc,
  formatMarketCapDisplay,
  formatPeDisplay,
} from "@/lib/screener/eod-derived-metrics";
import type { ScreenerTableRow } from "@/lib/screener/screener-static";

type CompaniesResponse = {
  page: number;
  pageSize: number;
  total: number;
  rows: ScreenerTableRow[];
};

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

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

function parseFundamentalsForScreener(root: Record<string, unknown> | null): {
  peTrailing: number | null;
  peForward: number | null;
  websiteDomain: string | null;
} {
  if (!root) return { peTrailing: null, peForward: null, websiteDomain: null };

  const g = root.General && typeof root.General === "object" ? (root.General as Record<string, unknown>) : null;
  const hl = root.Highlights && typeof root.Highlights === "object" ? (root.Highlights as Record<string, unknown>) : null;
  const val = root.Valuation && typeof root.Valuation === "object" ? (root.Valuation as Record<string, unknown>) : null;

  const peTrailing =
    num(hl?.PERatio ?? hl?.TrailingPE ?? hl?.PeRatio) ?? num(val?.PERatio ?? val?.TrailingPE) ?? null;
  const peForward = num(hl?.ForwardPE ?? hl?.ForwardPe ?? hl?.ForwardPEPS) ?? num(val?.ForwardPE) ?? null;

  const websiteDomain =
    domainFromUrl(g?.WebURL ?? g?.Website ?? g?.URL) ??
    domainFromUrl(root.WebURL ?? root.Website ?? root.URL);

  return { peTrailing, peForward, websiteDomain };
}

async function buildRow(ticker: string, name: string, marketCapUsd: number, id: number): Promise<ScreenerTableRow> {
  const { from, to } = eodFetchWindowUtc();

  const [quoteSettled, eodSettled, fundSettled] = await Promise.allSettled([
    fetchEodhdUsRealtime(ticker),
    fetchEodhdEodDaily(ticker, from, to),
    fetchEodhdFundamentalsJson(ticker),
  ]);

  const quote = quoteSettled.status === "fulfilled" ? quoteSettled.value : null;
  const bars = eodSettled.status === "fulfilled" ? eodSettled.value : null;
  const fundRoot = fundSettled.status === "fulfilled" ? fundSettled.value : null;

  const rtClose = quote && typeof quote.close === "number" && Number.isFinite(quote.close) ? quote.close : null;
  const prevClose =
    quote && typeof quote.previousClose === "number" && Number.isFinite(quote.previousClose) ? quote.previousClose : null;
  const lastEodClose = bars && bars.length > 0 ? bars[bars.length - 1]!.close : null;

  const price = rtClose ?? lastEodClose ?? 0;

  let change1D = 0;
  if (rtClose != null) {
    if (typeof quote?.change_p === "number" && Number.isFinite(quote.change_p)) change1D = quote.change_p;
    else if (prevClose != null && prevClose !== 0) change1D = ((rtClose - prevClose) / prevClose) * 100;
  } else if (bars && bars.length >= 2) {
    const prev = bars[bars.length - 2]!.close;
    if (prev) change1D = ((bars[bars.length - 1]!.close - prev) / prev) * 100;
  }

  const derived = bars && bars.length > 0 && price > 0 ? deriveMetricsFromDailyBars(bars, price) : null;
  const change1M = derived?.changePercent1M ?? 0;
  const changeYTD = derived?.changePercentYTD ?? 0;
  const trend = derived?.sparkline5d?.length ? derived.sparkline5d : [];

  const { peTrailing, peForward, websiteDomain } = parseFundamentalsForScreener(fundRoot);
  const logoUrl = websiteDomain ? companyLogoUrlFromDomain(websiteDomain) : "";

  return {
    id,
    name,
    ticker,
    logoUrl,
    price,
    change1D,
    change1M,
    changeYTD,
    marketCap: formatMarketCapDisplay(marketCapUsd),
    pe: formatPeDisplay(peTrailing, peForward),
    trend,
  };
}

export async function GET(request: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const qRaw = url.searchParams.get("q") ?? "";
  const q = qRaw.trim().toLowerCase();
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSizeRaw = Number(url.searchParams.get("pageSize") ?? "20") || 20;
  const pageSize = Math.min(50, Math.max(1, pageSizeRaw));

  const universe = await getTop500Universe();
  const filtered =
    q.length > 0
      ? universe.filter((u) => u.ticker.toLowerCase().includes(q) || u.name.toLowerCase().includes(q))
      : universe;
  const total = filtered.length;

  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  const settled = await Promise.allSettled(
    slice.map((u, i) => buildRow(u.ticker, u.name, u.marketCapUsd, start + i + 1)),
  );

  const rows: ScreenerTableRow[] = [];
  for (let i = 0; i < settled.length; i++) {
    const s = settled[i]!;
    if (s.status === "fulfilled") rows.push(s.value);
  }

  const payload: CompaniesResponse = { page, pageSize, total, rows };
  return NextResponse.json(payload, {
    headers: {
      // Allow Next to cache at the edge while keeping it fresh-ish.
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}

