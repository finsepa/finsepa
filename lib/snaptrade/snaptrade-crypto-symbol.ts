/**
 * Normalize SnapTrade / brokerage crypto tickers to Finsepa portfolio bases
 * (same convention as spreadsheet import: `BTC`, `ETH` — not `BTCUSD` / `BTC-USD`).
 *
 * Pure / isomorphic — safe for tests and the client.
 */

import { ALL_CRYPTO_METAS } from "@/lib/market/crypto-meta";

const CRYPTO_BY_BASE = new Map<string, { symbol: string; name: string }>();
for (const m of ALL_CRYPTO_METAS) {
  CRYPTO_BY_BASE.set(m.symbol.toUpperCase(), { symbol: m.symbol.toUpperCase(), name: m.name });
}

/** Longest bases first so `SHIB` wins over `HIB` if both existed. */
const CRYPTO_BASES_LONGEST_FIRST = [...CRYPTO_BY_BASE.keys()].sort((a, b) => b.length - a.length);

const PAIR_RE = /^([A-Z0-9]+)-(USD|USDT|EUR|GBP)$/i;
const CONCAT_QUOTE_RE = /^(USD|USDT)$/i;

function stripExchangeSuffix(raw: string): string {
  return raw.trim().toUpperCase().replace(/\.(US|NASDAQ|NYSE|CC)$/i, "");
}

/** True when SnapTrade instrument / security type looks like crypto. */
export function isSnaptradeCryptoTypeHint(typeRaw: unknown): boolean {
  if (typeof typeRaw === "string") {
    const s = typeRaw.toUpperCase();
    return s.includes("CRYPTO") || s === "CURRENCY" || s.includes("DIGITAL");
  }
  if (typeRaw && typeof typeRaw === "object" && !Array.isArray(typeRaw)) {
    const o = typeRaw as Record<string, unknown>;
    const code = typeof o.code === "string" ? o.code : null;
    const desc = typeof o.description === "string" ? o.description : null;
    return isSnaptradeCryptoTypeHint(code) || isSnaptradeCryptoTypeHint(desc);
  }
  return false;
}

/**
 * Map a broker ticker to Finsepa holding symbol + display name when it is crypto.
 * Returns `null` when the ticker should stay an equity-style symbol (caller keeps raw).
 */
export function normalizeSnaptradeCryptoSymbol(
  rawSymbol: string,
  opts?: { typeHint?: unknown; forceCrypto?: boolean },
): { symbol: string; name: string } | null {
  const s = stripExchangeSuffix(rawSymbol);
  if (!s || s === "USD" || s === "USDT") return null;

  const known = CRYPTO_BY_BASE.get(s);
  if (known) return known;

  const pair = PAIR_RE.exec(s);
  if (pair) {
    const base = pair[1]!.toUpperCase();
    const canon = CRYPTO_BY_BASE.get(base);
    if (canon) return canon;
    if (opts?.forceCrypto || isSnaptradeCryptoTypeHint(opts?.typeHint)) {
      return { symbol: base, name: base };
    }
    return null;
  }

  for (const base of CRYPTO_BASES_LONGEST_FIRST) {
    if (s === `${base}USD` || s === `${base}USDT`) {
      return CRYPTO_BY_BASE.get(base)!;
    }
  }

  // Unknown concatenated crypto (instrument typed as crypto): FOOUSD → FOO
  if (opts?.forceCrypto || isSnaptradeCryptoTypeHint(opts?.typeHint)) {
    const m = /^([A-Z0-9]{2,12})(USD|USDT)$/i.exec(s);
    if (m && CONCAT_QUOTE_RE.test(m[2]!)) {
      const base = m[1]!.toUpperCase();
      return CRYPTO_BY_BASE.get(base) ?? { symbol: base, name: base };
    }
  }

  return null;
}

/** Equity strip + crypto canonicalize for SnapTrade universal / position symbols. */
export function canonicalizeSnaptradeSymbol(
  rawSymbol: string,
  opts?: { typeHint?: unknown; nameHint?: string | null; forceCrypto?: boolean },
): { symbol: string; name: string } {
  const crypto = normalizeSnaptradeCryptoSymbol(rawSymbol, opts);
  if (crypto) {
    return {
      symbol: crypto.symbol,
      name: opts?.nameHint?.trim() || crypto.name,
    };
  }
  const symbol = stripExchangeSuffix(rawSymbol);
  return {
    symbol,
    name: opts?.nameHint?.trim() || symbol,
  };
}
