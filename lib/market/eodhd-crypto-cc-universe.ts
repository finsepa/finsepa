import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_STATIC } from "@/lib/data/cache-policy";
import { fetchEodhdExchangeSymbolList } from "@/lib/market/eodhd-exchange-symbols";

export type CryptoCcUniverseRow = {
  base: string;
  name: string;
  /** EODHD pair e.g. `BTC-USD.CC` */
  eodhdTicker: string;
  marketCapUsd: number | null;
};

/** `CODE` from EODHD CC exchange list, e.g. `BTC-USD.CC`, `FLOKI-USD`, or `*-USDT`. */
function parseUsdCcPair(ticker: string): { base: string } | null {
  const t = ticker.trim().toUpperCase();
  let m = /^([A-Z0-9]+)-(USD|USDT)\.CC$/i.exec(t);
  if (!m) m = /^([A-Z0-9]+)-(USD|USDT)$/i.exec(t);
  if (!m) return null;
  const base = m[1]!;
  if (!base) return null;
  return { base };
}

async function loadEodhdCryptoCcSearchUniverseUncached(): Promise<CryptoCcUniverseRow[]> {
  const rows = await fetchEodhdExchangeSymbolList("CC");
  const byBase = new Map<string, CryptoCcUniverseRow>();

  for (const r of rows) {
    const p = parseUsdCcPair(r.ticker);
    if (!p) continue;
    const mc = r.marketCapUsd;
    const upperT = r.ticker.trim().toUpperCase();
    const eodhdTicker = upperT.endsWith(".CC")
      ? upperT
      : `${p.base}-USD.CC`;
    const next: CryptoCcUniverseRow = {
      base: p.base,
      name: (r.name || p.base).trim() || p.base,
      eodhdTicker,
      marketCapUsd: mc,
    };
    const prev = byBase.get(p.base);
    if (!prev || (mc ?? 0) > (prev.marketCapUsd ?? 0) || (prev.marketCapUsd == null && mc != null)) {
      byBase.set(p.base, next);
    }
  }

  const sorted = [...byBase.values()].sort((a, b) => {
    const mcA = a.marketCapUsd ?? -1;
    const mcB = b.marketCapUsd ?? -1;
    if (mcB !== mcA) return mcB - mcA;
    return a.base.localeCompare(b.base);
  });

  /** Full EODHD CC list (~2k+ USD/USDT pairs) — needed for global search + meta resolution (e.g. FLOKI). */
  return sorted;
}

/**
 * All crypto bases from EODHD exchange `CC` (list-supported-crypto-currencies / exchange-symbol-list CC).
 * Cached ~12h (same cadence as exchange-symbol-list).
 */
export const getEodhdCryptoCcSearchUniverse = unstable_cache(
  loadEodhdCryptoCcSearchUniverseUncached,
  ["eodhd-crypto-cc-search-universe-v2-full-cc-list"],
  { revalidate: REVALIDATE_STATIC },
);
