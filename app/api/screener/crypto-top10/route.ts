import { NextResponse } from "next/server";

import { getSimpleCryptoDerivedTop10, getSimpleMarketDataCryptoTab } from "@/lib/market/simple-market-layer";
import { cryptoTop10RowsFromSimpleLayers } from "@/lib/screener/simple-screener-crypto-indices-rows";

export async function GET() {
  const [data, derived] = await Promise.all([getSimpleMarketDataCryptoTab(), getSimpleCryptoDerivedTop10()]);
  return NextResponse.json(
    { rows: cryptoTop10RowsFromSimpleLayers(data, derived) },
    { headers: { "Cache-Control": "public, s-maxage=30" } },
  );
}

