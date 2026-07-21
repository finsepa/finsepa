import "server-only";

import type { Superinvestor13fProfilePageData } from "@/lib/superinvestors/types";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { marketSnapshotReadEnabled } from "@/lib/market/market-snapshot-store";
import type { SuperinvestorTransactionsPayload } from "@/lib/superinvestors/types";
import { slimSuperinvestorProfileForSnapshot } from "@/lib/superinvestors/superinvestor-13f-snapshot-slim";
import {
  parseSuperinvestorTransactionsSnapshotData,
  type SuperinvestorTransactionsPayloadSlim,
} from "@/lib/superinvestors/superinvestor-13f-transactions-slim";

export { slimSuperinvestorProfileForSnapshot } from "@/lib/superinvestors/superinvestor-13f-snapshot-slim";

export function superinvestor13fHoldingsTxSnapshotKey(cikPadded: string): string {
  return `superinvestor_13f_holdings_tx_v3_${cikPadded}`;
}

export function superinvestor13fProfileSnapshotKey(cikPadded: string): string {
  return `superinvestor_13f_profile_v3_${cikPadded}`;
}

/** Full ~85-filing transaction history for Activity search API. */
export function superinvestor13fFullTransactionsSnapshotKey(cikPadded: string): string {
  return `superinvestor_13f_transactions_full_v3_${cikPadded}`;
}

export type SuperinvestorHoldingsTransactionsSnapshotRow = {
  segment: string;
  payload: SuperinvestorTransactionsPayload;
  updatedAt: string | null;
};

async function readMarketSnapshotRow(key: string): Promise<{
  segment: string;
  data: unknown;
  updated_at: string | null;
} | null> {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("market_snapshot")
    .select("key, segment, data, updated_at")
    .eq("key", key)
    .maybeSingle();

  if (error || !data) return null;
  return data as { segment: string; data: unknown; updated_at: string | null };
}

function parseTransactionsPayload(data: unknown): SuperinvestorTransactionsPayload | null {
  return parseSuperinvestorTransactionsSnapshotData(data);
}

function parseProfilePayload(data: unknown): Superinvestor13fProfilePageData | null {
  const payload = data as Superinvestor13fProfilePageData | null;
  if (!payload?.comparison?.rows || !payload?.transactions?.quarters) return null;
  return payload;
}

/** Holdings-scoped transaction history for the latest 13F accession. */
export async function readSuperinvestorHoldingsTransactionsSnapshot(
  cikPadded: string,
  accessionSegment: string,
): Promise<SuperinvestorTransactionsPayload | null> {
  if (!accessionSegment || accessionSegment === "none") return null;
  if (!marketSnapshotReadEnabled()) return null;

  const row = await readMarketSnapshotRow(superinvestor13fHoldingsTxSnapshotKey(cikPadded));
  if (!row || row.segment !== accessionSegment) return null;
  return parseTransactionsPayload(row.data);
}

/** Prior snapshot (any accession) — used to append one new quarter on filing updates. */
export async function readSuperinvestorHoldingsTransactionsSnapshotRow(
  cikPadded: string,
): Promise<SuperinvestorHoldingsTransactionsSnapshotRow | null> {
  if (!marketSnapshotReadEnabled()) return null;

  const row = await readMarketSnapshotRow(superinvestor13fHoldingsTxSnapshotKey(cikPadded));
  if (!row) return null;

  const payload = parseTransactionsPayload(row.data);
  if (!payload) return null;

  return {
    segment: row.segment,
    payload,
    updatedAt: row.updated_at,
  };
}

export type SuperinvestorSnapshotUpsertResult = {
  ok: boolean;
  bytes: number;
  error?: string;
};

export async function upsertSuperinvestorHoldingsTransactionsSnapshot(
  cikPadded: string,
  accessionSegment: string,
  payload: SuperinvestorTransactionsPayload,
): Promise<SuperinvestorSnapshotUpsertResult> {
  if (!accessionSegment || accessionSegment === "none") {
    return { ok: false, bytes: 0, error: "missing_accession" };
  }

  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, bytes: 0, error: "no_admin_client" };

  const data = payload;
  const bytes = JSON.stringify(data).length;
  const { error } = await admin.from("market_snapshot").upsert(
    {
      key: superinvestor13fHoldingsTxSnapshotKey(cikPadded),
      segment: accessionSegment,
      data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) return { ok: false, bytes, error: error.message };
  return { ok: true, bytes };
}

