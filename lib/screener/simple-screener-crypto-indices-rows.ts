import "server-only";

import type { CryptoMeta } from "@/lib/market/eodhd-crypto";
import { CRYPTO_TOP10 } from "@/lib/market/eodhd-crypto";
import { getCryptoLogoUrl } from "@/lib/crypto/crypto-logo-url";
import type { CryptoTop10Row } from "@/lib/market/crypto-top10";
import type { IndexTableRow } from "@/lib/market/indices-top10";
import type {
  CryptoDerivedSlice,
  SimpleCryptoDerived,
  SimpleIndicesDerived,
  SimpleMarketData,
} from "@/lib/market/simple-market-layer";
import { reducedCryptoMarketCapDisplay } from "@/lib/market/reduced-universe";
import { formatMarketCapCompactNoCurrency } from "@/lib/screener/eod-derived-metrics";
import { SCREENER_INDICES_10 } from "@/lib/screener/screener-indices-universe";

/** When realtime is missing, use last EOD close from the spark strip; 1D % needs two closes. */
function sparkFallbackPriceAnd1d(d: CryptoDerivedSlice | undefined): { price: number | null; change1d: number | null } {
  const s = d?.last5DailyCloses;
  if (!s || !s.length) return { price: null, change1d: null };
  const last = s[s.length - 1]!;
  if (!Number.isFinite(last) || last <= 0) return { price: null, change1d: null };
  if (s.length < 2) return { price: last, change1d: null };
  const prev = s[s.length - 2]!;
  const change1d =
    Number.isFinite(prev) && prev > 0 ? ((last - prev) / prev) * 100 : null;
  return { price: last, change1d };
}

function positiveSpotOrNull(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Screener crypto rows for a meta list — same mapping as `/api/screener/crypto-top10` (page 1). */
export function cryptoScreenerRowsFromMetas(
  metas: readonly CryptoMeta[],
  data: SimpleMarketData,
  derived: SimpleCryptoDerived,
): CryptoTop10Row[] {
  return metas.map((c) => {
    const sym = c.symbol;
    const q = data.crypto[sym];
    const d = derived[sym];
    const fb = sparkFallbackPriceAnd1d(d);
    const livePx = positiveSpotOrNull(q?.price);
    const price = livePx ?? positiveSpotOrNull(fb.price);
    const changePercent1D =
      livePx != null && q?.changePercent1D != null && Number.isFinite(q.changePercent1D)
        ? q.changePercent1D
        : fb.change1d;
    return {
      symbol: sym,
      name: c.name,
      logoUrl: getCryptoLogoUrl(sym),
      price,
      changePercent1D,
      changePercent1M: d?.changePercent1M ?? null,
      changePercentYTD: d?.changePercentYTD ?? null,
      marketCap: (() => {
        const mc = d?.marketCapUsd;
        if (mc != null && Number.isFinite(mc) && mc > 0) return formatMarketCapCompactNoCurrency(mc);
        return reducedCryptoMarketCapDisplay(sym);
      })(),
      sparkline5d: d?.last5DailyCloses ?? [],
    };
  });
}

/** Screener crypto rows — same mapping as `/api/screener/crypto-top10`. */
export function cryptoTop10RowsFromSimpleLayers(
  data: SimpleMarketData,
  derived: SimpleCryptoDerived,
): CryptoTop10Row[] {
  return cryptoScreenerRowsFromMetas(CRYPTO_TOP10, data, derived);
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
    };
  });
}
