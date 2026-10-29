import "server-only";

import { getEodhdApiKey } from "@/lib/env/server";
import { fetchEodhd } from "@/lib/market/eodhd-fetch";
import { toEodhdSymbol } from "@/lib/market/eodhd-symbol";
import { traceEodhdHttp } from "@/lib/market/provider-trace";

export type OhlcBar = {
  /** UNIX seconds (UTC) — bar start. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Shares traded; absent when the source has no volume (e.g. live minute prices). */
  volume?: number;
};

export type DailyOhlcBar = OhlcBar & { date: string };

function volumeOrUndefined(v: number | null): number | undefined {
  return v != null && v >= 0 ? v : undefined;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function validOhlc(open: number | null, high: number | null, low: number | null, close: number | null) {
  if (open == null || high == null || low == null || close == null) return null;
  if (open <= 0 || high <= 0 || low <= 0 || close <= 0) return null;
  return {
    open,
    close,
    high: Math.max(high, open, close),
    low: Math.min(low, open, close),
  };
}

/**
 * Daily OHLC bars, ascending. Prices are scaled by `adjusted_close / close` (volume by its inverse) so candles stay
 * continuous across splits (EODHD only adjusts the close column).
 */
export async function fetchEodhdDailyOhlc(
  symbolOrTicker: string,
  fromYmd: string,
  toYmd: string,
): Promise<DailyOhlcBar[] | null> {
  const key = getEodhdApiKey();
  if (!key) return null;

  const sym = toEodhdSymbol(symbolOrTicker);
  const params = new URLSearchParams({
    api_token: key,
    fmt: "json",
    period: "d",
    order: "a",
    from: fromYmd,
    to: toYmd,
  });
  const url = `https://eodhd.com/api/eod/${encodeURIComponent(sym)}?${params.toString()}`;

  try {
    if (!traceEodhdHttp("fetchEodhdDailyOhlc", { symbol: sym })) return null;
    const res = await fetchEodhd(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) return null;

    const out: DailyOhlcBar[] = [];
    for (const raw of data) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as Record<string, unknown>;
      const date = row.date;
      if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const close = num(row.close);
      const adjusted = num(row.adjusted_close);
      const factor = close && adjusted && close > 0 && adjusted > 0 ? adjusted / close : 1;
      const bar = validOhlc(
        num(row.open) != null ? num(row.open)! * factor : null,
        num(row.high) != null ? num(row.high)! * factor : null,
        num(row.low) != null ? num(row.low)! * factor : null,
        close != null ? close * factor : null,
      );
      if (!bar) continue;
      const time = Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000);
      if (!Number.isFinite(time)) continue;
      const rawVolume = num(row.volume);
      out.push({ date, time, ...bar, volume: volumeOrUndefined(rawVolume != null ? rawVolume / factor : null) });
    }
    out.sort((a, b) => a.time - b.time);
    return out.length ? out : null;
  } catch {
    return null;
  }
}

/** Intraday OHLC bars (bar start time, UTC seconds), ascending. */
export async function fetchEodhdIntradayOhlc(
  symbolOrTicker: string,
  fromUnixSeconds: number,
  toUnixSeconds: number,
  interval: "1m" | "5m" | "1h" = "5m",
): Promise<OhlcBar[] | null> {
  const key = getEodhdApiKey();
  if (!key) return null;

  const sym = toEodhdSymbol(symbolOrTicker);
  const params = new URLSearchParams({
    api_token: key,
    fmt: "json",
    from: String(Math.floor(fromUnixSeconds)),
    to: String(Math.floor(toUnixSeconds)),
    interval,
  });
  const url = `https://eodhd.com/api/intraday/${encodeURIComponent(sym)}?${params.toString()}`;

  try {
    if (!traceEodhdHttp("fetchEodhdIntradayOhlc", { symbol: sym })) return null;
    const res = await fetchEodhd(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) return null;

    const out: OhlcBar[] = [];
    for (const raw of data) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as Record<string, unknown>;
      const ts = num(row.timestamp);
      if (ts == null) continue;
      const time = ts > 1e12 ? Math.floor(ts / 1000) : Math.floor(ts);
      const bar = validOhlc(num(row.open), num(row.high), num(row.low), num(row.close));
      if (!bar) continue;
      out.push({ time, ...bar, volume: volumeOrUndefined(num(row.volume)) });
    }
    out.sort((a, b) => a.time - b.time);
    return out.length ? out : null;
  } catch {
    return null;
  }
}
