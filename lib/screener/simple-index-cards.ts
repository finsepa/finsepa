import "server-only";

import { unstable_cache } from "next/cache";

import type { IndexCardData } from "@/lib/screener/indices-today";
import { getSimpleMarketData } from "@/lib/market/simple-market-layer";
import { fetchEodhdEodDaily } from "@/lib/market/eodhd-eod";
import { fetchEodhdIntraday } from "@/lib/market/eodhd-intraday";

function toUtcDateStr(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0, 10);
}

function sample(series: number[], targetPoints = 18): number[] {
  if (series.length <= targetPoints) return series;
  const out: number[] = [];
  const lastIdx = series.length - 1;
  const step = lastIdx / (targetPoints - 1);
  for (let i = 0; i < targetPoints; i++) {
    const idx = Math.min(lastIdx, Math.max(0, Math.round(i * step)));
    out.push(series[idx]!);
  }
  return out;
}

function alignIntraday(series: number[], prevClose: number | null, lastPrice: number | null): number[] | null {
  if (series.length < 2) return null;
  const out = [...series];
  if (prevClose != null && Number.isFinite(prevClose)) out[0] = prevClose;
  if (lastPrice != null && Number.isFinite(lastPrice)) out[out.length - 1] = lastPrice;
  return out;
}

/** Last ~3 weeks of daily closes, downsampled — used when 5m intraday is empty or too sparse (IWM, VIX). */
async function loadDailySparklineFallback(symbol: string): Promise<number[] | null> {
  const now = new Date();
  const toStr = toUtcDateStr(now);
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - 21);
  const fromStr = toUtcDateStr(from);
  const daily = await fetchEodhdEodDaily(symbol, fromStr, toStr);
  const closes = (daily ?? []).map((b) => b.close).filter((v) => Number.isFinite(v));
  if (closes.length < 2) return null;
  return sample(closes, 18);
}

function sparklineIntradayOrDaily(
  intradaySeries: number[],
  dailyFallback: number[] | null,
  prevClose: number | null,
  lastPrice: number | null,
): number[] | null {
  const fromIntraday = alignIntraday(intradaySeries, prevClose, lastPrice);
  if (fromIntraday) return fromIntraday;
  const fb = dailyFallback && dailyFallback.length >= 2 ? dailyFallback : [];
  return alignIntraday(fb, prevClose, lastPrice);
}

function compute1d(lastPrice: number | null, prevClose: number | null): number | null {
  if (lastPrice == null || prevClose == null) return null;
  if (!Number.isFinite(lastPrice) || !Number.isFinite(prevClose) || prevClose <= 0) return null;
  return ((lastPrice - prevClose) / prevClose) * 100;
}

