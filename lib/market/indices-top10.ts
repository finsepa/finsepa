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
};

/** Search + benchmarks table — fixed universe (EODHD symbols). */
export const INDEX_TOP10: { name: string; symbol: string; fallbackValue: number; fallback1D: number }[] = [
  { name: "S&P 500", symbol: "GSPC.INDX", fallbackValue: 5648.4, fallback1D: 0.44 },
  { name: "Nasdaq 100", symbol: "NDX.INDX", fallbackValue: 17713.53, fallback1D: 1.13 },
  { name: "Dow Jones", symbol: "DJI.INDX", fallbackValue: 41563.08, fallback1D: 0.55 },
  { name: "Russell 2000", symbol: "IWM.US", fallbackValue: 2217.63, fallback1D: 0.67 },
  { name: "VIX", symbol: "VIX.INDX", fallbackValue: 15.0, fallback1D: -4.15 },
  { name: "FTSE 100", symbol: "BUK100P.INDX", fallbackValue: 7600, fallback1D: 0.2 },
  { name: "DAX", symbol: "GDAXI.INDX", fallbackValue: 18000, fallback1D: 0.3 },
  { name: "Nikkei 225", symbol: "N225.INDX", fallbackValue: 39000, fallback1D: 0.4 },
  { name: "CAC 40", symbol: "FCHI.INDX", fallbackValue: 8000, fallback1D: 0.25 },
  { name: "Hang Seng", symbol: "HSI.INDX", fallbackValue: 17000, fallback1D: -0.2 },
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
    };
  });
}

export const getIndicesTop10 = unstable_cache(loadIndicesTop10Uncached, ["indices-top10-v3-no-spark5d"], {
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

