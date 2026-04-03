import "server-only";

import type { IndexCardData } from "@/lib/screener/indices-today";
import type { ScreenerTableRow } from "@/lib/screener/screener-static";
import type { CryptoTop10Row } from "@/lib/market/crypto-top10";
import type { IndexTableRow } from "@/lib/market/indices-top10";

import { companyLogoUrlFromDomain } from "@/lib/screener/company-logo-url";
import { TOP10_META, TOP10_TICKERS, type Top10Ticker } from "@/lib/screener/top10-config";
import { reducedStockMarketCapDisplay, reducedStockPeDisplay } from "@/lib/market/reduced-universe";
import {
  getSimpleCryptoDerived,
  getSimpleIndicesDerived,
  getSimpleMarketData,
  getSimpleScreenerDerived,
} from "@/lib/market/simple-market-layer";
import { getSimpleIndexCards } from "@/lib/screener/simple-index-cards";
import {
  cryptoTop10RowsFromSimpleLayers,
  indicesTableRowsFromSimpleLayers,
} from "@/lib/screener/simple-screener-crypto-indices-rows";

export type ScreenerPagePayload = {
  stockRows: ScreenerTableRow[];
  cryptoRows: CryptoTop10Row[];
  indicesRows: IndexTableRow[];
  indexCards: IndexCardData[];
};

export async function buildScreenerPagePayload(): Promise<ScreenerPagePayload> {
  const [data, stockDerived, cryptoDerived, indicesDerived, indexCards] = await Promise.all([
    getSimpleMarketData(),
    getSimpleScreenerDerived(),
    getSimpleCryptoDerived(),
    getSimpleIndicesDerived(),
    getSimpleIndexCards(),
  ]);

  const stockRows: ScreenerTableRow[] = TOP10_TICKERS.map((ticker: Top10Ticker, i: number) => {
    const q = data.stocks[ticker];
    const s = stockDerived[ticker];
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

  const cryptoRows = cryptoTop10RowsFromSimpleLayers(data, cryptoDerived);
  const indicesRows = indicesTableRowsFromSimpleLayers(data, indicesDerived);

  return { stockRows, cryptoRows, indicesRows, indexCards };
}
