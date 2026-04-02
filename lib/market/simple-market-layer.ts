import "server-only";

import { unstable_cache } from "next/cache";

import { traceEodhdHttp } from "@/lib/market/provider-trace";
import { getEodhdApiKey } from "@/lib/env/server";
import { fetchEodhdEodDailyScreener } from "@/lib/market/eodhd-eod";
import { deriveMetricsFromDailyBars, eodFetchWindowUtc } from "@/lib/screener/eod-derived-metrics";
import { fetchEodhdCryptoDailyBars } from "@/lib/market/eodhd-crypto";

type EodhdRealtimePayload = {
  code?: string;
  close?: number;
  previousClose?: number;
  change_p?: number;
};

export type SimpleMarketDatum = {
  /** Latest price (close) */
  price: number | null;
  /** Previous close (yesterday close) */
  previousClose: number | null;
  /** 1D change percent */
  changePercent1D: number | null;
};

export type SimpleMarketData = {
  NVDA: SimpleMarketDatum;
  AAPL: SimpleMarketDatum;
  BTC: SimpleMarketDatum;
  ETH: SimpleMarketDatum;
  SPX: SimpleMarketDatum;
  NDX: SimpleMarketDatum;
  DJI: SimpleMarketDatum;
  RUT: SimpleMarketDatum;
  VIX: SimpleMarketDatum;
};

export type SimpleScreenerStockDerived = {
  changePercent7D: number | null;
  changePercent1M: number | null;
  changePercentYTD: number | null;
  /** Exactly 5 daily closes (or empty if unavailable) */
  last5DailyCloses: number[];
};

export type SimpleScreenerDerived = {
  NVDA: SimpleScreenerStockDerived;
  AAPL: SimpleScreenerStockDerived;
};

export type SimpleCryptoDerived = {
  BTC: {
    changePercent7D: number | null;
    changePercent1M: number | null;
    changePercentYTD: number | null;
    last5DailyCloses: number[];
  };
  ETH: {
    changePercent7D: number | null;
    changePercent1M: number | null;
    changePercentYTD: number | null;
    last5DailyCloses: number[];
  };
};

export type SimpleIndicesDerived = {
  SPX: {
    changePercent7D: number | null;
    changePercent1M: number | null;
    changePercentYTD: number | null;
    last5DailyCloses: number[];
  };
  NDX: {
    changePercent7D: number | null;
    changePercent1M: number | null;
    changePercentYTD: number | null;
    last5DailyCloses: number[];
  };
};

const SYMBOLS_BY_KEY = {
  NVDA: "NVDA.US",
  AAPL: "AAPL.US",
  BTC: "BTC-USD.CC",
  ETH: "ETH-USD.CC",
  SPX: "GSPC.INDX",
  NDX: "NDX.INDX",
  DJI: "DJI.INDX",
  // Russell 2000 proxy (see indices-config.ts)
  RUT: "IWM.US",
  VIX: "VIX.INDX",
} as const satisfies Record<keyof SimpleMarketData, string>;

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

async function loadSimpleMarketDataUncached(): Promise<SimpleMarketData> {
  const key = getEodhdApiKey();
  const empty: SimpleMarketDatum = { price: null, previousClose: null, changePercent1D: null };
  if (!key) {
    return { NVDA: empty, AAPL: empty, BTC: empty, ETH: empty, SPX: empty, NDX: empty, DJI: empty, RUT: empty, VIX: empty };
  }

  const symbols = Object.values(SYMBOLS_BY_KEY);
  const [first, ...rest] = symbols;
  const sParam = rest.length ? `&s=${rest.map((s) => encodeURIComponent(s)).join(",")}` : "";
  const url = `https://eodhd.com/api/real-time/${encodeURIComponent(first)}?api_token=${encodeURIComponent(
    key,
  )}&fmt=json${sParam}`;

  try {
    traceEodhdHttp("getSimpleMarketData", { symbolsInRequest: symbols.length });
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return { NVDA: empty, AAPL: empty, BTC: empty, ETH: empty, SPX: empty, NDX: empty, DJI: empty, RUT: empty, VIX: empty };
    }
    const json = (await res.json()) as unknown;
    const map = parseRealtimeMultiJson(json);

    return {
      NVDA: toDatum(map.get(SYMBOLS_BY_KEY.NVDA.toUpperCase())),
      AAPL: toDatum(map.get(SYMBOLS_BY_KEY.AAPL.toUpperCase())),
      BTC: toDatum(map.get(SYMBOLS_BY_KEY.BTC.toUpperCase())),
      ETH: toDatum(map.get(SYMBOLS_BY_KEY.ETH.toUpperCase())),
      SPX: toDatum(map.get(SYMBOLS_BY_KEY.SPX.toUpperCase())),
      NDX: toDatum(map.get(SYMBOLS_BY_KEY.NDX.toUpperCase())),
      DJI: toDatum(map.get(SYMBOLS_BY_KEY.DJI.toUpperCase())),
      RUT: toDatum(map.get(SYMBOLS_BY_KEY.RUT.toUpperCase())),
      VIX: toDatum(map.get(SYMBOLS_BY_KEY.VIX.toUpperCase())),
    };
  } catch {
    return { NVDA: empty, AAPL: empty, BTC: empty, ETH: empty, SPX: empty, NDX: empty, DJI: empty, RUT: empty, VIX: empty };
  }
}