/** Full Berkshire profile page (holdings table + scoped transactions) for fast SSR. */
export async function readSuperinvestor13fProfileSnapshot(
  cikPadded: string,
  accessionSegment: string,
): Promise<Superinvestor13fProfilePageData | null> {
  if (!accessionSegment || accessionSegment === "none") return null;
  if (!marketSnapshotReadEnabled()) return null;

  const row = await readMarketSnapshotRow(superinvestor13fProfileSnapshotKey(cikPadded));
  if (!row || row.segment !== accessionSegment) return null;
  return parseProfilePayload(row.data);
}

/** True when any profile snapshot row exists for this CIK (segment may be stale). */
export async function hasSuperinvestor13fProfileSnapshot(cikPadded: string): Promise<boolean> {
  if (!cikPadded.trim() || !marketSnapshotReadEnabled()) return false;
  const row = await readMarketSnapshotRow(superinvestor13fProfileSnapshotKey(cikPadded));
  return Boolean(row?.data);
}

export async function upsertSuperinvestor13fProfileSnapshot(
  cikPadded: string,
  accessionSegment: string,
  payload: Superinvestor13fProfilePageData,
): Promise<SuperinvestorSnapshotUpsertResult> {
  if (!accessionSegment || accessionSegment === "none") {
    return { ok: false, bytes: 0, error: "missing_accession" };
  }

  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, bytes: 0, error: "no_admin_client" };

  const data = slimSuperinvestorProfileForSnapshot(payload);
  const bytes = JSON.stringify(data).length;
  const { error } = await admin.from("market_snapshot").upsert(
    {
      key: superinvestor13fProfileSnapshotKey(cikPadded),
      segment: accessionSegment,
      data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) return { ok: false, bytes, error: error.message };
  return { ok: true, bytes };
}

/** Full transaction history snapshot (~85 filings) for the transactions API warm path. */
export async function readSuperinvestorFullTransactionsSnapshotSlim(
  cikPadded: string,
  accessionSegment: string,
): Promise<SuperinvestorTransactionsPayloadSlim | null> {
  if (!accessionSegment || accessionSegment === "none") return null;
  if (!marketSnapshotReadEnabled()) return null;

  const row = await readMarketSnapshotRow(superinvestor13fFullTransactionsSnapshotKey(cikPadded));
  if (!row || row.segment !== accessionSegment) return null;

  const payload = row.data as SuperinvestorTransactionsPayloadSlim | null;
  if (!payload?.quarters || !Array.isArray(payload.quarters)) return null;
  return payload;
}

export async function readSuperinvestorFullTransactionsSnapshot(
  cikPadded: string,
  accessionSegment: string,
): Promise<SuperinvestorTransactionsPayload | null> {
  const slim = await readSuperinvestorFullTransactionsSnapshotSlim(cikPadded, accessionSegment);
  if (!slim) return null;
  return parseTransactionsPayload(slim);
}

export async function upsertSuperinvestorFullTransactionsSnapshot(
  cikPadded: string,
  accessionSegment: string,
  payload: SuperinvestorTransactionsPayloadSlim,
): Promise<SuperinvestorSnapshotUpsertResult> {
  if (!accessionSegment || accessionSegment === "none") {
    return { ok: false, bytes: 0, error: "missing_accession" };
  }

  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, bytes: 0, error: "no_admin_client" };

  const bytes = JSON.stringify(payload).length;
  const { error } = await admin.from("market_snapshot").upsert(
    {
      key: superinvestor13fFullTransactionsSnapshotKey(cikPadded),
      segment: accessionSegment,
      data: payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) return { ok: false, bytes, error: error.message };
  return { ok: true, bytes };
}

/** Drop persisted 13F profile + tx rows so the next load re-fetches SEC. */
export async function deleteSuperinvestor13fSnapshotsForCik(cikPadded: string): Promise<boolean> {
  const admin = getSupabaseAdminClient();
  if (!admin || !cikPadded.trim()) return false;

  const keys = [
    superinvestor13fProfileSnapshotKey(cikPadded),
    superinvestor13fHoldingsTxSnapshotKey(cikPadded),
    superinvestor13fFullTransactionsSnapshotKey(cikPadded),
  ];
  const { error } = await admin.from("market_snapshot").delete().in("key", keys);
  return !error;
}
