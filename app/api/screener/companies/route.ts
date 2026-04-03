import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSimpleMarketData, getSimpleScreenerDerived } from "@/lib/market/simple-market-layer";
import { companyLogoUrlFromDomain } from "@/lib/screener/company-logo-url";
import { reducedStockMarketCapDisplay, reducedStockPeDisplay } from "@/lib/market/reduced-universe";
import { TOP10_META, TOP10_TICKERS, type Top10Ticker } from "@/lib/screener/top10-config";
import type { ScreenerTableRow } from "@/lib/screener/screener-static";

export async function GET(request: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSizeRaw = Number(url.searchParams.get("pageSize") ?? "20") || 20;
  const pageSize = Math.min(50, Math.max(1, pageSizeRaw));

  const [data, derived] = await Promise.all([getSimpleMarketData(), getSimpleScreenerDerived()]);

  const allRows: ScreenerTableRow[] = TOP10_TICKERS.map((ticker: Top10Ticker, i: number) => {
    const q = data.stocks[ticker];
    const s = derived[ticker];
    const meta = TOP10_META[ticker];
    return {
      id: i + 1,
      ticker,
      name: meta.name,
      logoUrl: companyLogoUrlFromDomain(meta.domain),
      price: q?.price ?? null,
      change1D: q?.changePercent1D ?? null,
      change1M: s?.changePercent1M ?? null,
      changeYTD: s?.changePercentYTD ?? null,
      marketCap: reducedStockMarketCapDisplay(ticker),
      pe: reducedStockPeDisplay(ticker),
      trend: s?.last5DailyCloses ?? [],
    };
  });

  const total = allRows.length;
  const start = (page - 1) * pageSize;
  const rows = allRows.slice(start, start + pageSize);

  return NextResponse.json(
    { page, pageSize, total, rows },
    {
      headers: {
        "Cache-Control": "private, max-age=0, s-maxage=45, stale-while-revalidate=120",
      },
    },
  );
}
