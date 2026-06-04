import "server-only";

import type { Superinvestor13fProfilePageData } from "@/lib/superinvestors/types";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { marketSnapshotReadEnabled } from "@/lib/market/market-snapshot-store";
import type { SuperinvestorTransactionsPayload } from "@/lib/superinvestors/types";

export function superinvestor13fHoldingsTxSnapshotKey(cikPadded: string): string {
  return `superinvestor_13f_holdings_tx_v3_${cikPadded}`;
}

export function superinvestor13fProfileSnapshotKey(cikPadded: string): string {
  return `superinvestor_13f_profile_v3_${cikPadded}`;
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
  const payload = data as SuperinvestorTransactionsPayload | null;
  if (!payload?.quarters || !Array.isArray(payload.quarters)) return null;
  return payload;
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

export async function upsertSuperinvestorHoldingsTransactionsSnapshot(
  cikPadded: string,
  accessionSegment: string,
  payload: SuperinvestorTransactionsPayload,
): Promise<void> {
  if (!accessionSegment || accessionSegment === "none") return;

  const admin = getSupabaseAdminClient();
  if (!admin) return;

  await admin.from("market_snapshot").upsert(
    {
      key: superinvestor13fHoldingsTxSnapshotKey(cikPadded),
      segment: accessionSegment,
      data: payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
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

export async function upsertSuperinvestor13fProfileSnapshot(
  cikPadded: string,
  accessionSegment: string,
  payload: Superinvestor13fProfilePageData,
): Promise<void> {
  if (!accessionSegment || accessionSegment === "none") return;

  const admin = getSupabaseAdminClient();
  if (!admin) return;

  await admin.from("market_snapshot").upsert(
    {
      key: superinvestor13fProfileSnapshotKey(cikPadded),
      segment: accessionSegment,
      data: payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
}
