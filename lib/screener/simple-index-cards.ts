import "server-only";

import { unstable_cache } from "next/cache";

import type { IndexCardData } from "@/lib/screener/indices-today";
import { getSimpleMarketData } from "@/lib/market/simple-market-layer";
import { fetchEodhdIntraday } from "@/lib/market/eodhd-intraday";

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

  const spxLast = spxSeries.length ? spxSeries[spxSeries.length - 1]! : null;
  const ndxLast = ndxSeries.length ? ndxSeries[ndxSeries.length - 1]! : null;
  const djiLast = djiSeries.length ? djiSeries[djiSeries.length - 1]! : null;
  const rutLast = rutSeries.length ? rutSeries[rutSeries.length - 1]! : null;
  const vixLast = vixSeries.length ? vixSeries[vixSeries.length - 1]! : null;

  const spxPrice = spxLast != null && Number.isFinite(spxLast) ? spxLast : data.SPX.price;
  const ndxPrice = ndxLast != null && Number.isFinite(ndxLast) ? ndxLast : data.NDX.price;
  const djiPrice = djiLast != null && Number.isFinite(djiLast) ? djiLast : data.DJI.price;
  const rutPrice = rutLast != null && Number.isFinite(rutLast) ? rutLast : data.RUT.price;
  const vixPrice = vixLast != null && Number.isFinite(vixLast) ? vixLast : data.VIX.price;

  return [
    {
      name: "S&P 500",
      price: spxPrice,
      changePercent1D: compute1d(spxPrice, data.SPX.previousClose),
      sparklineToday: alignIntraday(spxSeries, data.SPX.previousClose, spxPrice),
    },
    {
      name: "Nasdaq 100",
      price: ndxPrice,
      changePercent1D: compute1d(ndxPrice, data.NDX.previousClose),
      sparklineToday: alignIntraday(ndxSeries, data.NDX.previousClose, ndxPrice),
    },
    {
      name: "Dow Jones",
      price: djiPrice,
      changePercent1D: compute1d(djiPrice, data.DJI.previousClose),
      sparklineToday: alignIntraday(djiSeries, data.DJI.previousClose, djiPrice),
    },
    {
      name: "Russell 2000",
      price: rutPrice,
      changePercent1D: compute1d(rutPrice, data.RUT.previousClose),
      sparklineToday: alignIntraday(rutSeries, data.RUT.previousClose, rutPrice),
    },
    {
      name: "VIX",
      price: vixPrice,
      changePercent1D: compute1d(vixPrice, data.VIX.previousClose),
      sparklineToday: alignIntraday(vixSeries, data.VIX.previousClose, vixPrice),
    },
  ];
}

export const getSimpleIndexCards = unstable_cache(loadSimpleIndexCardsUncached, ["simple-index-cards-v1"], {
  revalidate: 60,
});

