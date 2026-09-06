/**
 * Durable Form 4 insider rows (1Y window) in `market_snapshot`.
 * User path reads snapshot first; weekday cron refreshes TOP10; cold miss rebuilds once.
 */
import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { marketSnapshotReadEnabled } from "@/lib/market/market-snapshot-store";
import type { InsiderTransactionRow } from "@/lib/market/insider-transactions-types";

export type InsiderTransactionsSnapshot = {
  ticker: string;
  rows: InsiderTransactionRow[];
  windowFrom: string;
  windowTo: string;
};

export const INSIDER_FORM4_1Y_SEGMENT = "form4_1y_v1";

/** Skip cron rebuild when snapshot is newer than this. */
export const INSIDER_SNAPSHOT_FRESH_MS = 20 * 60 * 60 * 1000;

export function insiderForm4_1ySnapshotKey(ticker: string): string | null {
  const t = ticker.trim().toUpperCase();
  if (!t) return null;
  return `insider_form4_1y_${t}`;
}

function isRowArray(raw: unknown): raw is InsiderTransactionRow[] {
  return Array.isArray(raw);
}

export function isUsableInsiderTransactionsSnapshot(
  data: unknown,
  ticker: string,
): data is InsiderTransactionsSnapshot {
  if (!data || typeof data !== "object") return false;
  const d = data as InsiderTransactionsSnapshot;
  if (d.ticker !== ticker.trim().toUpperCase()) return false;
  if (!isRowArray(d.rows)) return false;
  if (typeof d.windowFrom !== "string" || typeof d.windowTo !== "string") return false;
  return true;
}

export async function readInsiderTransactionsSnapshot(
  ticker: string,
): Promise<{ payload: InsiderTransactionsSnapshot; updatedAt: string } | null> {
  const key = insiderForm4_1ySnapshotKey(ticker);
  if (!key || !marketSnapshotReadEnabled()) return null;

  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("market_snapshot")
    .select("key, segment, data, updated_at")
    .eq("key", key)
    .maybeSingle();

  if (error || !data || data.segment !== INSIDER_FORM4_1Y_SEGMENT) return null;
  if (!isUsableInsiderTransactionsSnapshot(data.data, ticker)) return null;

  return {
    payload: data.data as InsiderTransactionsSnapshot,
    updatedAt: typeof data.updated_at === "string" ? data.updated_at : "",
  };
}

export async function upsertInsiderTransactionsSnapshot(
  ticker: string,
  payload: InsiderTransactionsSnapshot,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const key = insiderForm4_1ySnapshotKey(ticker);
  if (!key) return { ok: false, reason: "invalid_ticker" };

  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, reason: "no_supabase_admin" };

  const { error } = await admin.from("market_snapshot").upsert(
    {
      key,
      segment: INSIDER_FORM4_1Y_SEGMENT,
      data: payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

export function insiderSnapshotIsFresh(updatedAt: string, nowMs = Date.now()): boolean {
  const t = Date.parse(updatedAt);
  if (!Number.isFinite(t)) return false;
  return nowMs - t < INSIDER_SNAPSHOT_FRESH_MS;
}
