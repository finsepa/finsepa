import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_STOCK_1D_LIVE_SPOT, REVALIDATE_WARM } from "@/lib/data/cache-policy";
import {
  isCryptoIntradayCandleInterval,
  type CryptoCandleInterval,
  type CryptoCandlesResponse,
} from "@/lib/market/crypto-candles-shared";
import { isCryptoLive1DSymbol, normalizeCryptoBaseSymbol } from "@/lib/market/crypto-live-1d-tickers";
import { eodhdSymbolsForMeta } from "@/lib/market/crypto-meta";
import { resolveCryptoMetaForProvider } from "@/lib/market/crypto-meta-resolver";
import { fetchCryptoMinuteBarsFromDb } from "@/lib/market/crypto-session-minute-bar-store";
import { fetchEodhdDailyOhlc, fetchEodhdIntradayOhlc, type OhlcBar } from "@/lib/market/eodhd-ohlc";

type HistorySource = "1m" | "5m" | "1h" | "d";

const DAY_SEC = 86_400;

const SOURCE_SEC: Record<HistorySource, number> = { "1m": 60, "5m": 300, "1h": 3_600, d: DAY_SEC };

/** EODHD source bars per interval; window keeps each response around 1–1.5k candles. */
const INTERVAL_CONFIG: Record<
  CryptoCandleInterval,
  { source: HistorySource; bucketSec: number; windowSec: number }
> = {
  "1m": { source: "1m", bucketSec: 60, windowSec: DAY_SEC },
  "5m": { source: "5m", bucketSec: 300, windowSec: 5 * DAY_SEC },
  "15m": { source: "5m", bucketSec: 900, windowSec: 12 * DAY_SEC },
  "30m": { source: "5m", bucketSec: 1_800, windowSec: 25 * DAY_SEC },
  "1h": { source: "1h", bucketSec: 3_600, windowSec: 60 * DAY_SEC },
  "4h": { source: "1h", bucketSec: 4 * 3_600, windowSec: 240 * DAY_SEC },
  "1D": { source: "d", bucketSec: DAY_SEC, windowSec: 4 * 365 * DAY_SEC },
  "1W": { source: "d", bucketSec: 7 * DAY_SEC, windowSec: 12 * 365 * DAY_SEC },
};

/** Live minute rows read back at most this far — stays under the 2,000-row paged read cap. */
const MAX_LIVE_TAIL_SEC = 30 * 3_600;

/** 1970-01-05 00:00 UTC was a Monday — weekly candles start on Mondays like exchange charts. */
const WEEK_ANCHOR_SEC = 4 * DAY_SEC;

function bucketStart(timeSec: number, interval: CryptoCandleInterval): number {
  const { bucketSec } = INTERVAL_CONFIG[interval];
  if (interval === "1W") {
    return Math.floor((timeSec - WEEK_ANCHOR_SEC) / bucketSec) * bucketSec + WEEK_ANCHOR_SEC;
  }
  return Math.floor(timeSec / bucketSec) * bucketSec;
}

function aggregateBars(bars: readonly OhlcBar[], interval: CryptoCandleInterval): OhlcBar[] {
  const out: OhlcBar[] = [];
  for (const bar of bars) {
    const time = bucketStart(bar.time, interval);
    const last = out[out.length - 1];
    if (last && last.time === time) {
      last.high = Math.max(last.high, bar.high);
      last.low = Math.min(last.low, bar.low);
      last.close = bar.close;
      if (bar.volume != null) last.volume = (last.volume ?? 0) + bar.volume;
    } else {
      out.push({ time, open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume });
    }
  }
  return out;
}

function utcYmd(sec: number): string {
  return new Date(sec * 1000).toISOString().slice(0, 10);
}

