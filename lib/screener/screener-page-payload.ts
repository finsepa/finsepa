import "server-only";

import type { IndexCardData } from "@/lib/screener/indices-today";
import type { ScreenerTableRow } from "@/lib/screener/screener-static";
import type { CryptoTop10Row } from "@/lib/market/crypto-top10";
import type { IndexTableRow } from "@/lib/market/indices-top10";

import { companyLogoUrlFromDomain } from "@/lib/screener/company-logo-url";
import { TOP10_META } from "@/lib/screener/top10-config";
import { reducedStockMarketCapDisplay, reducedStockPeDisplay } from "@/lib/market/reduced-universe";
import { reducedCryptoMarketCapDisplay } from "@/lib/market/reduced-universe";
import { getCryptoLogoUrl } from "@/lib/crypto/crypto-logo-url";
import {
  getSimpleMarketData,
  getSimpleScreenerDerived,
} from "@/lib/market/simple-market-layer";
import { getSimpleIndexCards } from "@/lib/screener/simple-index-cards";

export type ScreenerPagePayload = {
  stockRows: ScreenerTableRow[];
  cryptoRows: CryptoTop10Row[];
  indicesRows: IndexTableRow[];
  indexCards: IndexCardData[];
};

export async function buildScreenerPagePayload(): Promise<ScreenerPagePayload> {
  // Optimize first paint: only compute data needed for default view (Stocks + top index cards).
  // Crypto + Indices tab rows are filled with price/1D now and upgraded on-demand when the user opens those tabs.
  const [data, stockDerived, indexCards] = await Promise.all([
    getSimpleMarketData(),
    getSimpleScreenerDerived(),
    getSimpleIndexCards(),
  ]);

  const stockRows: ScreenerTableRow[] = [
    {
      id: 1,
      ticker: "NVDA",
      name: "NVIDIA",
      logoUrl: companyLogoUrlFromDomain(TOP10_META.NVDA.domain),
      price: data.NVDA.price,
      change1D: data.NVDA.changePercent1D,
      change1M: stockDerived.NVDA.changePercent1M,
      changeYTD: stockDerived.NVDA.changePercentYTD,
      marketCap: reducedStockMarketCapDisplay("NVDA"),
      pe: reducedStockPeDisplay("NVDA"),
      trend: stockDerived.NVDA.last5DailyCloses,
    },
    {
      id: 2,
      ticker: "AAPL",
      name: "Apple",
      logoUrl: companyLogoUrlFromDomain(TOP10_META.AAPL.domain),
      price: data.AAPL.price,
      change1D: data.AAPL.changePercent1D,
      change1M: stockDerived.AAPL.changePercent1M,
      changeYTD: stockDerived.AAPL.changePercentYTD,
      marketCap: reducedStockMarketCapDisplay("AAPL"),
      pe: reducedStockPeDisplay("AAPL"),
      trend: stockDerived.AAPL.last5DailyCloses,
    },
  ];

  const cryptoRows: CryptoTop10Row[] = [
    {
      symbol: "BTC",
      name: "Bitcoin",
      logoUrl: getCryptoLogoUrl("BTC"),
      price: data.BTC.price,
      changePercent1D: data.BTC.changePercent1D,
      changePercent1M: null,
      changePercentYTD: null,
      marketCap: reducedCryptoMarketCapDisplay("BTC"),
      sparkline5d: [],
    },
    {
      symbol: "ETH",
      name: "Ethereum",
      logoUrl: getCryptoLogoUrl("ETH"),
      price: data.ETH.price,
      changePercent1D: data.ETH.changePercent1D,
      changePercent1M: null,
      changePercentYTD: null,
      marketCap: reducedCryptoMarketCapDisplay("ETH"),
      sparkline5d: [],
    },
  ];

  const indicesRows: IndexTableRow[] = [
    {
      name: "S&P 500",
      symbol: "GSPC.INDX",
      value: data.SPX.price ?? Number.NaN,
      change1D: data.SPX.changePercent1D ?? Number.NaN,
      change1M: null,
      changeYTD: null,
      spark5d: [],
    },
    {
      name: "Nasdaq 100",
      symbol: "NDX.INDX",
      value: data.NDX.price ?? Number.NaN,
      change1D: data.NDX.changePercent1D ?? Number.NaN,
      change1M: null,
      changeYTD: null,
      spark5d: [],
    },
  ];

  return { stockRows, cryptoRows, indicesRows, indexCards };
}

