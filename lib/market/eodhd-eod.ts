import "server-only";

import { getEodhdApiKey } from "@/lib/env/server";
import { toEodhdSymbol } from "@/lib/market/eodhd-symbol";

export type EodhdDailyBar = {
  date: string;
  close: number;
};

function barClose(row: Record<string, unknown>): number | null {
  const adj = row.adjusted_close;
  const cl = row.close;
  if (typeof adj === "number" && Number.isFinite(adj)) return adj;
  if (typeof cl === "number" && Number.isFinite(cl)) return cl;
  return null;
}

/**
 * Daily EOD bars, ascending by date. One API call per symbol.
 * @see https://eodhd.com/financial-apis/api-for-historical-data-and-volumes/
 */
export async function fetchEodhdEodDaily(
  symbolOrTicker: string,
  from: string,
  to: string,
): Promise<EodhdDailyBar[] | null> {
  const key = getEodhdApiKey();
  if (!key) return null;

  const sym = toEodhdSymbol(symbolOrTicker);
  const params = new URLSearchParams({
    api_token: key,
    fmt: "json",
    period: "d",
    order: "a",
    from,
    to,
  });
  const url = `https://eodhd.com/api/eod/${encodeURIComponent(sym)}?${params.toString()}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) return null;

    const out: EodhdDailyBar[] = [];
    for (const raw of data) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as Record<string, unknown>;
      const date = row.date;
      if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const close = barClose(row);
      if (close == null) continue;
      out.push({ date, close });
    }
    out.sort((a, b) => a.date.localeCompare(b.date));
    return out.length ? out : null;
  } catch {
    return null;
  }
}
