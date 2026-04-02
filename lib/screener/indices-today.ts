import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_HOT_FAST } from "@/lib/data/cache-policy";
import { fetchEodhdEodDaily } from "@/lib/market/eodhd-eod";
import { MARKET_INDICES_TODAY, type MarketIndexConfig } from "@/lib/screener/indices-config";

export type IndexCardData = {
  name: string;
  price: number | null;
  changePercent1D: number | null;
  sparklineToday: number[] | null;
};

// Enable real EODHD fetches only for SPX + NDX.
// Other cards are placeholders and must not trigger provider calls.
const ENABLE_REAL_INDICES_EODHD_SYMBOLS = new Set<string>(["GSPC.INDX", "NDX.INDX"]);

function emptyIndexCard(name: string): IndexCardData {
  return { name, price: null, changePercent1D: null, sparklineToday: [] };
}

function toUtcDateStr(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0, 10);
}

function sampleSeries(series: number[], targetPoints: number): number[] {
  if (series.length === 0) return [];
  if (series.length <= targetPoints) return series;
  if (targetPoints <= 1) return [series[series.length - 1]!];

  const out: number[] = [];
  const lastIdx = series.length - 1;
  const step = lastIdx / (targetPoints - 1);
  for (let i = 0; i < targetPoints; i++) {
    const idx = Math.min(lastIdx, Math.max(0, Math.round(i * step)));
    out.push(series[idx]!);
  }
  return out;
}

async function buildIndexCardDailyOnly(config: MarketIndexConfig): Promise<IndexCardData> {
  const now = new Date();

  const todayStr = toUtcDateStr(now);
  const fromDaily = new Date(now);
  fromDaily.setUTCDate(fromDaily.getUTCDate() - 7);
  const fromDailyStr = toUtcDateStr(fromDaily);

  let price: number | null = null;
  let changePercent1D: number | null = null;
  let sparklineToday: number[] | null = null;

  const daily = await fetchEodhdEodDaily(config.eodhdSymbol, fromDailyStr, todayStr);
  const dailyBars = (daily ?? []).filter((b) => Number.isFinite(b.close));

  if (dailyBars.length >= 1) {
    const lastDaily = dailyBars[dailyBars.length - 1]!;
    price = lastDaily.close;

    if (dailyBars.length >= 2) {
      const prevDaily = dailyBars[dailyBars.length - 2]!;
      if (prevDaily.close > 0) {
        changePercent1D = ((lastDaily.close - prevDaily.close) / prevDaily.close) * 100;
      }
    }

    if (dailyBars.length >= 2) {
      const sampled = sampleSeries(
        dailyBars.slice(-5).map((b) => b.close),
        12,
      );
      sparklineToday = sampled.length >= 2 ? sampled : null;
    }
  }

  return { name: config.name, price, changePercent1D, sparklineToday };
}

export async function loadIndicesCardsUncached(): Promise<IndexCardData[]> {
  // Build placeholders for all cards first.
  const out = MARKET_INDICES_TODAY.map((c) => emptyIndexCard(c.name));

  // Only call the provider for enabled indices (SPX + NDX).
  const enabled = MARKET_INDICES_TODAY.filter((c) => ENABLE_REAL_INDICES_EODHD_SYMBOLS.has(c.eodhdSymbol));
  const enabledSettled = await Promise.allSettled(enabled.map((c) => buildIndexCardDailyOnly(c)));

  for (let i = 0; i < enabled.length; i++) {
    const r = enabledSettled[i];
    const cfg = enabled[i]!;
    const idx = out.findIndex((x) => x.name === cfg.name);
    if (idx < 0) continue;
    if (r.status === "fulfilled") out[idx] = r.value;
  }

  return out;
}

export const getTodayIndexCards = unstable_cache(loadIndicesCardsUncached, ["indices-today-v4"], {
  revalidate: REVALIDATE_HOT_FAST,
});

