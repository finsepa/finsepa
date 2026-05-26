import "server-only";

import { withScreenerUsMarketCache } from "@/lib/screener/screener-us-market-cache";
import { getScreenerUsMarketCacheEpoch } from "@/lib/screener/screener-us-market-cache";
import { getEodhdApiKey } from "@/lib/env/server";
import { fetchEodhdEodDailyScreener, type EodhdDailyBar } from "@/lib/market/eodhd-eod";
import { fetchEodhdUsRealtimeBatch } from "@/lib/market/eodhd-realtime";
import { toEodhdUsSymbol } from "@/lib/market/eodhd-symbol";
import { deriveMetricsFromDailyBars, eodFetchWindowUtc } from "@/lib/screener/eod-derived-metrics";
import {
  SCREENER_SECTOR_TABLE_ORDER,
  type ScreenerCanonicalSector,
} from "@/lib/screener/screener-gics-sectors";
import { SCREENER_EOD_DERIVED_STOCK_CONCURRENCY } from "@/lib/screener/screener-scale-config";
import { runWithConcurrencyLimit } from "@/lib/utils/run-with-concurrency-limit";

/**
 * SPDR Select Sector ETFs (US) — one per canonical GICS sector row in the Screener table.
 * Used when EODHD screener rows omit `refund_ytd_p` so cap-weighted sector YTD would otherwise be empty.
 */
const CANONICAL_TO_ETF: Record<ScreenerCanonicalSector, string> = {
  Technology: "XLK",
  Financials: "XLF",
  Healthcare: "XLV",
  "Consumer Discretionary": "XLY",
  "Communication Services": "XLC",
  Industrials: "XLI",
  "Consumer Staples": "XLP",
  Energy: "XLE",
  Materials: "XLB",
  "Real Estate": "XLRE",
  Utilities: "XLU",
};

const SECTOR_ETF_TICKERS = [...new Set(SCREENER_SECTOR_TABLE_ORDER.map((s) => CANONICAL_TO_ETF[s]))];

function emptySectorYtdMap(): Record<ScreenerCanonicalSector, number | null> {
  return Object.fromEntries(SCREENER_SECTOR_TABLE_ORDER.map((s) => [s, null])) as Record<
    ScreenerCanonicalSector,
    number | null
  >;
}

/** Same live-vs-last-close rule as `barsToStockDerived` in `simple-market-layer` (not exported). */
function ytdPercentFromBars(bars: EodhdDailyBar[], livePrice: number | null | undefined): number | null {
  if (!bars.length) return null;
  const lastClose = (() => {
    const c = bars[bars.length - 1]?.close;
    return typeof c === "number" && Number.isFinite(c) ? c : null;
  })();
  const currentPrice =
    livePrice != null && Number.isFinite(livePrice) && livePrice > 0 ? livePrice : lastClose;
  if (currentPrice == null) return null;
  const d = deriveMetricsFromDailyBars(bars, currentPrice);
  return d.changePercentYTD;
}

async function loadSectorEtfProxyYtdUncached(): Promise<Record<ScreenerCanonicalSector, number | null>> {
  const out = emptySectorYtdMap();
  if (!getEodhdApiKey()) return out;

  const epoch = getScreenerUsMarketCacheEpoch();
  const window = eodFetchWindowUtc();
  const barsPerTicker = await runWithConcurrencyLimit(SECTOR_ETF_TICKERS, SCREENER_EOD_DERIVED_STOCK_CONCURRENCY, (t) =>
    fetchEodhdEodDailyScreener(t, window.from, window.to),
  );

  const rtMap =
    epoch.mode === "live" ? await fetchEodhdUsRealtimeBatch(SECTOR_ETF_TICKERS) : new Map<string, { close?: number }>();

  const ytdByTicker = new Map<string, number | null>();
  SECTOR_ETF_TICKERS.forEach((ticker, i) => {
    const raw = barsPerTicker[i];
    const bars = Array.isArray(raw) ? raw : [];
    const sym = toEodhdUsSymbol(ticker).toUpperCase();
    const rt = rtMap.get(sym);
    const live =
      epoch.mode === "live" &&
      typeof rt?.close === "number" &&
      Number.isFinite(rt.close) &&
      rt.close > 0
        ? rt.close
        : null;
    const tk = ticker.trim().toUpperCase();
    ytdByTicker.set(tk, ytdPercentFromBars(bars, live));
  });

  for (const sector of SCREENER_SECTOR_TABLE_ORDER) {
    const etf = CANONICAL_TO_ETF[sector];
    out[sector] = ytdByTicker.get(etf.toUpperCase()) ?? null;
  }
  return out;
}

/**
 * YTD % from sector ETF daily bars + live quote (EODHD), keyed by canonical sector name.
 * Intended as a fallback when universe cap-weighted YTD is missing.
 */
export async function getScreenerSectorEtfProxyYtdBySector(): Promise<
  Record<ScreenerCanonicalSector, number | null>
> {
  return withScreenerUsMarketCache("screener-sector-etf-proxy-ytd-v2-session", () => loadSectorEtfProxyYtdUncached());
}
