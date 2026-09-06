/**
 * Durable inverted index: ticker / issuer name → superinvestor positions.
 * Warm stock Superinvestors tab reads this single market_snapshot row —
 * no SEC fan-out, no EODHD (same pattern as {@link SUPERINVESTOR_LIST_SNAPSHOT_KEY}).
 */

import "server-only";

import { marketSnapshotReadEnabled } from "@/lib/market/market-snapshot-store";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { SUPERINVESTOR_REGISTRY } from "@/lib/superinvestors/superinvestor-registry";
import { SUPERINVESTOR_SLUG_CIK } from "@/lib/superinvestors/superinvestor-slug-cik";
import {
  readSuperinvestor13fProfileSnapshotLatest,
  type SuperinvestorSnapshotUpsertResult,
} from "@/lib/superinvestors/superinvestor-13f-holdings-transactions-snapshot";
import { cikPad10 } from "@/lib/superinvestors/superinvestor-13f-freshness";
import type { StockSuperinvestorPosition } from "@/lib/superinvestors/stock-superinvestor-positions";
import type { Berkshire13fComparisonRow, Holding13fComparisonStatus } from "@/lib/superinvestors/types";

export const SUPERINVESTOR_STOCK_INDEX_SNAPSHOT_KEY = "superinvestor_stock_index_v1";

export type SuperinvestorStockIndexSnapshotPayload = {
  version: 1;
  updatedAt: string;
  byTicker: Record<string, StockSuperinvestorPosition[]>;
  byNameExact: Record<string, StockSuperinvestorPosition[]>;
};

function normalizeIssuerName(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(inc|incorporated|corp|corporation|co|company|ltd|limited|plc|del|holdings)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function activityLabel(status: Holding13fComparisonStatus | null, sharesChangePct: number | null): string | null {
  if (!status) return null;
  if (status === "new") return "New";
  if (status === "unchanged") return "Unchanged";
  const pct =
    sharesChangePct != null && Number.isFinite(sharesChangePct) ? Math.abs(sharesChangePct).toFixed(2) : null;
  if (status === "add") return pct ? `Increased ${pct}%` : "Increased";
  if (status === "reduce") return pct ? `Reduced ${pct}%` : "Reduced";
  return null;
}

function positionFromRow(
  registry: (typeof SUPERINVESTOR_REGISTRY)[number],
  filerDisplayName: string,
  row: Berkshire13fComparisonRow,
): StockSuperinvestorPosition {
  return {
    superinvestorSlug: registry.slug,
    managerName: registry.managerName,
    fundName: registry.fundNameOverride ?? filerDisplayName,
    avatarSrc: registry.avatarSrc,
    weightPct: row.weight,
    statusLabel: activityLabel(row.status, row.sharesChangePct),
    shares: row.shares,
    valueUsd: row.valueUsd,
  };
}

function pushIndex(
  map: Record<string, StockSuperinvestorPosition[]>,
  key: string,
  position: StockSuperinvestorPosition,
) {
  const bucket = map[key];
  if (bucket) bucket.push(position);
  else map[key] = [position];
}

function isPosition(value: unknown): value is StockSuperinvestorPosition {
  if (!value || typeof value !== "object") return false;
  const p = value as StockSuperinvestorPosition;
  return (
    typeof p.superinvestorSlug === "string" &&
    typeof p.managerName === "string" &&
    typeof p.fundName === "string" &&
    typeof p.weightPct === "number" &&
    typeof p.valueUsd === "number"
  );
}

function parseStockIndexSnapshot(data: unknown): SuperinvestorStockIndexSnapshotPayload | null {
  if (!data || typeof data !== "object") return null;
  const payload = data as SuperinvestorStockIndexSnapshotPayload;
  if (payload.version !== 1) return null;
  if (!payload.byTicker || typeof payload.byTicker !== "object") return null;
  if (!payload.byNameExact || typeof payload.byNameExact !== "object") return null;
  for (const rows of Object.values(payload.byTicker)) {
    if (!Array.isArray(rows) || !rows.every(isPosition)) return null;
  }
  for (const rows of Object.values(payload.byNameExact)) {
    if (!Array.isArray(rows) || !rows.every(isPosition)) return null;
  }
  return {
    version: 1,
    updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : new Date(0).toISOString(),
    byTicker: payload.byTicker,
    byNameExact: payload.byNameExact,
  };
}

export function superinvestorStockIndexSnapshotSegment(
  byTicker: Record<string, StockSuperinvestorPosition[]>,
): string {
  const tickers = Object.keys(byTicker).sort();
  let hash = tickers.length;
  for (const t of tickers) {
    hash = (hash * 31 + (byTicker[t]?.length ?? 0)) | 0;
    for (let i = 0; i < t.length; i++) hash = (hash * 31 + t.charCodeAt(i)) | 0;
  }
  return `v1_${(hash >>> 0).toString(16)}`;
}

export async function readSuperinvestorStockIndexSnapshot(): Promise<SuperinvestorStockIndexSnapshotPayload | null> {
  if (!marketSnapshotReadEnabled()) return null;
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("market_snapshot")
    .select("key, segment, data, updated_at")
    .eq("key", SUPERINVESTOR_STOCK_INDEX_SNAPSHOT_KEY)
    .maybeSingle();

  if (error || !data) return null;
  return parseStockIndexSnapshot((data as { data: unknown }).data);
}

export async function upsertSuperinvestorStockIndexSnapshot(
  byTicker: Record<string, StockSuperinvestorPosition[]>,
  byNameExact: Record<string, StockSuperinvestorPosition[]>,
): Promise<SuperinvestorSnapshotUpsertResult> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, bytes: 0, error: "no_admin_client" };

  const payload: SuperinvestorStockIndexSnapshotPayload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    byTicker,
    byNameExact,
  };
  const bytes = JSON.stringify(payload).length;
  const { error } = await admin.from("market_snapshot").upsert(
    {
      key: SUPERINVESTOR_STOCK_INDEX_SNAPSHOT_KEY,
      segment: superinvestorStockIndexSnapshotSegment(byTicker),
      data: payload,
      updated_at: payload.updatedAt,
    },
    { onConflict: "key" },
  );
  if (error) return { ok: false, bytes, error: error.message };
  return { ok: true, bytes };
}

