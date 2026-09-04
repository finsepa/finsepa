/** Minimal quote shape for hub merges (avoids importing server-only modules). */
export type CryptoQuoteDatum = {
  price: number | null;
  previousClose?: number | null;
  changePercent1D?: number | null;
};

function hasPositiveCryptoPrice(d: CryptoQuoteDatum | null | undefined): boolean {
  return typeof d?.price === "number" && Number.isFinite(d.price) && d.price > 0;
}

/**
 * Merge crypto quote maps without letting null stubs from a partial hub (e.g. `crypto_page2`)
 * overwrite real prices from `crypto_tab`. Prefer a positive price; otherwise keep existing.
 */
export function mergeCryptoQuoteMaps<T extends CryptoQuoteDatum>(
  primary: Record<string, T>,
  secondary: Record<string, T>,
): Record<string, T> {
  const out: Record<string, T> = { ...primary };
  for (const [sym, datum] of Object.entries(secondary)) {
    if (!datum) continue;
    if (hasPositiveCryptoPrice(datum) || !hasPositiveCryptoPrice(out[sym])) {
      out[sym] = datum;
    }
  }
  return out;
}
