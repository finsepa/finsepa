import "server-only";

import { usSessionWallClockUnix } from "@/lib/market/chart-timestamp-format";
import type { StockChartPoint } from "@/lib/market/stock-chart-types";
import { readUsQuotesBulkMap, usQuotesBulkKey } from "@/lib/market/us-quotes-bulk";

const NY_YMD = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });

/** Bars ending earlier than this before 16:00 (half days, sparse feeds) are left untouched. */
const MAX_LAST_BAR_GAP_SEC = 15 * 60;

/**
 * Intraday bars miss the closing auction, so thin listings end the 1D line cents away from the official close
 * the header shows. For a finished session, pin the 16:00 point to the close from the bulk quote snapshot.
 */
export async function snapStock1DToOfficialClose(
  ticker: string,
  points: StockChartPoint[],
  now: Date = new Date(),
): Promise<StockChartPoint[]> {
  const last = points[points.length - 1];
  const ymd = last?.sessionDate;
  if (!last || !ymd) return points;

  const closeSec = usSessionWallClockUnix(ymd, 16, 0);
  if (now.getTime() / 1000 < closeSec + 60 || last.time < closeSec - MAX_LAST_BAR_GAP_SEC) return points;

  const quote = (await readUsQuotesBulkMap())?.get(usQuotesBulkKey(ticker));
  if (!quote?.tsSec || NY_YMD.format(new Date(quote.tsSec * 1000)) !== ymd) return points;
  if (Math.abs(quote.price - last.value) < 1e-9) return points;

  if (last.time >= closeSec) {
    return [...points.slice(0, -1), { ...last, value: quote.price }];
  }
  return [...points, { ...last, time: closeSec, value: quote.price }];
}