async function fetchHistorySourceBars(pair: string, interval: CryptoCandleInterval): Promise<OhlcBar[]> {
  const { source, windowSec, bucketSec } = INTERVAL_CONFIG[interval];
  const now = Math.floor(Date.now() / 1000);
  const from = now - windowSec - bucketSec;
  if (source === "d") {
    const bars = await fetchEodhdDailyOhlc(pair, utcYmd(from), utcYmd(now));
    return (bars ?? []).map(({ time, open, high, low, close, volume }) => ({ time, open, high, low, close, volume }));
  }
  return (await fetchEodhdIntradayOhlc(pair, from, now, source)) ?? [];
}

const getHistorySourceBars = unstable_cache(fetchHistorySourceBars, ["crypto-candles-history-v1"], {
  revalidate: REVALIDATE_WARM,
});

/**
 * Patch candles with live 1m closes newer than the provider history. Minute closes carry no volume, so
 * live-only candles have none; wicks come from the spread of minute closes inside each bucket.
 */
function mergeLiveTail(
  candles: OhlcBar[],
  closes: readonly { time: number; value: number }[],
  interval: CryptoCandleInterval,
): OhlcBar[] {
  for (const point of closes) {
    const time = bucketStart(point.time, interval);
    const last = candles[candles.length - 1];
    if (last && time < last.time) continue;
    if (last && last.time === time) {
      last.high = Math.max(last.high, point.value);
      last.low = Math.min(last.low, point.value);
      last.close = point.value;
    } else {
      const open = last?.close ?? point.value;
      candles.push({
        time,
        open,
        high: Math.max(open, point.value),
        low: Math.min(open, point.value),
        close: point.value,
      });
    }
  }
  return candles;
}

async function loadCryptoCandlesUncached(
  base: string,
  requestedInterval: CryptoCandleInterval,
): Promise<CryptoCandlesResponse> {
  const live = isCryptoLive1DSymbol(base);
  const interval: CryptoCandleInterval =
    !live && isCryptoIntradayCandleInterval(requestedInterval) ? "1D" : requestedInterval;
  const empty: CryptoCandlesResponse = { symbol: base, interval, candles: [], live: false };

  const meta = await resolveCryptoMetaForProvider(base);
  if (!meta?.eodhdSymbol) return empty;

  let sourceBars: OhlcBar[] = [];
  for (const pair of eodhdSymbolsForMeta(meta)) {
    sourceBars = await getHistorySourceBars(pair, interval);
    if (sourceBars.length) break;
  }

  const { source, windowSec } = INTERVAL_CONFIG[interval];
  let candles = aggregateBars(sourceBars, interval);

  let usedLiveTail = false;
  if (live) {
    const now = Math.floor(Date.now() / 1000);
    const lastSource = sourceBars[sourceBars.length - 1];
    // Daily bars already include today's forming day, so live closes refine that bar instead of starting after it.
    const historyEnd = lastSource ? lastSource.time + (source === "d" ? 0 : SOURCE_SEC[source]) : 0;
    const tailFrom = Math.max(historyEnd, now - MAX_LIVE_TAIL_SEC);
    const closes = await fetchCryptoMinuteBarsFromDb(base, tailFrom);
    if (closes.length) {
      candles = mergeLiveTail(candles, closes, interval);
      usedLiveTail = true;
    }
  }

  const cutoff = Math.floor(Date.now() / 1000) - windowSec;
  return {
    symbol: base,
    interval,
    candles: candles.filter((c) => c.time >= cutoff),
    live: usedLiveTail,
  };
}

const getCryptoCandlesCached = unstable_cache(loadCryptoCandlesUncached, ["crypto-candles-v1"], {
  revalidate: REVALIDATE_STOCK_1D_LIVE_SPOT,
});

/** OHLC candles for the crypto overview candle view — one shared cache entry per coin + interval. */
export async function loadCryptoCandles(
  symbol: string,
  interval: CryptoCandleInterval,
): Promise<CryptoCandlesResponse> {
  const base = normalizeCryptoBaseSymbol(symbol);
  if (!base) return { symbol: symbol.trim().toUpperCase(), interval, candles: [], live: false };
  return getCryptoCandlesCached(base, interval);
}
