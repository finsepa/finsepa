import { ALL_CRYPTO_METAS } from "@/lib/market/crypto-meta";

/**
 * Base ticker → platform display name + symbol (same as screener / `/crypto/[symbol]`).
 * Built from {@link ALL_CRYPTO_METAS} so imports align with asset pages.
 */
const CRYPTO_BY_BASE = new Map<string, { name: string; symbol: string }>();
for (const m of ALL_CRYPTO_METAS) {
  CRYPTO_BY_BASE.set(m.symbol.toUpperCase(), { name: m.name, symbol: m.symbol.toUpperCase() });
}

function cryptoCanonical(base: string): { name: string; symbol: string } | null {
  return CRYPTO_BY_BASE.get(base.toUpperCase()) ?? null;
}

/**
 * Normalizes spreadsheet symbols (e.g. BTC-USD, BNB-USDT) for the import grid and commit.
 * Known crypto pairs map to platform name + base ticker (e.g. Bitcoin / BTC), not pair tickers.
 * Unknown `BASE-USD` rows use `BASE` as the label; `quoteSymbol` is the base ticker (`BTC`, `FLOKI`) for storage and APIs.
 */
const PAIR_RE = /^([A-Z0-9]+)-(USD|USDT|US)$/;

export function resolveImportAssetDisplay(raw: string): {
  display: string;
  quoteSymbol: string | null;
} {
  const trimmed = raw.trim();
  if (!trimmed) return { display: "", quoteSymbol: null };

  const upper = trimmed.toUpperCase().replace(/\s+/g, "");

  if (upper === "USD" || upper === "CASH" || upper === "US DOLLAR") {
    return { display: trimmed, quoteSymbol: null };
  }

  if (/^bitcoin\s*asset$/i.test(trimmed)) {
    const c = cryptoCanonical("BTC");
    return c ? { display: c.name, quoteSymbol: c.symbol } : { display: "Bitcoin", quoteSymbol: "BTC" };
  }
  if (/^ethereum\s*asset$/i.test(trimmed)) {
    const c = cryptoCanonical("ETH");
    return c ? { display: c.name, quoteSymbol: c.symbol } : { display: "Ethereum", quoteSymbol: "ETH" };
  }

  const pairMatch = upper.match(PAIR_RE);
  if (pairMatch) {
    const base = pairMatch[1]!;
    const canon = cryptoCanonical(base);
    if (canon) {
      return { display: canon.name, quoteSymbol: canon.symbol };
    }
    return { display: base, quoteSymbol: base };
  }

  const solo = upper.replace(/\.(US|CC)$/i, "");
  const canonSolo = cryptoCanonical(solo);
  if (canonSolo && solo === canonSolo.symbol) {
    return { display: canonSolo.name, quoteSymbol: canonSolo.symbol };
  }

  return { display: trimmed, quoteSymbol: null };
}
