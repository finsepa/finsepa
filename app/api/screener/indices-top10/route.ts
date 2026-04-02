import { NextResponse } from "next/server";

import type { IndexTableRow } from "@/lib/market/indices-top10";
import { getSimpleIndicesDerived, getSimpleMarketData } from "@/lib/market/simple-market-layer";

export async function GET() {
  const [data, derived] = await Promise.all([getSimpleMarketData(), getSimpleIndicesDerived()]);
  const rows: IndexTableRow[] = [
    {
      name: "S&P 500",
      symbol: "GSPC.INDX",
      value: data.SPX.price ?? Number.NaN,
      change1D: data.SPX.changePercent1D ?? Number.NaN,
      change1M: derived.SPX.changePercent1M,
      changeYTD: derived.SPX.changePercentYTD,
      spark5d: derived.SPX.last5DailyCloses,
    },
    {
      name: "Nasdaq 100",
      symbol: "NDX.INDX",
      value: data.NDX.price ?? Number.NaN,
      change1D: data.NDX.changePercent1D ?? Number.NaN,
      change1M: derived.NDX.changePercent1M,
      changeYTD: derived.NDX.changePercentYTD,
      spark5d: derived.NDX.last5DailyCloses,
    },
  ];

  return NextResponse.json({ rows }, { headers: { "Cache-Control": "public, s-maxage=30" } });
}