async function loadSimpleIndexCardsUncached(): Promise<IndexCardData[]> {
  const data = await getSimpleMarketData();

  const now = new Date();
  const toUnix = Math.floor(now.getTime() / 1000);
  const fromUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0);
  const fromUnix = Math.floor(fromUtc / 1000);

  const [spxIntradaySettled, ndxIntradaySettled, djiIntradaySettled, rutIntradaySettled, vixIntradaySettled] =
    await Promise.allSettled([
    fetchEodhdIntraday("GSPC.INDX", fromUnix, toUnix, "5m"),
    fetchEodhdIntraday("NDX.INDX", fromUnix, toUnix, "5m"),
    fetchEodhdIntraday("DJI.INDX", fromUnix, toUnix, "5m"),
    // Russell 2000 proxy: IWM ETF
    fetchEodhdIntraday("IWM.US", fromUnix, toUnix, "5m"),
    fetchEodhdIntraday("VIX.INDX", fromUnix, toUnix, "5m"),
  ]);

  const spxSeries =
    spxIntradaySettled.status === "fulfilled" && spxIntradaySettled.value
      ? sample(spxIntradaySettled.value.map((b) => b.close).filter((v) => Number.isFinite(v)))
      : [];
  const ndxSeries =
    ndxIntradaySettled.status === "fulfilled" && ndxIntradaySettled.value
      ? sample(ndxIntradaySettled.value.map((b) => b.close).filter((v) => Number.isFinite(v)))
      : [];
  const djiSeries =
    djiIntradaySettled.status === "fulfilled" && djiIntradaySettled.value
      ? sample(djiIntradaySettled.value.map((b) => b.close).filter((v) => Number.isFinite(v)))
      : [];
  const rutSeries =
    rutIntradaySettled.status === "fulfilled" && rutIntradaySettled.value
      ? sample(rutIntradaySettled.value.map((b) => b.close).filter((v) => Number.isFinite(v)))
      : [];
  const vixSeries =
    vixIntradaySettled.status === "fulfilled" && vixIntradaySettled.value
      ? sample(vixIntradaySettled.value.map((b) => b.close).filter((v) => Number.isFinite(v)))
      : [];

  const needRutDaily = rutSeries.length < 2;
  const needVixDaily = vixSeries.length < 2;
  const [rutDailyFb, vixDailyFb] = await Promise.all([
    needRutDaily ? loadDailySparklineFallback("IWM.US") : Promise.resolve(null),
    needVixDaily ? loadDailySparklineFallback("VIX.INDX") : Promise.resolve(null),
  ]);

  const spxLast = spxSeries.length ? spxSeries[spxSeries.length - 1]! : null;
  const ndxLast = ndxSeries.length ? ndxSeries[ndxSeries.length - 1]! : null;
  const djiLast = djiSeries.length ? djiSeries[djiSeries.length - 1]! : null;
  const rutLast = rutSeries.length ? rutSeries[rutSeries.length - 1]! : null;
  const vixLast = vixSeries.length ? vixSeries[vixSeries.length - 1]! : null;

  const ix = data.indices;
  const spxPrice = spxLast != null && Number.isFinite(spxLast) ? spxLast : ix["GSPC.INDX"]?.price ?? null;
  const ndxPrice = ndxLast != null && Number.isFinite(ndxLast) ? ndxLast : ix["NDX.INDX"]?.price ?? null;
  const djiPrice = djiLast != null && Number.isFinite(djiLast) ? djiLast : ix["DJI.INDX"]?.price ?? null;
  const rutPrice = rutLast != null && Number.isFinite(rutLast) ? rutLast : ix["IWM.US"]?.price ?? null;
  const vixPrice = vixLast != null && Number.isFinite(vixLast) ? vixLast : ix["VIX.INDX"]?.price ?? null;

  return [
    {
      name: "S&P 500",
      price: spxPrice,
      changePercent1D: compute1d(spxPrice, ix["GSPC.INDX"]?.previousClose ?? null),
      sparklineToday: alignIntraday(spxSeries, ix["GSPC.INDX"]?.previousClose ?? null, spxPrice),
    },
    {
      name: "Nasdaq 100",
      price: ndxPrice,
      changePercent1D: compute1d(ndxPrice, ix["NDX.INDX"]?.previousClose ?? null),
      sparklineToday: alignIntraday(ndxSeries, ix["NDX.INDX"]?.previousClose ?? null, ndxPrice),
    },
    {
      name: "Dow Jones",
      price: djiPrice,
      changePercent1D: compute1d(djiPrice, ix["DJI.INDX"]?.previousClose ?? null),
      sparklineToday: alignIntraday(djiSeries, ix["DJI.INDX"]?.previousClose ?? null, djiPrice),
    },
    {
      name: "Russell 2000",
      price: rutPrice,
      changePercent1D: compute1d(rutPrice, ix["IWM.US"]?.previousClose ?? null),
      sparklineToday: sparklineIntradayOrDaily(
        rutSeries,
        rutDailyFb,
        ix["IWM.US"]?.previousClose ?? null,
        rutPrice,
      ),
    },
    {
      name: "VIX",
      price: vixPrice,
      changePercent1D: compute1d(vixPrice, ix["VIX.INDX"]?.previousClose ?? null),
      sparklineToday: sparklineIntradayOrDaily(
        vixSeries,
        vixDailyFb,
        ix["VIX.INDX"]?.previousClose ?? null,
        vixPrice,
      ),
    },
  ];
}

export const getSimpleIndexCards = unstable_cache(loadSimpleIndexCardsUncached, ["simple-index-cards-v2"], {
  revalidate: 60,
});

