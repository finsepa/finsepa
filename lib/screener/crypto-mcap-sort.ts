import type { CryptoMeta } from "@/lib/market/crypto-meta";
import { resolveCryptoMarketCapUsd } from "@/lib/market/crypto-mcap-fallback";

/** Minimal derived shape needed for mcap sort (avoids importing server-only layers). */
export type CryptoMcapDerived = Readonly<Record<string, { marketCapUsd?: number | null } | undefined>>;

/**
 * Sort key for screener crypto — prefer snapshot `marketCapUsd`, else curated fallback.
 * Also replaces junk tiny provider caps (HYPE ~$8k) with the fallback so majors stay on page 1.
 */
export function cryptoMarketCapSortKey(symbol: string, derived: CryptoMcapDerived): number {
  return resolveCryptoMarketCapUsd(symbol, derived[symbol]?.marketCapUsd) ?? -1;
}

/** Largest market cap first; stable by symbol. */
export function sortCryptoMetasByMarketCap(
  metas: readonly CryptoMeta[],
  derived: CryptoMcapDerived,
): CryptoMeta[] {
  return [...metas].sort((a, b) => {
    const d = cryptoMarketCapSortKey(b.symbol, derived) - cryptoMarketCapSortKey(a.symbol, derived);
    if (d !== 0) return d;
    return a.symbol.localeCompare(b.symbol);
  });
}
