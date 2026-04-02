import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_HOT } from "@/lib/data/cache-policy";

import { fetchEodhdEodDaily } from "@/lib/market/eodhd-eod";
import { deriveMetricsFromDailyBars, eodFetchWindowUtc, formatDecimalTrim } from "@/lib/screener/eod-derived-metrics";

export type IndexTableRow = {
  name: string;
  symbol: string;
  value: number;
  change1D: number;
  change1M: number | null;
  changeYTD: number | null;
  spark5d: number[];
};

/** Search + benchmarks table — fixed universe (EODHD symbols). */
export const INDEX_TOP10: { name: string; symbol: string; fallbackValue: number; fallback1D: number; fallbackSpark5d: number[] }[] = [
  { name: "S&P 500", symbol: "GSPC.INDX", fallbackValue: 5648.4, fallback1D: 0.44, fallbackSpark5d: [30, 32, 29, 33, 31] },
  { name: "Nasdaq 100", symbol: "NDX.INDX", fallbackValue: 17713.53, fallback1D: 1.13, fallbackSpark5d: [28, 30, 27, 32, 30] },
  { name: "Dow Jones", symbol: "DJI.INDX", fallbackValue: 41563.08, fallback1D: 0.55, fallbackSpark5d: [32, 31, 33, 30, 34] },
  { name: "Russell 2000", symbol: "IWM.US", fallbackValue: 2217.63, fallback1D: 0.67, fallbackSpark5d: [25, 27, 24, 28, 26] },
  { name: "VIX", symbol: "VIX.INDX", fallbackValue: 15.0, fallback1D: -4.15, fallbackSpark5d: [38, 36, 37, 34, 35] },
  { name: "FTSE 100", symbol: "BUK100P.INDX", fallbackValue: 7600, fallback1D: 0.2, fallbackSpark5d: [10, 11, 10, 12, 11] },
  { name: "DAX", symbol: "GDAXI.INDX", fallbackValue: 18000, fallback1D: 0.3, fallbackSpark5d: [12, 12, 13, 14, 14] },
  { name: "Nikkei 225", symbol: "N225.INDX", fallbackValue: 39000, fallback1D: 0.4, fallbackSpark5d: [18, 17, 18, 19, 20] },
  { name: "CAC 40", symbol: "FCHI.INDX", fallbackValue: 8000, fallback1D: 0.25, fallbackSpark5d: [11, 10, 11, 12, 12] },
  { name: "Hang Seng", symbol: "HSI.INDX", fallbackValue: 17000, fallback1D: -0.2, fallbackSpark5d: [14, 13, 13, 12, 12] },
];

async function buildIndexRow(entry: (typeof INDEX_TOP10)[number]): Promise<IndexTableRow> {
  const { from, to } = eodFetchWindowUtc();
  const bars = await fetchEodhdEodDaily(entry.symbol, from, to);
  if (!bars || bars.length < 2) {
    return {
      name: entry.name,
      symbol: entry.symbol,
      value: entry.fallbackValue,
      change1D: entry.fallback1D,
      change1M: null,
      changeYTD: null,
      spark5d: entry.fallbackSpark5d,
    };
  }

  const last = bars[bars.length - 1]!;
  const prev = bars[bars.length - 2]!;
  const value = last.close;
  const change1D = prev.close > 0 ? ((last.close - prev.close) / prev.close) * 100 : entry.fallback1D;

  const derived = deriveMetricsFromDailyBars(bars, value);

  return {
    name: entry.name,
    symbol: entry.symbol,
    value,
    change1D,
    change1M: derived.changePercent1M,
    changeYTD: derived.changePercentYTD,
    spark5d: derived.sparkline5d.length ? derived.sparkline5d : entry.fallbackSpark5d,
  };
}

async function loadIndicesTop10Uncached(): Promise<IndexTableRow[]> {
  const settled = await Promise.allSettled(INDEX_TOP10.map((e) => buildIndexRow(e)));
  return INDEX_TOP10.map((e, i) => {
    const r = settled[i];
    if (r.status === "fulfilled") return r.value;
    return {
      name: e.name,
      symbol: e.symbol,
      value: e.fallbackValue,
      change1D: e.fallback1D,
      change1M: null,
      changeYTD: null,
      spark5d: e.fallbackSpark5d,
    };
  });
}

export const getIndicesTop10 = unstable_cache(loadIndicesTop10Uncached, ["indices-top10-v2"], {
  revalidate: REVALIDATE_HOT,
});

/** Resolve display name for a known top-10 index EOD symbol (e.g. GSPC.INDX → "S&P 500"). */
export function getIndexDisplayMeta(eodSymbol: string): { name: string; symbol: string } | null {
  const u = eodSymbol.trim().toUpperCase();
  const hit = INDEX_TOP10.find((e) => e.symbol.toUpperCase() === u);
  return hit ? { name: hit.name, symbol: hit.symbol } : null;
}

export function formatIndexValue(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatIndexPercent(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "-";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${formatDecimalTrim(v)}%`;
}

