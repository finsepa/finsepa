import { NextResponse } from "next/server";

import { getCryptoLogoUrl } from "@/lib/crypto/crypto-logo-url";
import { getSimpleCryptoDerived, getSimpleMarketData } from "@/lib/market/simple-market-layer";
import { reducedCryptoMarketCapDisplay } from "@/lib/market/reduced-universe";

export async function GET() {
  const [data, derived] = await Promise.all([getSimpleMarketData(), getSimpleCryptoDerived()]);
  return NextResponse.json(
    {
      rows: [
        {
          symbol: "BTC",
          name: "Bitcoin",
          logoUrl: getCryptoLogoUrl("BTC"),
          price: data.BTC.price,
          changePercent1D: data.BTC.changePercent1D,
          changePercent1M: derived.BTC.changePercent1M,
          changePercentYTD: derived.BTC.changePercentYTD,
          marketCap: reducedCryptoMarketCapDisplay("BTC"),
          sparkline5d: derived.BTC.last5DailyCloses,
        },
        {
          symbol: "ETH",
          name: "Ethereum",
          logoUrl: getCryptoLogoUrl("ETH"),
          price: data.ETH.price,
          changePercent1D: data.ETH.changePercent1D,
          changePercent1M: derived.ETH.changePercent1M,
          changePercentYTD: derived.ETH.changePercentYTD,
          marketCap: reducedCryptoMarketCapDisplay("ETH"),
          sparkline5d: derived.ETH.last5DailyCloses,
        },
      ],
    },
    { headers: { "Cache-Control": "public, s-maxage=30" } },
  );
}

