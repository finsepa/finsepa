import "server-only";

import { unstable_cache } from "next/cache";

import { CRYPTO_TOP10, fetchEodhdCryptoDailyBars } from "@/lib/market/eodhd-crypto";
import { traceEodhdHttp } from "@/lib/market/provider-trace";
import { getEodhdApiKey } from "@/lib/env/server";
import { fetchEodhdEodDailyScreener, type EodhdDailyBar } from "@/lib/market/eodhd-eod";
import { deriveMetricsFromDailyBars, eodFetchWindowUtc } from "@/lib/screener/eod-derived-metrics";
import { TOP10_TICKERS, type Top10Ticker } from "@/lib/screener/top10-config";
import { SCREENER_INDEX_SYMBOLS } from "@/lib/screener/screener-indices-universe";
import { toEodhdUsSymbol } from "@/lib/market/eodhd-symbol";

type EodhdRealtimePayload = {
  code?: string;
  close?: number;
  previousClose?: number;
  change_p?: number;
};

export type SimpleMarketDatum = {
  price: number | null;
  previousClose: number | null;
  changePercent1D: number | null;
};

export type ScreenerCryptoSymbol = (typeof CRYPTO_TOP10)[number]["symbol"];

export type SimpleMarketData = {
  stocks: Record<Top10Ticker, SimpleMarketDatum>;
  crypto: Record<ScreenerCryptoSymbol, SimpleMarketDatum>;
  /** Screener + index cards: keyed by full EODHD symbol (e.g. GSPC.INDX). */
  indices: Record<string, SimpleMarketDatum>;
};

export type SimpleScreenerStockDerived = {
  changePercent7D: number | null;
  changePercent1M: number | null;
  changePercentYTD: number | null;
  last5DailyCloses: number[];
};

export type SimpleScreenerDerived = Record<Top10Ticker, SimpleScreenerStockDerived>;

export type CryptoDerivedSlice = {
  changePercent7D: number | null;
  changePercent1M: number | null;
  changePercentYTD: number | null;
  last5DailyCloses: number[];
};

export type SimpleCryptoDerived = Record<ScreenerCryptoSymbol, CryptoDerivedSlice>;

export type SimpleIndicesDerived = Record<string, CryptoDerivedSlice>;

function emptyDatum(): SimpleMarketDatum {
  return { price: null, previousClose: null, changePercent1D: null };
}

function emptyStockDerived(): SimpleScreenerStockDerived {
  return { changePercent7D: null, changePercent1M: null, changePercentYTD: null, last5DailyCloses: [] };
}

function emptyCryptoDerived(): CryptoDerivedSlice {
  return { changePercent7D: null, changePercent1M: null, changePercentYTD: null, last5DailyCloses: [] };
}

function parseRealtimeMultiJson(raw: unknown): Map<string, EodhdRealtimePayload> {
  const map = new Map<string, EodhdRealtimePayload>();
  const add = (row: unknown) => {
    if (!row || typeof row !== "object") return;
    const o = row as EodhdRealtimePayload & { error?: string };
    if ("error" in o && o.error) return;
    const code = typeof o.code === "string" ? o.code.trim().toUpperCase() : "";
    if (!code) return;
    map.set(code, o);
  };
  if (Array.isArray(raw)) {
    for (const item of raw) add(item);
  } else {
    add(raw);
  }
  return map;
}

function toDatum(p: EodhdRealtimePayload | undefined): SimpleMarketDatum {
  const price = typeof p?.close === "number" && Number.isFinite(p.close) ? p.close : null;
  const previousClose =
    typeof p?.previousClose === "number" && Number.isFinite(p.previousClose) ? p.previousClose : null;
  const changePercent1D =
    price != null && previousClose != null && previousClose > 0
      ? ((price - previousClose) / previousClose) * 100
      : null;

  return { price, previousClose, changePercent1D };
}

function buildEmptyMarketData(): SimpleMarketData {
  const stocks = {} as Record<Top10Ticker, SimpleMarketDatum>;
  for (const t of TOP10_TICKERS) stocks[t] = emptyDatum();
  const crypto = {} as Record<ScreenerCryptoSymbol, SimpleMarketDatum>;
  for (const c of CRYPTO_TOP10) crypto[c.symbol as ScreenerCryptoSymbol] = emptyDatum();
  const indices: Record<string, SimpleMarketDatum> = {};
  for (const sym of SCREENER_INDEX_SYMBOLS) indices[sym] = emptyDatum();
  return {
    stocks,
    crypto,
    indices,
  };
}

