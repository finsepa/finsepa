import "server-only";

import { resolveCryptoMetaForProvider } from "@/lib/market/crypto-meta-resolver";
import { fetchEodhdIntraday } from "@/lib/market/eodhd-intraday";

/**
 * Last intraday close for the rolling 24h window (5m bars), matching crypto asset page 1D chart semantics.
 * Falls back callers should use daily performance close when this returns null.
 */
export async function getCryptoLiveSpotPriceUsd(routeSymbol: string): Promise<number | null> {
  const meta = await resolveCryptoMetaForProvider(routeSymbol.trim());
  if (!meta) return null;

  const candidates =
    meta.symbol === "TON" && meta.eodhdAltSymbols?.length
      ? [meta.eodhdSymbol, ...meta.eodhdAltSymbols]
      : [meta.eodhdSymbol];

  const nowSec = Math.floor(Date.now() / 1000);
  const from = nowSec - 24 * 60 * 60;

  for (const pair of candidates) {
    const bars = await fetchEodhdIntraday(pair, from, nowSec, "5m");
    if (!bars?.length) continue;
    const last = bars[bars.length - 1]!;
    const c = last.close;
    if (typeof c === "number" && Number.isFinite(c) && c > 0) return c;
  }
  return null;
}
