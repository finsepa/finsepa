import type { CryptoMeta } from "@/lib/market/crypto-meta";

/** Minimal derived shape needed for mcap sort (avoids importing server-only layers). */
export type CryptoMcapDerived = Readonly<Record<string, { marketCapUsd?: number | null } | undefined>>;

/**
 * Sort key for screener crypto — snapshot `marketCapUsd` only (no EODHD, no server-only imports).
 * Missing caps sort last; cron/`crypto_derived` normally fills these.
 */
export function cryptoMarketCapSortKey(symbol: string, derived: CryptoMcapDerived): number {
  const mc = derived[symbol]?.marketCapUsd;
  if (typeof mc === "number" && Number.isFinite(mc) && mc > 0) return mc;
  return -1;
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
