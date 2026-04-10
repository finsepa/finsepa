import "server-only";

import type { CryptoMeta } from "@/lib/market/crypto-meta";
import { ALL_CRYPTO_METAS, toSupportedCryptoTicker } from "@/lib/market/crypto-meta";
import { getEodhdCryptoCcSearchUniverse } from "@/lib/market/eodhd-crypto-cc-universe";

function extractCryptoBaseForRoute(symbolOrTicker: string): string | null {
  const raw = symbolOrTicker.trim();
  if (!raw) return null;
  const s = raw.toUpperCase();
  if (/^[A-Z0-9]{1,20}$/.test(s)) return s;
  const noCc = s.replace(/\.CC$/i, "");
  const pair = /^([A-Z0-9]+)-(USD|USDT|EUR|GBP)$/i.exec(noCc);
  if (pair) return pair[1]!.toUpperCase();
  return null;
}

/**
 * Resolves EODHD-backed {@link CryptoMeta} for chart/asset/news/performance — curated list first, then CC universe.
 */
export async function resolveCryptoMetaForProvider(symbolOrTicker: string): Promise<CryptoMeta | null> {
  const curatedTicker = toSupportedCryptoTicker(symbolOrTicker);
  if (curatedTicker) {
    const m = ALL_CRYPTO_METAS.find((x) => x.symbol.toUpperCase() === curatedTicker.toUpperCase());
    if (m) return m;
  }

  const base = extractCryptoBaseForRoute(symbolOrTicker);
  if (!base) return null;

  const staticMeta = ALL_CRYPTO_METAS.find((m) => m.symbol.toUpperCase() === base);
  if (staticMeta) return staticMeta;

  const uni = await getEodhdCryptoCcSearchUniverse();
  const row = uni.find((r) => r.base === base);
  if (!row) return null;

  return { symbol: row.base, name: row.name, eodhdSymbol: row.eodhdTicker };
}
