import "server-only";

import { CRYPTO_TOP10 } from "@/lib/market/eodhd-crypto";
import { getCryptoLogoUrl } from "@/lib/crypto/crypto-logo-url";
import type { CryptoTop10Row } from "@/lib/market/crypto-top10";
import type { IndexTableRow } from "@/lib/market/indices-top10";
import type { SimpleCryptoDerived, SimpleIndicesDerived, SimpleMarketData } from "@/lib/market/simple-market-layer";
import { reducedCryptoMarketCapDisplay } from "@/lib/market/reduced-universe";
import { SCREENER_INDICES_10 } from "@/lib/screener/screener-indices-universe";

/** Screener crypto rows — same mapping as `/api/screener/crypto-top10`. */
export function cryptoTop10RowsFromSimpleLayers(
  data: SimpleMarketData,
  derived: SimpleCryptoDerived,
): CryptoTop10Row[] {
  return CRYPTO_TOP10.map((c) => {
    const sym = c.symbol;
    const q = data.crypto[sym];
    const d = derived[sym];
    return {
      symbol: sym,
      name: c.name,
      logoUrl: getCryptoLogoUrl(sym),
      price: q?.price ?? null,
      changePercent1D: q?.changePercent1D ?? null,
      changePercent1M: d?.changePercent1M ?? null,
      changePercentYTD: d?.changePercentYTD ?? null,
      marketCap: reducedCryptoMarketCapDisplay(sym),
      sparkline5d: d?.last5DailyCloses ?? [],
    };
  });
}

/** Screener indices rows — same mapping as `/api/screener/indices-top10` (10 benchmarks). */
export function indicesTableRowsFromSimpleLayers(
  data: SimpleMarketData,
  derived: SimpleIndicesDerived,
): IndexTableRow[] {
  return SCREENER_INDICES_10.map(({ name, symbol }) => {
    const q = data.indices[symbol];
    const d = derived[symbol];
    return {
      name,
      symbol,
      value: q?.price ?? Number.NaN,
      change1D: q?.changePercent1D ?? Number.NaN,
      change1M: d?.changePercent1M ?? null,
      changeYTD: d?.changePercentYTD ?? null,
      spark5d: d?.last5DailyCloses ?? [],
    };
  });
}
