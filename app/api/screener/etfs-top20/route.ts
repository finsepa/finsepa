import { NextResponse } from "next/server";

import { CACHE_CONTROL_PUBLIC_HOT_FAST } from "@/lib/data/cache-policy";
import { getSimpleEtfsDerived, getSimpleMarketDataEtfsTab } from "@/lib/market/simple-market-layer";
import { getScreenerEtfsTop20 } from "@/lib/screener/screener-etfs-universe";
import { etfsTableRowsFromSimpleLayers } from "@/lib/screener/simple-screener-crypto-indices-rows";

export async function GET() {
  const [metas, data, derived] = await Promise.all([
    getScreenerEtfsTop20(),
    getSimpleMarketDataEtfsTab(),
    getSimpleEtfsDerived(),
  ]);
  return NextResponse.json(
    { rows: etfsTableRowsFromSimpleLayers(data, derived, metas) },
    { headers: { "Cache-Control": CACHE_CONTROL_PUBLIC_HOT_FAST } },
  );
}