export const getSimpleMarketData = unstable_cache(loadSimpleMarketDataUncached, ["simple-market-data-v1"], {
  revalidate: 60,
});

async function loadSimpleScreenerDerivedUncached(): Promise<SimpleScreenerDerived> {
  const empty: SimpleScreenerStockDerived = {
    changePercent7D: null,
    changePercent1M: null,
    changePercentYTD: null,
    last5DailyCloses: [],
  };
  const window = eodFetchWindowUtc();

  const [nvdaBarsSettled, aaplBarsSettled] = await Promise.allSettled([
    fetchEodhdEodDailyScreener("NVDA", window.from, window.to),
    fetchEodhdEodDailyScreener("AAPL", window.from, window.to),
  ]);

  const nvdaBars = nvdaBarsSettled.status === "fulfilled" ? nvdaBarsSettled.value ?? [] : [];
  const aaplBars = aaplBarsSettled.status === "fulfilled" ? aaplBarsSettled.value ?? [] : [];

  const lastClose = (bars: { close: number }[]): number | null => {
    if (!bars.length) return null;
    const c = bars[bars.length - 1]?.close;
    return typeof c === "number" && Number.isFinite(c) ? c : null;
  };

  const nvdaPrice = lastClose(nvdaBars);
  const aaplPrice = lastClose(aaplBars);

  const nvdaDerived = nvdaBars.length && nvdaPrice != null ? deriveMetricsFromDailyBars(nvdaBars, nvdaPrice) : null;
  const aaplDerived = aaplBars.length && aaplPrice != null ? deriveMetricsFromDailyBars(aaplBars, aaplPrice) : null;

  return {
    NVDA: nvdaDerived
      ? {
          changePercent7D: nvdaDerived.changePercent7D,
          changePercent1M: nvdaDerived.changePercent1M,
          changePercentYTD: nvdaDerived.changePercentYTD,
          last5DailyCloses: nvdaDerived.sparkline5d.length === 5 ? nvdaDerived.sparkline5d : nvdaDerived.sparkline5d.slice(-5),
        }
      : empty,
    AAPL: aaplDerived
      ? {
          changePercent7D: aaplDerived.changePercent7D,
          changePercent1M: aaplDerived.changePercent1M,
          changePercentYTD: aaplDerived.changePercentYTD,
          last5DailyCloses: aaplDerived.sparkline5d.length === 5 ? aaplDerived.sparkline5d : aaplDerived.sparkline5d.slice(-5),
        }
      : empty,
  };
}

export const getSimpleScreenerDerived = unstable_cache(loadSimpleScreenerDerivedUncached, ["simple-screener-derived-v1"], {
  revalidate: 1800,
});

