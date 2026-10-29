import "server-only";

import { getEodhdApiKey } from "@/lib/env/server";
import { MARKET_SNAPSHOT_KEY } from "@/lib/market/market-snapshot-keys";
import { readMarketSnapshotRow, upsertMarketSnapshot } from "@/lib/market/market-snapshot-store";
import { runWithProviderTrace, traceEodhdHttp } from "@/lib/market/provider-trace";
import { getUsEquityMarketSession } from "@/lib/market/us-equity-market-session";
import { TOP10_TICKERS } from "@/lib/screener/top10-config";

/**
 * Bulk delayed quotes for every US exchange-listed ticker (EODHD `real-time?ex=US`, ~12.7k rows, 100 credits)
 * stored as `us_quotes_bulk`. Written by cron behind `FINSEPA_BULK_QUOTES=1`; read only by readers enabled in
 * `FINSEPA_BULK_QUOTES_READ`.
 * OTC names (foreign ADR lines) are not in this feed.
 */

/** `[ticker, close, previousClose, changePct, volume, timestampSec]` — ticker without `.US` (e.g. `BRK-B`). */
export type UsQuotesBulkRow = [string, number, number | null, number | null, number | null, number | null];

export type UsQuotesBulkSnapshot = {
  builtAt: string;
  session: string;
  /** Newest quote timestamp among the sentinel tickers (unix seconds). */
  sentinelNewestSec: number | null;
  rows: UsQuotesBulkRow[];
};

const BULK_TIMEOUT_MS = 30_000;
const MIN_ROWS = 5_000;
const SENTINELS = [...TOP10_TICKERS, "SPY", "QQQ"] as const;
const MIN_SENTINELS_PRESENT = SENTINELS.length - 1;
/** Regular/post session: sentinel quotes older than this mean the feed returned a stale day. */
const MAX_SENTINEL_AGE_SEC = 2 * 60 * 60;
const SLOT_MINUTES = 15;

export function usQuotesBulkEnabled(): boolean {
  return process.env.FINSEPA_BULK_QUOTES === "1";
}

/**
 * Phase 2 readers, comma-separated in `FINSEPA_BULK_QUOTES_READ` (all off by default):
 * - `watchlist` — fill watchlist tickers missing from `stocks_all_pages` before calling EODHD.
 * - `batch` — `loadSimpleMarketDataBatch` takes US stock quotes from the bulk list, EODHD only for the rest.
 */
export type UsQuotesBulkReader = "watchlist" | "batch";

export function usQuotesBulkReadEnabled(reader: UsQuotesBulkReader): boolean {
  const raw = process.env.FINSEPA_BULK_QUOTES_READ ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .includes(reader);
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** One bulk call per 15-minute New York slot. */
function bulkSegment(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const minutes = Number(get("hour")) * 60 + Number(get("minute"));
  return `bulk-${get("year")}-${get("month")}-${get("day")}-s${Math.floor(minutes / SLOT_MINUTES)}`;
}

async function fetchUsQuotesBulkRows(): Promise<UsQuotesBulkRow[] | { error: string }> {
  const key = getEodhdApiKey();
  if (!key) return { error: "no_api_key" };
  if (!traceEodhdHttp("fetchEodhdUsBulkQuotes", { ex: "US" })) return { error: "budget_blocked" };
  try {
    const res = await fetch(
      `https://eodhd.com/api/real-time/AAPL.US?ex=US&fmt=json&api_token=${encodeURIComponent(key)}`,
      { cache: "no-store", signal: AbortSignal.timeout(BULK_TIMEOUT_MS) },
    );
    if (!res.ok) return { error: `http_${res.status}` };
    const raw = (await res.json()) as unknown;
    if (!Array.isArray(raw)) return { error: "not_array" };
    const rows: UsQuotesBulkRow[] = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const code = typeof o.code === "string" ? o.code.trim().toUpperCase() : "";
      const close = num(o.close);
      if (!code.endsWith(".US") || close == null || close <= 0) continue;
      rows.push([
        code.slice(0, -3),
        close,
        num(o.previousClose),
        num(o.change_p),
        num(o.volume),
        num(o.timestamp),
      ]);
    }
    return rows;
  } catch (e) {
    return { error: e instanceof Error ? e.name : "fetch_failed" };
  }
}

/** Reason the build must not replace the stored snapshot, or null when it is healthy. */
function bulkRejectReason(rows: UsQuotesBulkRow[], session: string, nowSec: number): string | null {
  if (rows.length < MIN_ROWS) return `too_few_rows_${rows.length}`;
  const byTicker = new Map(rows.map((r) => [r[0], r] as const));
  const sentinels = SENTINELS.map((t) => byTicker.get(t)).filter((r): r is UsQuotesBulkRow => r != null);
  if (sentinels.length < MIN_SENTINELS_PRESENT) return `sentinels_missing_${SENTINELS.length - sentinels.length}`;
  if (session === "regular" || session === "post") {
    const newest = Math.max(...sentinels.map((r) => r[5] ?? 0));
    if (nowSec - newest > MAX_SENTINEL_AGE_SEC) return "stale_sentinels";
  }
  return null;
}

