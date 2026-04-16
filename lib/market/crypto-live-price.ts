import "server-only";

import { cryptoRealtimeRequestSymbols, pickCryptoRealtimePayload } from "@/lib/market/crypto-meta";
import { resolveCryptoMetaForProvider } from "@/lib/market/crypto-meta-resolver";
import { fetchEodhdIntraday } from "@/lib/market/eodhd-intraday";
import { fetchEodhdRealtimeSymbolsRaw } from "@/lib/market/eodhd-realtime";

/**
 * Best-effort spot USD for portfolio / live-price routes.
 * Prefers EODHD **real-time** (same as screener), then last 24h intraday 5m bar, so values track the market
 * instead of freezing at the last trade fill when the workspace hydrates.
 */
export async function getCryptoLiveSpotPriceUsd(routeSymbol: string): Promise<number | null> {
  const meta = await resolveCryptoMetaForProvider(routeSymbol.trim());
  if (!meta) return null;

  const rtSymbols = cryptoRealtimeRequestSymbols([meta]);
  if (rtSymbols.length > 0) {
    const map = await fetchEodhdRealtimeSymbolsRaw(rtSymbols);
    const rt = pickCryptoRealtimePayload(map, meta);
    const live = rt?.close;
    if (typeof live === "number" && Number.isFinite(live) && live > 0) return live;
  }

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
