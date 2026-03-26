import "server-only";

import { getEodhdApiKey } from "@/lib/env/server";
import { toEodhdSymbol } from "@/lib/market/eodhd-symbol";

export type EodhdIntradayBar = {
  /** UNIX seconds */
  timestamp: number;
  close: number;
};

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toTimestampUnixSeconds(raw: Record<string, unknown>): number | null {
  const epoch = raw.epoch;
  if (typeof epoch === "number" && Number.isFinite(epoch)) return Math.floor(epoch);
  if (typeof epoch === "string") {
    const n = num(epoch);
    if (n != null) return Math.floor(n);
  }

  const date = raw.date;
  if (typeof date === "string") {
    const t = Date.parse(date);
    if (Number.isFinite(t)) return Math.floor(t / 1000);
  }

  return null;
}

function barClose(raw: Record<string, unknown>): number | null {
  // EODHD uses `close` for intraday bars; sometimes adjusted close can exist.
  return num(raw.adj_close ?? raw.adjusted_close ?? raw.close);
}

/**
 * Intraday bars for a single symbol, restricted by [from,to] and interval.
 * One HTTP request per symbol (called from a batch loader at the page level).
 *
 * @see https://eodhd.com/financial-apis/intraday-historical-data-api
 */
export async function fetchEodhdIntraday(
  symbolOrTicker: string,
  fromUnixSeconds: number,
  toUnixSeconds: number,
  interval: "1m" | "5m" | "1h" = "5m",
): Promise<EodhdIntradayBar[] | null> {
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
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    const arr =
      Array.isArray(data)
        ? data
        : data && typeof data === "object" && "data" in data
          ? Array.isArray((data as { data?: unknown }).data)
            ? (data as { data?: unknown[] }).data
            : null
          : null;
    if (!arr) return null;

    const out: EodhdIntradayBar[] = [];
    for (const rawItem of arr) {
      if (!rawItem || typeof rawItem !== "object") continue;
      const raw = rawItem as Record<string, unknown>;
      const timestamp = toTimestampUnixSeconds(raw);
      if (timestamp == null) continue;
      const close = barClose(raw);
      if (close == null) continue;
      out.push({ timestamp, close });
    }

    out.sort((a, b) => a.timestamp - b.timestamp);
    return out.length ? out : null;
  } catch {
    return null;
  }
}

