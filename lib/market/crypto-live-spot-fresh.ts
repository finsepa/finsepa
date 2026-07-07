import "server-only";

import {
  cryptoRealtimeRequestSymbols,
  eodhdSymbolsForMeta,
  pickCryptoRealtimePayload,
} from "@/lib/market/crypto-meta";
import { resolveCryptoMetaForProvider } from "@/lib/market/crypto-meta-resolver";
import { getCryptoPerformance } from "@/lib/market/crypto-performance";
import { fetchLatestCryptoMinuteBarFromDb } from "@/lib/market/crypto-session-minute-bar-store";
import { fetchEodhdIntraday } from "@/lib/market/eodhd-intraday";
import { fetchEodhdRealtimeSymbolsRaw } from "@/lib/market/eodhd-realtime";

export type CryptoLiveSpotSource = "ws" | "realtime" | "intraday" | "performance";

export type CryptoLiveSpot = {
  price: number;
  /** Data timestamp of the quote (UNIX seconds) — not the render/response time. */
  quotedAtSec: number;
  source: CryptoLiveSpotSource;
};

/** WS bar is only trusted as "live" if its minute bucket is at most this old. */
const WS_FRESHNESS_SEC = 5 * 60;

function isPositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/**
 * Freshest spot USD for a **live 24/7 crypto** header (BTC).
 *
 * Source priority (freshest first): live WS minute close → EODHD realtime → latest intraday bar →
 * daily-close performance (last resort). Returns the data timestamp so the header can show when the
 * quote is from, instead of the current render time.
 *
 * Distinct from {@link import("@/lib/market/crypto-live-price").getCryptoLiveSpotPriceUsd}, which
 * intentionally prefers the daily close so portfolio prices match asset pages — that ordering freezes
 * the header intraday, which is wrong for an always-open asset.
 */
export async function getCryptoLiveSpotForHeader(routeSymbol: string): Promise<CryptoLiveSpot | null> {
  const trimmed = routeSymbol.trim();
  const nowSec = Math.floor(Date.now() / 1000);

  // 1) Live WS minute close (Supabase) — freshest when the ingest worker is up.
  const wsBar = await fetchLatestCryptoMinuteBarFromDb(trimmed);
  if (wsBar && isPositive(wsBar.close) && wsBar.bucket_unix >= nowSec - WS_FRESHNESS_SEC) {
    return { price: wsBar.close, quotedAtSec: wsBar.bucket_unix, source: "ws" };
  }

  const meta = await resolveCryptoMetaForProvider(trimmed);

  // 2) EODHD realtime quote.
  if (meta) {
    const rtSymbols = cryptoRealtimeRequestSymbols([meta]);
    if (rtSymbols.length > 0) {
      const map = await fetchEodhdRealtimeSymbolsRaw(rtSymbols);
      const rt = pickCryptoRealtimePayload(map, meta);
      if (rt && isPositive(rt.close)) {
        const ts = typeof rt.timestamp === "number" && Number.isFinite(rt.timestamp)
          ? (rt.timestamp > 1e12 ? Math.floor(rt.timestamp / 1000) : Math.floor(rt.timestamp))
          : nowSec;
        return { price: rt.close, quotedAtSec: ts, source: "realtime" };
      }
    }
  }

  // 3) Latest intraday bar (1m, then 5m) over the last 24h.
  if (meta) {
    const from = nowSec - 24 * 60 * 60;
    for (const interval of ["1m", "5m"] as const) {
      for (const pair of eodhdSymbolsForMeta(meta)) {
        const bars = await fetchEodhdIntraday(pair, from, nowSec, interval);
        const last = bars?.[bars.length - 1];
        if (last && isPositive(last.close)) {
          return { price: last.close, quotedAtSec: Math.floor(last.timestamp), source: "intraday" };
        }
      }
    }
  }

  // 4) Daily-close performance — last resort (frozen intraday, but better than nothing).
  const perf = await getCryptoPerformance(trimmed);
  if (isPositive(perf.price)) {
    return { price: perf.price, quotedAtSec: nowSec, source: "performance" };
  }

  return null;
}
