import "server-only";

import { formatAssetChartTimestamp } from "@/lib/market/chart-timestamp-format";
import { fetchEodhdIntraday, type EodhdIntradayBar } from "@/lib/market/eodhd-intraday";
import { fetchEodhdEodDaily } from "@/lib/market/eodhd-eod";
import { getStockSpotPriceUsd } from "@/lib/market/stock-chart-data";
import { isUsListedStockHeaderMeta, type StockDetailHeaderMeta } from "@/lib/market/stock-header-meta";
import type { StockExtendedHoursHeader } from "@/lib/market/stock-extended-hours-header-types";
import type { StockPerformance } from "@/lib/market/stock-performance-types";
import { getUsEquityMarketSession, type UsEquityMarketSession } from "@/lib/market/us-equity-market-session";

export type { StockExtendedHoursHeader } from "@/lib/market/stock-extended-hours-header-types";

const NY_TZ = "America/New_York";
const REGULAR_CLOSE_MINUTES = 16 * 60;

function nyDayMinutesFromUnix(sec: number): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: NY_TZ,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date(sec * 1000));
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function nySessionYmdFromUnix(sec: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: NY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(sec * 1000));
}

function regularCloseBarForPost(bars: EodhdIntradayBar[]): EodhdIntradayBar | null {
  if (!bars.length) return null;
  const sessionYmd = nySessionYmdFromUnix(bars[bars.length - 1]!.timestamp);
  let best: EodhdIntradayBar | null = null;
  for (const b of bars) {
    if (nySessionYmdFromUnix(b.timestamp) !== sessionYmd) continue;
    if (nyDayMinutesFromUnix(b.timestamp) > REGULAR_CLOSE_MINUTES) continue;
    if (!Number.isFinite(b.close) || b.close <= 0) continue;
    if (!best || b.timestamp >= best.timestamp) best = b;
  }
  return best;
}

function closeFromPerformance(perf: StockPerformance): {
  price: number;
  changeAbs: number | null;
  changePct: number | null;
  timestampUnix: number;
} | null {
  const price = perf.price;
  if (price == null || !Number.isFinite(price) || price <= 0) return null;
  const pct = perf.d1;
  let changeAbs: number | null = null;
  if (pct != null && Number.isFinite(pct) && Math.abs(100 + pct) > 1e-6) {
    const prev = price / (1 + pct / 100);
    if (Number.isFinite(prev) && Math.abs(prev) > 1e-12) changeAbs = price - prev;
  }
  const now = new Date();
  const closeTs = Math.floor(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 16, 0, 0) / 1000,
  );
  return { price, changeAbs, changePct: pct, timestampUnix: closeTs };
}

async function latestIntradayBars(ticker: string, now: Date): Promise<EodhdIntradayBar[]> {
  const nowSec = Math.floor(now.getTime() / 1000);
  const from = nowSec - 3 * 86400;
  for (const interval of ["5m", "1m", "1h"] as const) {
    const bars = await fetchEodhdIntraday(ticker, from, nowSec, interval);
    if (bars?.length) return bars;
  }
  return [];
}

/**
 * Dual-column header quote during US pre-market / after-hours (regular close + live extended).
 * Returns null during regular session, weekends, or non-US listings.
 */
export async function buildStockExtendedHoursHeaderQuote(
  ticker: string,
  performance: StockPerformance | null,
  meta: Pick<StockDetailHeaderMeta, "exchange" | "countryIso"> | null,
  now: Date = new Date(),
): Promise<StockExtendedHoursHeader | null> {
  if (!isUsListedStockHeaderMeta(meta)) return null;

  const session: UsEquityMarketSession = getUsEquityMarketSession(now);
  if (session !== "pre" && session !== "post") return null;

  const extendedPrice = await getStockSpotPriceUsd(ticker);
  if (extendedPrice == null || !Number.isFinite(extendedPrice) || extendedPrice <= 0) return null;

  const bars = await latestIntradayBars(ticker, now);
  const lastBar = bars.length ? bars[bars.length - 1]! : null;
  const extendedTs = lastBar?.timestamp ?? Math.floor(now.getTime() / 1000);

  let closePrice: number | null = null;
  let closeChangeAbs: number | null = null;
  let closeChangePct: number | null = null;
  let closeTs = 0;

  if (session === "post") {
    const regBar = regularCloseBarForPost(bars);
    if (regBar) {
      closePrice = regBar.close;
      closeTs = regBar.timestamp;
    } else if (performance) {
      const fromPerf = closeFromPerformance(performance);
      if (fromPerf) {
        closePrice = fromPerf.price;
        closeChangeAbs = fromPerf.changeAbs;
        closeChangePct = fromPerf.changePct;
        closeTs = fromPerf.timestampUnix;
      }
    }
  } else if (performance) {
    const fromPerf = closeFromPerformance(performance);
    if (fromPerf) {
      closePrice = fromPerf.price;
      closeChangeAbs = fromPerf.changeAbs;
      closeChangePct = fromPerf.changePct;
      closeTs = fromPerf.timestampUnix;
    }
  }

  if (closePrice == null || !Number.isFinite(closePrice) || closePrice <= 0) {
    const to = now.toISOString().slice(0, 10);
    const fromDate = new Date(now);
    fromDate.setUTCDate(fromDate.getUTCDate() - 10);
    const from = fromDate.toISOString().slice(0, 10);
    const daily = await fetchEodhdEodDaily(ticker.trim(), from, to);
    const sorted = daily?.length ? [...daily].sort((a, b) => a.date.localeCompare(b.date)) : [];
    const last = sorted.length ? sorted[sorted.length - 1]! : null;
    if (last?.close != null && Number.isFinite(last.close) && last.close > 0) {
      closePrice = last.close;
      const prev = sorted.length >= 2 ? sorted[sorted.length - 2]! : null;
      if (prev?.close != null && Number.isFinite(prev.close) && prev.close > 0) {
        closeChangeAbs = closePrice - prev.close;
        closeChangePct = ((closePrice - prev.close) / prev.close) * 100;
      }
      closeTs = Math.floor(Date.parse(`${last.date}T20:00:00.000Z`) / 1000);
    }
  }

  if (closePrice == null || !Number.isFinite(closePrice) || closePrice <= 0) return null;

  const extendedChangeAbs = extendedPrice - closePrice;
  const extendedChangePct = (extendedChangeAbs / closePrice) * 100;

  const closeTimestampLabel = `At close: ${formatAssetChartTimestamp(closeTs, { kind: "stock" })}`;
  const sessionPrefix = session === "pre" ? "Pre-market" : "After-hours";
  const extendedTimestampLabel = `${sessionPrefix}: ${formatAssetChartTimestamp(extendedTs, { kind: "stock" })}`;

  return {
    session,
    closePrice,
    closeChangeAbs,
    closeChangePct,
    closeTimestampLabel,
    extendedPrice,
    extendedChangeAbs,
    extendedChangePct,
    extendedTimestampLabel,
  };
}
