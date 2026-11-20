/**
 * Circular flag assets for FX pairs (`/public/flags/*.svg`).
 * Client-safe — used by screener / asset chrome.
 */

const CURRENCY_FLAG_SRC: Readonly<Record<string, string>> = {
  USD: "/flags/us.svg",
  EUR: "/flags/eu.svg",
  GBP: "/flags/gb.svg",
  AUD: "/flags/au.svg",
  NZD: "/flags/nz.svg",
  CAD: "/flags/ca.svg",
  JPY: "/flags/jp.svg",
};

/** Strip `.FOREX` / whitespace → 6-letter pair code when possible. */
export function normalizeForexPairCode(symbolOrCode: string): string | null {
  let s = symbolOrCode.trim().toUpperCase();
  if (!s) return null;
  if (s.endsWith(".FOREX")) s = s.slice(0, -6);
  if (/^[A-Z]{6}$/.test(s)) return s;
  return null;
}

export function parseForexPairCurrencies(
  symbolOrCode: string,
): { base: string; quote: string } | null {
  const code = normalizeForexPairCode(symbolOrCode);
  if (!code) return null;
  return { base: code.slice(0, 3), quote: code.slice(3) };
}

export function currencyFlagSrc(currencyCode: string): string | null {
  return CURRENCY_FLAG_SRC[currencyCode.trim().toUpperCase()] ?? null;
}

export function forexPairFlagSrcs(
  symbolOrCode: string,
): { baseSrc: string; quoteSrc: string; base: string; quote: string } | null {
  const pair = parseForexPairCurrencies(symbolOrCode);
  if (!pair) return null;
  const baseSrc = currencyFlagSrc(pair.base);
  const quoteSrc = currencyFlagSrc(pair.quote);
  if (!baseSrc || !quoteSrc) return null;
  return { baseSrc, quoteSrc, base: pair.base, quote: pair.quote };
}
