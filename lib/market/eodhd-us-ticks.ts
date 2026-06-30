import "server-only";

import { traceEodhdHttp } from "@/lib/market/provider-trace";
import { getEodhdApiKey } from "@/lib/env/server";
import { toEodhdUsSymbol } from "@/lib/market/eodhd-symbol";

export type EodhdUsTick = {
  /** Unix seconds */
  timestampSec: number;
  price: number;
};

export type FetchEodhdUsTicksResult =
  | { ok: true; ticks: EodhdUsTick[]; truncated: boolean }
  | { ok: false; reason: "no_key" | "budget" | "not_found" | "http_error" | "invalid" };

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toTimestampSec(raw: unknown): number | null {
  const n = num(raw);
  if (n == null) return null;
  return n > 1e12 ? Math.floor(n / 1000) : Math.floor(n);
}

function parseArrayTicks(body: unknown): EodhdUsTick[] {
  if (!Array.isArray(body)) return [];
  const out: EodhdUsTick[] = [];
  for (const row of body) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const timestampSec = toTimestampSec(rec.timestamp ?? rec.ts ?? rec.t);
    const price = num(rec.price ?? rec.p);
    if (timestampSec == null || price == null || price <= 0) continue;
    out.push({ timestampSec, price });
  }
  return out;
}

/** Columnar `{ ts: number[], price: number[] }` shape from `/api/ticks/?s=`. */
function parseColumnarTicks(body: Record<string, unknown>): EodhdUsTick[] {
  const tsArr = body.ts ?? body.timestamp;
  const priceArr = body.price ?? body.p;
  if (!Array.isArray(tsArr) || !Array.isArray(priceArr)) return [];
  const n = Math.min(tsArr.length, priceArr.length);
  const out: EodhdUsTick[] = [];
  for (let i = 0; i < n; i++) {
    const timestampSec = toTimestampSec(tsArr[i]);
    const price = num(priceArr[i]);
    if (timestampSec == null || price == null || price <= 0) continue;
    out.push({ timestampSec, price });
  }
  return out;
}

function parseTicksResponse(body: unknown): EodhdUsTick[] {
  if (Array.isArray(body)) return parseArrayTicks(body);
  if (body && typeof body === "object") {
    const rec = body as Record<string, unknown>;
    if (Array.isArray(rec.ts) || Array.isArray(rec.timestamp)) {
      return parseColumnarTicks(rec);
    }
  }
  return [];
}

/**
 * US tick trades for a unix-second window. One API credit per call.
 * Never call for today's session during regular hours (404).
 *
 * @see https://eodhd.com/financial-apis/us-stock-market-tick-data-api
 */
export async function fetchEodhdUsTicks(
  symbolOrTicker: string,
  fromUnixSeconds: number,
  toUnixSeconds: number,
  limit = 10_000,
): Promise<FetchEodhdUsTicksResult> {
  const key = getEodhdApiKey();
  if (!key) return { ok: false, reason: "no_key" };

  const sym = toEodhdUsSymbol(symbolOrTicker);
  const from = Math.floor(fromUnixSeconds);
  const to = Math.floor(toUnixSeconds);
  if (to <= from) return { ok: false, reason: "invalid" };

  const params = new URLSearchParams({
    api_token: key,
    fmt: "json",
    from: String(from),
    to: String(to),
    limit: String(Math.min(Math.max(limit, 1), 10_000)),
  });

  const urls = [
    `https://eodhd.com/api/ticks/${encodeURIComponent(sym)}?${params.toString()}`,
    `https://eodhd.com/api/ticks/?s=${encodeURIComponent(sym.replace(/\.US$/i, ""))}&${params.toString()}`,
  ];

  for (const url of urls) {
    try {
      if (!traceEodhdHttp("fetchEodhdUsTicks", { symbol: sym, from, to })) {
        return { ok: false, reason: "budget" };
      }
      const res = await fetch(url, { cache: "no-store" });
      if (res.status === 404) return { ok: false, reason: "not_found" };
      if (!res.ok) continue;

      const text = await res.text();
      if (!text.trim().startsWith("[") && !text.trim().startsWith("{")) continue;

      const body = JSON.parse(text) as unknown;
      const ticks = parseTicksResponse(body);
      return { ok: true, ticks, truncated: ticks.length >= limit };
    } catch {
      continue;
    }
  }

  return { ok: false, reason: "http_error" };
}
