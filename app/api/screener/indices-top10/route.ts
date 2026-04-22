import { NextResponse } from "next/server";

import { CACHE_CONTROL_PUBLIC_HOT_FAST } from "@/lib/data/cache-policy";
import { getSimpleIndicesDerived, getSimpleMarketDataIndicesTab } from "@/lib/market/simple-market-layer";
import { indicesTableRowsFromSimpleLayers } from "@/lib/screener/simple-screener-crypto-indices-rows";

export async function GET() {
  const [data, derived] = await Promise.all([getSimpleMarketDataIndicesTab(), getSimpleIndicesDerived()]);
  return NextResponse.json(
    { rows: indicesTableRowsFromSimpleLayers(data, derived) },
    { headers: { "Cache-Control": CACHE_CONTROL_PUBLIC_HOT_FAST } },
  );
}

