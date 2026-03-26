import "server-only";

import { unstable_cache } from "next/cache";

import { fetchEodhdEodDaily } from "@/lib/market/eodhd-eod";
import { fetchEodhdIntraday } from "@/lib/market/eodhd-intraday";
import { MARKET_INDICES_TODAY, type MarketIndexConfig } from "@/lib/screener/indices-config";

export type IndexCardData = {
  name: string;
  price: number;
  changePercent1D: number;
  sparklineToday: number[];
};

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

async function buildIndexCard(config: MarketIndexConfig): Promise<IndexCardData> {
  const now = new Date();
  const toUnix = Math.floor(now.getTime() / 1000);
  const fromUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0);
  const fromUnix = Math.floor(fromUtc / 1000);

  const todayStr = toUtcDateStr(now);
  const fromDaily = new Date(now);
  fromDaily.setUTCDate(fromDaily.getUTCDate() - 7);
  const fromDailyStr = toUtcDateStr(fromDaily);

  const [intradaySettled, dailySettled] = await Promise.allSettled([
    fetchEodhdIntraday(config.eodhdSymbol, fromUnix, toUnix, "5m"),
    fetchEodhdEodDaily(config.eodhdSymbol, fromDailyStr, todayStr),
  ]);

  const intraday = intradaySettled.status === "fulfilled" ? intradaySettled.value : null;
  const daily = dailySettled.status === "fulfilled" ? dailySettled.value : null;

  const fallback: IndexCardData = {
    name: config.name,
    price: config.fallbackPrice,
    changePercent1D: config.fallbackChangePercent1D,
    sparklineToday: config.fallbackSparklineToday,
  };

  const dailyBars = (daily ?? []).filter((b) => Number.isFinite(b.close));
  const intradayCloses =
    intraday && intraday.length
      ? intraday.map((b) => b.close).filter((v) => Number.isFinite(v))
      : [];

  let price = fallback.price;
  let changePercent1D = fallback.changePercent1D;
  let sparklineToday = fallback.sparklineToday;

  // Use daily whenever available for 1D %, and as fallback for price/sparkline.
  if (dailyBars.length >= 1) {
    const lastDaily = dailyBars[dailyBars.length - 1]!;
    price = lastDaily.close;

    if (dailyBars.length >= 2) {
      const prevDaily = dailyBars[dailyBars.length - 2]!;
      if (prevDaily.close > 0) {
        changePercent1D = ((lastDaily.close - prevDaily.close) / prevDaily.close) * 100;
      }
    }

    // If intraday is unavailable, still use recent historical closes for sparkline.
    if (dailyBars.length >= 2) {
      sparklineToday = sampleSeries(dailyBars.slice(-5).map((b) => b.close), 12);
    }
  }

  // Intraday overrides price + sparkline when available.
  if (intradayCloses.length > 0) {
    price = intradayCloses[intradayCloses.length - 1]!;
    sparklineToday = sampleSeries(intradayCloses, 12);
  }

  return { name: config.name, price, changePercent1D, sparklineToday };
}

export async function loadIndicesCardsUncached(): Promise<IndexCardData[]> {
  const settled = await Promise.allSettled(MARKET_INDICES_TODAY.map((c) => buildIndexCard(c)));
  return MARKET_INDICES_TODAY.map((c, i) => {
    const r = settled[i];
    if (r.status === "fulfilled") return r.value;
    return {
      name: c.name,
      price: c.fallbackPrice,
      changePercent1D: c.fallbackChangePercent1D,
      sparklineToday: c.fallbackSparklineToday,
    };
  });
}

export const getTodayIndexCards = unstable_cache(loadIndicesCardsUncached, ["indices-today-v2"], {
  revalidate: 30,
});