/**
 * Assemble inverted index from durable per-CIK profile snapshots (no SEC / EODHD).
 */
export async function buildSuperinvestorStockIndexFromProfileSnapshots(): Promise<{
  byTicker: Record<string, StockSuperinvestorPosition[]>;
  byNameExact: Record<string, StockSuperinvestorPosition[]>;
  fundCount: number;
}> {
  const byTicker: Record<string, StockSuperinvestorPosition[]> = {};
  const byNameExact: Record<string, StockSuperinvestorPosition[]> = {};
  let fundCount = 0;

  await Promise.all(
    SUPERINVESTOR_REGISTRY.map(async (item) => {
      const cik = cikPad10(SUPERINVESTOR_SLUG_CIK[item.slug] ?? "");
      if (!cik) return;
      const page = await readSuperinvestor13fProfileSnapshotLatest(cik);
      if (!page || page.comparison.source === "unavailable") return;
      fundCount += 1;
      for (const row of page.comparison.rows) {
        const position = positionFromRow(item, page.comparison.filerDisplayName, row);
        const ticker = (row.ticker ?? "").trim().toUpperCase();
        if (ticker) pushIndex(byTicker, ticker, position);
        const nameNorm = normalizeIssuerName(row.companyName);
        if (nameNorm) pushIndex(byNameExact, nameNorm, position);
      }
    }),
  );

  return { byTicker, byNameExact, fundCount };
}

/** Rebuild + atomically replace the stock-tab inverted index (cron / self-heal). */
export async function refreshSuperinvestorStockIndexSnapshot(): Promise<{
  ok: boolean;
  tickerCount: number;
  fundCount: number;
  error?: string;
}> {
  const { byTicker, byNameExact, fundCount } = await buildSuperinvestorStockIndexFromProfileSnapshots();
  const tickerCount = Object.keys(byTicker).length;
  if (fundCount === 0 || tickerCount === 0) {
    return { ok: false, tickerCount, fundCount, error: "no_profile_snapshots" };
  }
  const result = await upsertSuperinvestorStockIndexSnapshot(byTicker, byNameExact);
  return { ok: result.ok, tickerCount, fundCount, error: result.error };
}

export function lookupStockSuperinvestorPositionsFromIndex(
  byTicker: Record<string, StockSuperinvestorPosition[]>,
  byNameExact: Record<string, StockSuperinvestorPosition[]>,
  ticker: string,
  companyNameNorm: string | null,
): StockSuperinvestorPosition[] {
  const sym = ticker.trim().toUpperCase();
  let positions = byTicker[sym] ?? [];
  if (positions.length > 0 || !companyNameNorm) return positions;

  positions = byNameExact[companyNameNorm] ?? [];
  if (positions.length > 0) return positions;

  const out: StockSuperinvestorPosition[] = [];
  const seen = new Set<string>();
  for (const [nameNorm, rows] of Object.entries(byNameExact)) {
    if (
      nameNorm !== companyNameNorm &&
      !nameNorm.includes(companyNameNorm) &&
      !companyNameNorm.includes(nameNorm)
    ) {
      continue;
    }
    for (const position of rows) {
      if (seen.has(position.superinvestorSlug)) continue;
      seen.add(position.superinvestorSlug);
      out.push(position);
    }
  }
  return out;
}
