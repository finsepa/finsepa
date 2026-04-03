import { NextResponse } from "next/server";

import { getSimpleIndicesDerived, getSimpleMarketData } from "@/lib/market/simple-market-layer";
import { indicesTableRowsFromSimpleLayers } from "@/lib/screener/simple-screener-crypto-indices-rows";

export async function GET() {
  const [data, derived] = await Promise.all([getSimpleMarketData(), getSimpleIndicesDerived()]);
  return NextResponse.json(
    { rows: indicesTableRowsFromSimpleLayers(data, derived) },
    { headers: { "Cache-Control": "public, s-maxage=30" } },
  );
}