export type UsBulkQuote = {
  price: number;
  previousClose: number | null;
  changePct: number | null;
  tsSec: number | null;
};

/** Rows older than this are dead listings (ABBNY still carries a May-2023 print in the feed). */
const MAX_ROW_AGE_SEC = 4 * 24 * 60 * 60;
/** During US sessions the list refreshes every 15m; older means cron stopped — readers fall back. */
const MAX_SNAPSHOT_AGE_SESSION_MS = 45 * 60 * 1000;
/** Closed (overnight / weekend / holiday): last session's list is still the right close. */
const MAX_SNAPSHOT_AGE_CLOSED_MS = 4 * 24 * 60 * 60 * 1000;
const READ_TTL_MS = 60_000;

let readCache: { at: number; map: Map<string, UsBulkQuote> | null } | null = null;
let readInflight: Promise<Map<string, UsBulkQuote> | null> | null = null;

/** `BRK.B` / `brk-b.us` → `BRK-B` (bulk feed spelling). */
export function usQuotesBulkKey(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/\.US$/, "").replace(/\./g, "-");
}

async function loadUsQuotesBulkMap(): Promise<Map<string, UsBulkQuote> | null> {
  const row = await readMarketSnapshotRow(MARKET_SNAPSHOT_KEY.usQuotesBulk);
  if (!row?.data) return null;
  const updatedMs = Date.parse(row.updated_at);
  const maxAge =
    getUsEquityMarketSession(new Date()) === "closed" ? MAX_SNAPSHOT_AGE_CLOSED_MS : MAX_SNAPSHOT_AGE_SESSION_MS;
  if (!Number.isFinite(updatedMs) || Date.now() - updatedMs > maxAge) return null;

  const snap = row.data as UsQuotesBulkSnapshot;
  const nowSec = Date.now() / 1000;
  const map = new Map<string, UsBulkQuote>();
  for (const [ticker, close, prev, changePct, , tsSec] of snap.rows ?? []) {
    if (!(close > 0) || tsSec == null || nowSec - tsSec > MAX_ROW_AGE_SEC) continue;
    const pct = changePct ?? (prev != null && prev > 0 ? ((close - prev) / prev) * 100 : null);
    map.set(ticker, { price: close, previousClose: prev, changePct: pct, tsSec });
  }
  return map.size ? map : null;
}

/** Fresh bulk quotes keyed by {@link usQuotesBulkKey}; null when the list is missing or stale (callers fall back). */
export async function readUsQuotesBulkMap(): Promise<Map<string, UsBulkQuote> | null> {
  if (readCache && Date.now() - readCache.at < READ_TTL_MS) return readCache.map;
  if (readInflight) return readInflight;
  readInflight = loadUsQuotesBulkMap()
    .catch(() => null)
    .then((map) => {
      readCache = { at: Date.now(), map };
      return map;
    })
    .finally(() => {
      readInflight = null;
    });
  return readInflight;
}

/**
 * Cron step. Never throws; returns a status string for the cron response.
 * Runs at most once per 15-minute slot, only during US pre/regular/post sessions, and keeps the
 * previous snapshot when the new build fails validation.
 */
export async function ingestUsQuotesBulk(now: Date = new Date()): Promise<string> {
  if (!usQuotesBulkEnabled()) return "disabled";
  const session = getUsEquityMarketSession(now);
  if (session === "closed") return "skipped_closed";

  return runWithProviderTrace("cron/us-quotes-bulk", async () => {
    try {
      const segment = bulkSegment(now);
      const existing = await readMarketSnapshotRow(MARKET_SNAPSHOT_KEY.usQuotesBulk);
      if (existing?.segment === segment) return "skipped_fresh";

      const fetched = await fetchUsQuotesBulkRows();
      if (!Array.isArray(fetched)) return `fetch_failed:${fetched.error}`;

      const nowSec = Math.floor(now.getTime() / 1000);
      const reject = bulkRejectReason(fetched, session, nowSec);
      if (reject) {
        console.warn("[us-quotes-bulk] rejected — keeping previous snapshot", reject);
        return `rejected:${reject}`;
      }

      const sentinelTimes = SENTINELS.map((t) => fetched.find((r) => r[0] === t)?.[5] ?? 0);
      const snapshot: UsQuotesBulkSnapshot = {
        builtAt: now.toISOString(),
        session,
        sentinelNewestSec: Math.max(...sentinelTimes) || null,
        rows: fetched,
      };
      const res = await upsertMarketSnapshot(MARKET_SNAPSHOT_KEY.usQuotesBulk, segment, snapshot);
      return res.ok ? `ok:${fetched.length}` : res.reason;
    } catch (e) {
      return `error:${e instanceof Error ? e.message.slice(0, 80) : "unknown"}`;
    }
  });
}
