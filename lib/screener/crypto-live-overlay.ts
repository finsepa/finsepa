import type { CryptoTop10Row } from "@/lib/market/crypto-top10";
import {
  findCryptoLiveQuote,
  overlayCryptoLiveQuote,
  type CryptoLiveQuote,
} from "@/lib/market/crypto-live-quotes-shared";

/** Screener / movers rows with live exchange price + UTC-day 1D %; uncovered coins unchanged. */
export function overlayCryptoTop10Rows(
  rows: CryptoTop10Row[],
  quotes: Record<string, CryptoLiveQuote> | null,
): CryptoTop10Row[] {
  if (!quotes || rows.length === 0) return rows;
  return rows.map((row) => overlayCryptoLiveQuote(row, findCryptoLiveQuote(quotes, row.symbol), "changePercent1D"));
}
