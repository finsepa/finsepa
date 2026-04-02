import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSimpleMarketData, getSimpleScreenerDerived } from "@/lib/market/simple-market-layer";
import { companyLogoUrlFromDomain } from "@/lib/screener/company-logo-url";
import { REDUCED_STOCKS, reducedStockMarketCapDisplay, reducedStockPeDisplay } from "@/lib/market/reduced-universe";
import { TOP10_META } from "@/lib/screener/top10-config";
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

  const allRows: ScreenerTableRow[] = [
    {
      id: 1,
      ticker: "NVDA",
      name: "NVIDIA",
      logoUrl: companyLogoUrlFromDomain(TOP10_META.NVDA.domain),
      price: data.NVDA.price,
      change1D: data.NVDA.changePercent1D,
      change1M: derived.NVDA.changePercent1M,
      changeYTD: derived.NVDA.changePercentYTD,
      marketCap: reducedStockMarketCapDisplay("NVDA"),
      pe: reducedStockPeDisplay("NVDA"),
      trend: derived.NVDA.last5DailyCloses,
    },
    {
      id: 2,
      ticker: "AAPL",
      name: "Apple",
      logoUrl: companyLogoUrlFromDomain(TOP10_META.AAPL.domain),
      price: data.AAPL.price,
      change1D: data.AAPL.changePercent1D,
      change1M: derived.AAPL.changePercent1M,
      changeYTD: derived.AAPL.changePercentYTD,
      marketCap: reducedStockMarketCapDisplay("AAPL"),
      pe: reducedStockPeDisplay("AAPL"),
      trend: derived.AAPL.last5DailyCloses,
    },
  ];

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
