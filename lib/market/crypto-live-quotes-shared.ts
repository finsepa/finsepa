import { normalizeCryptoBaseSymbol } from "@/lib/market/crypto-live-1d-tickers";

export type CryptoLiveQuoteSource = "binance" | "kraken" | "okx";

/** Live crypto spot from free exchange REST (no EODHD credits). */
export type CryptoLiveQuote = {
  price: number;
  /**
   * Open of the current UTC day (≈ prior UTC daily close). Basis for 1D %, matching the
   * EODHD `previousClose` semantics lists and portfolio already use.
   */
  utcOpen: number | null;
  source: CryptoLiveQuoteSource;
};

/** `GET /api/crypto/live-quotes` body — compact keys keep the ~500-coin payload small. */
export type CryptoLiveQuotesPayload = {
  asOfSec: number;
  quotes: Record<string, { p: number; o: number | null; s: CryptoLiveQuoteSource }>;
};

export function cryptoUtcDayChangePct(price: number, utcOpen: number | null | undefined): number | null {
  if (utcOpen == null || !Number.isFinite(utcOpen) || utcOpen <= 0) return null;
  if (!Number.isFinite(price) || price <= 0) return null;
  return ((price - utcOpen) / utcOpen) * 100;
}

export function cryptoLiveQuotesToPayload(
  quotes: Record<string, CryptoLiveQuote>,
  asOfSec: number,
): CryptoLiveQuotesPayload {
  const out: CryptoLiveQuotesPayload["quotes"] = {};
  for (const [base, q] of Object.entries(quotes)) {
    out[base] = { p: q.price, o: q.utcOpen, s: q.source };
  }
  return { asOfSec, quotes: out };
}

export function cryptoLiveQuotesFromPayload(payload: CryptoLiveQuotesPayload): Record<string, CryptoLiveQuote> {
  const out: Record<string, CryptoLiveQuote> = {};
  for (const [base, q] of Object.entries(payload.quotes ?? {})) {
    if (!q || !Number.isFinite(q.p) || q.p <= 0) continue;
    out[base] = { price: q.p, utcOpen: q.o ?? null, source: q.s };
  }
  return out;
}

/** Look up a live quote for any crypto symbol form (`BTC`, `BTC-USD`, `CRYPTO:BTC`, `BTC.CC`). */
export function findCryptoLiveQuote(
  quotes: Record<string, CryptoLiveQuote> | null | undefined,
  symbol: string,
): CryptoLiveQuote | null {
  if (!quotes) return null;
  const raw = String(symbol ?? "").trim().replace(/^crypto:/i, "");
  const base = normalizeCryptoBaseSymbol(raw);
  if (!base) return null;
  return quotes[base] ?? null;
}

/**
 * Overlay live price + 1D % onto a list row. Keeps the row's own 1D % when the UTC open is
 * unknown, so a partial exchange response never blanks a column.
 */
export function overlayCryptoLiveQuote<T extends { price: number | null }>(
  row: T,
  quote: CryptoLiveQuote | null,
  pctKey: keyof T,
): T {
  if (!quote) return row;
  const pct = cryptoUtcDayChangePct(quote.price, quote.utcOpen);
  const next = { ...row, price: quote.price } as T;
  if (pct != null) (next as Record<keyof T, unknown>)[pctKey] = pct;
  return next;
}