async function loadSimpleCryptoDerivedUncached(): Promise<SimpleCryptoDerived> {
  const empty = { changePercent7D: null, changePercent1M: null, changePercentYTD: null, last5DailyCloses: [] as number[] };
  const window = eodFetchWindowUtc();

  const [btcBarsSettled, ethBarsSettled] = await Promise.allSettled([
    fetchEodhdCryptoDailyBars("BTC-USD.CC", window.from, window.to),
    fetchEodhdCryptoDailyBars("ETH-USD.CC", window.from, window.to),
  ]);

  const btcBars = btcBarsSettled.status === "fulfilled" ? btcBarsSettled.value ?? [] : [];
  const ethBars = ethBarsSettled.status === "fulfilled" ? ethBarsSettled.value ?? [] : [];

  const lastClose = (bars: { close: number }[]): number | null => {
    if (!bars.length) return null;
    const c = bars[bars.length - 1]?.close;
    return typeof c === "number" && Number.isFinite(c) ? c : null;
  };

  const btcPrice = lastClose(btcBars);
  const ethPrice = lastClose(ethBars);

  const btcDerived = btcBars.length && btcPrice != null ? deriveMetricsFromDailyBars(btcBars, btcPrice) : null;
  const ethDerived = ethBars.length && ethPrice != null ? deriveMetricsFromDailyBars(ethBars, ethPrice) : null;

  return {
    BTC: btcDerived
      ? {
          changePercent7D: btcDerived.changePercent7D,
          changePercent1M: btcDerived.changePercent1M,
          changePercentYTD: btcDerived.changePercentYTD,
          last5DailyCloses: btcDerived.sparkline5d.length === 5 ? btcDerived.sparkline5d : btcDerived.sparkline5d.slice(-5),
        }
      : empty,
    ETH: ethDerived
      ? {
          changePercent7D: ethDerived.changePercent7D,
          changePercent1M: ethDerived.changePercent1M,
          changePercentYTD: ethDerived.changePercentYTD,
          last5DailyCloses: ethDerived.sparkline5d.length === 5 ? ethDerived.sparkline5d : ethDerived.sparkline5d.slice(-5),
        }
      : empty,
  };
}

export const getSimpleCryptoDerived = unstable_cache(loadSimpleCryptoDerivedUncached, ["simple-crypto-derived-v1"], {
  revalidate: 1800,
});

async function loadSimpleIndicesDerivedUncached(): Promise<SimpleIndicesDerived> {
  const empty = { changePercent7D: null, changePercent1M: null, changePercentYTD: null, last5DailyCloses: [] as number[] };
  const window = eodFetchWindowUtc();

  const [spxBarsSettled, ndxBarsSettled] = await Promise.allSettled([
    fetchEodhdEodDailyScreener("GSPC.INDX", window.from, window.to),
    fetchEodhdEodDailyScreener("NDX.INDX", window.from, window.to),
  ]);

  const spxBars = spxBarsSettled.status === "fulfilled" ? spxBarsSettled.value ?? [] : [];
  const ndxBars = ndxBarsSettled.status === "fulfilled" ? ndxBarsSettled.value ?? [] : [];

  const lastClose = (bars: { close: number }[]): number | null => {
    if (!bars.length) return null;
    const c = bars[bars.length - 1]?.close;
    return typeof c === "number" && Number.isFinite(c) ? c : null;
  };

  const spxPrice = lastClose(spxBars);
  const ndxPrice = lastClose(ndxBars);

  const spxDerived = spxBars.length && spxPrice != null ? deriveMetricsFromDailyBars(spxBars, spxPrice) : null;
  const ndxDerived = ndxBars.length && ndxPrice != null ? deriveMetricsFromDailyBars(ndxBars, ndxPrice) : null;

  return {
    SPX: spxDerived
      ? {
          changePercent7D: spxDerived.changePercent7D,
          changePercent1M: spxDerived.changePercent1M,
          changePercentYTD: spxDerived.changePercentYTD,
          last5DailyCloses: spxDerived.sparkline5d.length === 5 ? spxDerived.sparkline5d : spxDerived.sparkline5d.slice(-5),
        }
      : empty,
    NDX: ndxDerived
      ? {
          changePercent7D: ndxDerived.changePercent7D,
          changePercent1M: ndxDerived.changePercent1M,
          changePercentYTD: ndxDerived.changePercentYTD,
          last5DailyCloses: ndxDerived.sparkline5d.length === 5 ? ndxDerived.sparkline5d : ndxDerived.sparkline5d.slice(-5),
        }
      : empty,
  };
}

export const getSimpleIndicesDerived = unstable_cache(loadSimpleIndicesDerivedUncached, ["simple-indices-derived-v1"], {
  revalidate: 1800,
});

