import "server-only";

import { getCryptoPerformance } from "@/lib/market/crypto-performance";
import { cryptoRealtimeRequestSymbols, pickCryptoRealtimePayload } from "@/lib/market/crypto-meta";
import { resolveCryptoMetaForProvider } from "@/lib/market/crypto-meta-resolver";
import { fetchEodhdIntraday } from "@/lib/market/eodhd-intraday";
import { fetchEodhdRealtimeSymbolsRaw } from "@/lib/market/eodhd-realtime";

/**
 * Best-effort spot USD for portfolio / live-price routes.
 * Uses the same **daily last close** as crypto asset pages and `/api/crypto/.../performance` first, so portfolio
 * prices match what users see when they open an asset. Falls back to EODHD real-time, then 24h intraday 5m.
 */
export async function getCryptoLiveSpotPriceUsd(routeSymbol: string): Promise<number | null> {
  const trimmed = routeSymbol.trim();
  const perf = await getCryptoPerformance(trimmed);
  if (typeof perf.price === "number" && Number.isFinite(perf.price) && perf.price > 0) {
    return perf.price;
  }

  const meta = await resolveCryptoMetaForProvider(trimmed);
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
