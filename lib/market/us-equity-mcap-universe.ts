import "server-only";

import { getEodhdApiKey } from "@/lib/env/server";
import { fetchEodhd } from "@/lib/market/eodhd-fetch";
import { HUB_SNAPSHOT_KEY } from "@/lib/market/hub-snapshot-keys";
import { readHubSnapshot } from "@/lib/market/hub-snapshot-store";
import { traceEodhdHttp } from "@/lib/market/provider-trace";

/**
 * Every US equity listing at or above the earnings market-cap floor, from EODHD screener pages split into
 * market-cap bands (the screener cannot page past ~1,000 rows per sort). Refreshed once a day by the hub cron
 * (~50 screener requests) so the earnings calendar never fetches per-ticker fundamentals just to size companies.
 */
export const US_EQUITY_MCAP_FLOOR_USD = 1_500_000_000;

/** `[ticker, name, marketCapUsd]` — compact so the snapshot stays a few hundred KB. */
export type UsEquityMcapRow = [string, string, number];
export type UsEquityMcapSnapshot = { builtAt: string; rows: UsEquityMcapRow[] };

const PAGE = 100;
const MAX_ROWS_PER_SORT = 1_000;
/** A healthy build is several thousand listings; anything far below means pages failed. */
const MIN_HEALTHY_ROWS = 1_500;
const SNAPSHOT_MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000;

const INITIAL_BANDS: readonly [number, number | null][] = [
  [1.5e9, 2.5e9],
  [2.5e9, 4e9],
  [4e9, 7e9],
  [7e9, 12e9],
  [12e9, 25e9],
  [25e9, 60e9],
  [60e9, null],
];

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

async function fetchBandPage(lo: number, hi: number | null, offset: number): Promise<UsEquityMcapRow[] | null> {
  const key = getEodhdApiKey();
  if (!key) return null;
  const filters: [string, string, string | number][] = [
    ["exchange", "=", "us"],
    ["market_capitalization", ">=", lo],
  ];
  if (hi != null) filters.push(["market_capitalization", "<", hi]);
  const params = new URLSearchParams({
    api_token: key,
    fmt: "json",
    sort: "market_capitalization.desc",
    limit: String(PAGE),
    offset: String(offset),
    filters: JSON.stringify(filters),
  });
  try {
    if (!traceEodhdHttp("fetchUsEquityMcapBand", { lo, hi, offset })) return null;
    const res = await fetchEodhd(`https://eodhd.com/api/screener?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = ((await res.json()) as { data?: unknown }).data;
    if (!Array.isArray(data)) return null;
    const out: UsEquityMcapRow[] = [];
    for (const raw of data) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      const ticker = typeof r.code === "string" ? r.code.trim().toUpperCase() : "";
      const mc = num(r.market_capitalization);
      if (!ticker || mc == null || mc <= 0) continue;
      out.push([ticker, typeof r.name === "string" ? r.name.trim() : ticker, mc]);
    }
    return out;
  } catch {
    return null;
  }
}

/** All rows in one band; splits the band when it hits the screener's paging cap. `null` when any page failed. */
async function fetchBand(lo: number, hi: number | null, depth = 0): Promise<UsEquityMcapRow[] | null> {
  const rows: UsEquityMcapRow[] = [];
  for (let offset = 0; offset < MAX_ROWS_PER_SORT; offset += PAGE) {
    const page = await fetchBandPage(lo, hi, offset);
    if (page == null) return null;
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
  if (depth >= 4) return rows;
  const upper = hi ?? lo * 8;
  const mid = Math.sqrt(lo * upper);
  const [low, high] = await Promise.all([fetchBand(lo, mid, depth + 1), fetchBand(mid, hi, depth + 1)]);
  return low && high ? [...high, ...low] : null;
}

/** Cron ingest. Returns `null` when the build looks incomplete — callers keep the previous snapshot. */
export async function buildUsEquityMcapSnapshotForIngest(): Promise<UsEquityMcapSnapshot | null> {
  const bands = await Promise.all(INITIAL_BANDS.map(([lo, hi]) => fetchBand(lo, hi)));
  if (bands.some((b) => b == null)) return null;
  const byTicker = new Map<string, UsEquityMcapRow>();
  for (const row of bands.flat() as UsEquityMcapRow[]) {
    const prev = byTicker.get(row[0]);
    if (!prev || row[2] > prev[2]) byTicker.set(row[0], row);
  }
  if (byTicker.size < MIN_HEALTHY_ROWS) return null;
  return { builtAt: new Date().toISOString(), rows: [...byTicker.values()] };
}

export function usEquityMcapSegment(now: Date = new Date()): string {
  return `us_mcap_${now.toISOString().slice(0, 10)}`;
}

/**
 * Normalized ticker (`BRK.B`, no `.US`) → `{ name, marketCapUsd }`, or `null` when no usable snapshot exists yet
 * (earnings then falls back to per-ticker fundamentals).
 */
export async function readUsEquityMcapMap(): Promise<Map<string, { name: string; marketCapUsd: number }> | null> {
  const snap = await readHubSnapshot<UsEquityMcapSnapshot>(HUB_SNAPSHOT_KEY.usEquityMcap, usEquityMcapSegment(), {
    allowStale: true,
    maxStaleMs: SNAPSHOT_MAX_STALE_MS,
  });
  if (!snap || !Array.isArray(snap.rows) || snap.rows.length < MIN_HEALTHY_ROWS) return null;
  const map = new Map<string, { name: string; marketCapUsd: number }>();
  for (const [ticker, name, mc] of snap.rows) {
    map.set(ticker.toUpperCase().replace(/\.US$/i, "").replace(/-/g, "."), { name, marketCapUsd: mc });
  }
  return map;
}

const MCAP_MAP_TTL_MS = 10 * 60 * 1000;
let mcapMapCache: { at: number; map: Awaited<ReturnType<typeof readUsEquityMcapMap>> } | null = null;

/** {@link readUsEquityMcapMap} memoized in-process — the snapshot changes once a day; request paths read it often. */
export async function readUsEquityMcapMapCached(): ReturnType<typeof readUsEquityMcapMap> {
  if (mcapMapCache && Date.now() - mcapMapCache.at < MCAP_MAP_TTL_MS) return mcapMapCache.map;
  const map = await readUsEquityMcapMap().catch(() => null);
  mcapMapCache = { at: Date.now(), map };
  return map;
}