async function loadSimpleMarketDataUncached(): Promise<SimpleMarketData> {
  const key = getEodhdApiKey();
  const empty = buildEmptyMarketData();
  if (!key) return empty;

  const stockSymbols = TOP10_TICKERS.map((t) => toEodhdUsSymbol(t));
  const cryptoSymbols = CRYPTO_TOP10.map((c) => c.eodhdSymbol);
  const symbols = [...stockSymbols, ...cryptoSymbols, ...SCREENER_INDEX_SYMBOLS];

  const [first, ...rest] = symbols;
  const sParam = rest.length ? `&s=${rest.map((s) => encodeURIComponent(s)).join(",")}` : "";
  const url = `https://eodhd.com/api/real-time/${encodeURIComponent(first)}?api_token=${encodeURIComponent(
    key,
  )}&fmt=json${sParam}`;

  try {
    traceEodhdHttp("getSimpleMarketData", { symbolsInRequest: symbols.length });
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return empty;
    const json = (await res.json()) as unknown;
    const map = parseRealtimeMultiJson(json);

    const stocks = {} as Record<Top10Ticker, SimpleMarketDatum>;
    for (const t of TOP10_TICKERS) {
      stocks[t] = toDatum(map.get(toEodhdUsSymbol(t).toUpperCase()));
    }
    const crypto = {} as Record<ScreenerCryptoSymbol, SimpleMarketDatum>;
    for (const c of CRYPTO_TOP10) {
      crypto[c.symbol as ScreenerCryptoSymbol] = toDatum(map.get(c.eodhdSymbol.toUpperCase()));
    }

    const indices: Record<string, SimpleMarketDatum> = {};
    for (const sym of SCREENER_INDEX_SYMBOLS) {
      indices[sym] = toDatum(map.get(sym.toUpperCase()));
    }

    return {
      stocks,
      crypto,
      indices,
    };
  } catch {
    return empty;
  }
}

export const getSimpleMarketData = unstable_cache(loadSimpleMarketDataUncached, ["simple-market-data-v3"], {
  revalidate: 60,
});

function barsToStockDerived(bars: EodhdDailyBar[]): SimpleScreenerStockDerived {
  const empty = emptyStockDerived();
  if (!bars.length) return empty;
  const lastClose = (() => {
    const c = bars[bars.length - 1]?.close;
    return typeof c === "number" && Number.isFinite(c) ? c : null;
  })();
  if (lastClose == null) return empty;
  const d = deriveMetricsFromDailyBars(bars, lastClose);
  return {
    changePercent7D: d.changePercent7D,
    changePercent1M: d.changePercent1M,
    changePercentYTD: d.changePercentYTD,
    last5DailyCloses: d.sparkline5d.length === 5 ? d.sparkline5d : d.sparkline5d.slice(-5),
  };
}

async function loadSimpleScreenerDerivedUncached(): Promise<SimpleScreenerDerived> {
  const window = eodFetchWindowUtc();
  const settled = await Promise.allSettled(
    TOP10_TICKERS.map((t) => fetchEodhdEodDailyScreener(t, window.from, window.to)),
  );
  const out = {} as SimpleScreenerDerived;
  TOP10_TICKERS.forEach((t, i) => {
    const bars = settled[i]?.status === "fulfilled" ? settled[i].value ?? [] : [];
    out[t] = barsToStockDerived(bars);
  });
  return out;
}

export const getSimpleScreenerDerived = unstable_cache(loadSimpleScreenerDerivedUncached, ["simple-screener-derived-v2"], {
  revalidate: 1800,
});

function barsToCryptoDerived(bars: EodhdDailyBar[]): CryptoDerivedSlice {
  const empty = emptyCryptoDerived();
  if (!bars.length) return empty;
  const c = bars[bars.length - 1]?.close;
  const lastClose = typeof c === "number" && Number.isFinite(c) ? c : null;
  if (lastClose == null) return empty;
  const d = deriveMetricsFromDailyBars(bars, lastClose);
  return {
    changePercent7D: d.changePercent7D,
    changePercent1M: d.changePercent1M,
    changePercentYTD: d.changePercentYTD,
    last5DailyCloses: d.sparkline5d.length === 5 ? d.sparkline5d : d.sparkline5d.slice(-5),
  };
}

async function loadSimpleCryptoDerivedUncached(): Promise<SimpleCryptoDerived> {
  const window = eodFetchWindowUtc();
  const settled = await Promise.allSettled(
    CRYPTO_TOP10.map((c) => fetchEodhdCryptoDailyBars(c.eodhdSymbol, window.from, window.to)),
  );
  const out = {} as SimpleCryptoDerived;
  CRYPTO_TOP10.forEach((c, i) => {
    const bars = settled[i]?.status === "fulfilled" ? settled[i].value ?? [] : [];
    out[c.symbol as ScreenerCryptoSymbol] = barsToCryptoDerived(bars);
  });
  return out;
}

export const getSimpleCryptoDerived = unstable_cache(loadSimpleCryptoDerivedUncached, ["simple-crypto-derived-v2"], {
  revalidate: 1800,
});

async function loadSimpleIndicesDerivedUncached(): Promise<SimpleIndicesDerived> {
  const window = eodFetchWindowUtc();
  const settled = await Promise.allSettled(
    SCREENER_INDEX_SYMBOLS.map((sym) => fetchEodhdEodDailyScreener(sym, window.from, window.to)),
  );
  const out: SimpleIndicesDerived = {};
  SCREENER_INDEX_SYMBOLS.forEach((sym, i) => {
    const bars = settled[i]?.status === "fulfilled" ? settled[i].value ?? [] : [];
    out[sym] = barsToCryptoDerived(bars);
  });
  return out;
}

export const getSimpleIndicesDerived = unstable_cache(loadSimpleIndicesDerivedUncached, ["simple-indices-derived-v2"], {
  revalidate: 1800,
});
