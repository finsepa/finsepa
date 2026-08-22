/**
 * Durable aggregate list of Superinvestor table rows (ready-to-render).
 * Warm `/superinvestors` reads this single market_snapshot row — no SEC, no per-manager fan-out.
 */

import "server-only";

import type { SuperinvestorsFundRowModel } from "@/components/superinvestors/superinvestors-fund-table";
import { marketSnapshotReadEnabled } from "@/lib/market/market-snapshot-store";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { SUPERINVESTOR_REGISTRY } from "@/lib/superinvestors/superinvestor-registry";
import { SUPERINVESTOR_SLUG_CIK } from "@/lib/superinvestors/superinvestor-slug-cik";
import {
  readSuperinvestor13fProfileSnapshotLatest,
  type SuperinvestorSnapshotUpsertResult,
} from "@/lib/superinvestors/superinvestor-13f-holdings-transactions-snapshot";
import { cikPad10 } from "@/lib/superinvestors/superinvestor-13f-freshness";
import { traceSuperinvestorListSnapshotRead } from "@/lib/superinvestors/superinvestor-readpath-trace";
import type { Superinvestor13fProfilePageData } from "@/lib/superinvestors/types";

export const SUPERINVESTOR_LIST_SNAPSHOT_KEY = "superinvestor_list_v1";

export type SuperinvestorListSnapshotPayload = {
  version: 1;
  updatedAt: string;
  rows: SuperinvestorsFundRowModel[];
};

function isFundRow(value: unknown): value is SuperinvestorsFundRowModel {
  if (!value || typeof value !== "object") return false;
  const row = value as SuperinvestorsFundRowModel;
  return (
    typeof row.href === "string" &&
    typeof row.displayName === "string" &&
    typeof row.totalValueUsd === "number" &&
    typeof row.positionCount === "number" &&
    Array.isArray(row.topHoldings)
  );
}

function parseListSnapshot(data: unknown): SuperinvestorListSnapshotPayload | null {
  if (!data || typeof data !== "object") return null;
  const payload = data as SuperinvestorListSnapshotPayload;
  if (payload.version !== 1 || !Array.isArray(payload.rows)) return null;
  if (!payload.rows.every(isFundRow)) return null;
  return {
    version: 1,
    updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : new Date(0).toISOString(),
    rows: payload.rows,
  };
}

/** Content segment so upserts are visible; not used for read matching. */
export function superinvestorListSnapshotSegment(rows: SuperinvestorsFundRowModel[]): string {
  const parts = rows
    .map((r) => `${r.href}:${r.filingDate ?? ""}:${r.totalValueUsd}:${r.positionCount}`)
    .sort();
  let hash = 0;
  const joined = parts.join("|");
  for (let i = 0; i < joined.length; i++) {
    hash = (hash * 31 + joined.charCodeAt(i)) | 0;
  }
  return `v1_${(hash >>> 0).toString(16)}`;
}

export function listRowFromProfilePage(
  slug: string,
  displayName: string,
  avatarSrc: string | null,
  page: Superinvestor13fProfilePageData,
): SuperinvestorsFundRowModel {
  const { comparison } = page;
  return {
    href: `/superinvestors/${slug}`,
    displayName,
    avatarSrc,
    totalValueUsd: comparison.totalValueUsd,
    positionCount: comparison.positionCount,
    filingDate: comparison.current.filingDate,
    activityCount: page.transactions.quarters[0]?.transactions.length ?? 0,
    topHoldings: comparison.rows.slice(0, 5).map((h) => ({
      issuer: h.companyName,
      ticker: h.ticker,
    })),
  };
}

export async function readSuperinvestorListSnapshot(): Promise<SuperinvestorListSnapshotPayload | null> {
  if (!marketSnapshotReadEnabled()) return null;
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  traceSuperinvestorListSnapshotRead();
  const { data, error } = await admin
    .from("market_snapshot")
    .select("key, segment, data, updated_at")
    .eq("key", SUPERINVESTOR_LIST_SNAPSHOT_KEY)
    .maybeSingle();

  if (error || !data) return null;
  return parseListSnapshot((data as { data: unknown }).data);
}

export async function upsertSuperinvestorListSnapshot(
  rows: SuperinvestorsFundRowModel[],
): Promise<SuperinvestorSnapshotUpsertResult> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, bytes: 0, error: "no_admin_client" };

  const sorted = [...rows].sort((a, b) => b.totalValueUsd - a.totalValueUsd);
  const payload: SuperinvestorListSnapshotPayload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    rows: sorted,
  };
  const bytes = JSON.stringify(payload).length;
  const { error } = await admin.from("market_snapshot").upsert(
    {
      key: SUPERINVESTOR_LIST_SNAPSHOT_KEY,
      segment: superinvestorListSnapshotSegment(sorted),
      data: payload,
      updated_at: payload.updatedAt,
    },
    { onConflict: "key" },
  );
  if (error) return { ok: false, bytes, error: error.message };
  return { ok: true, bytes };
}

/**
 * Assemble list rows from durable per-CIK profile snapshots (no SEC).
 * Used as cold fallback and as the cron rebuild source.
 */
export async function buildSuperinvestorListRowsFromProfileSnapshots(): Promise<SuperinvestorsFundRowModel[]> {
  const rows: SuperinvestorsFundRowModel[] = [];

  await Promise.all(
    SUPERINVESTOR_REGISTRY.map(async (item) => {
      const cik = cikPad10(SUPERINVESTOR_SLUG_CIK[item.slug] ?? "");
      if (!cik) return;
      const page = await readSuperinvestor13fProfileSnapshotLatest(cik);
      if (!page || page.comparison.source === "unavailable") return;
      rows.push(listRowFromProfilePage(item.slug, item.managerName, item.avatarSrc, page));
    }),
  );

  rows.sort((a, b) => b.totalValueUsd - a.totalValueUsd);
  return rows;
}

/** Rebuild + atomically replace the aggregate list snapshot (cron / self-heal). */
export async function refreshSuperinvestorListSnapshot(): Promise<{
  ok: boolean;
  rowCount: number;
  error?: string;
}> {
  const rows = await buildSuperinvestorListRowsFromProfileSnapshots();
  if (rows.length === 0) {
    return { ok: false, rowCount: 0, error: "no_profile_snapshots" };
  }
  const result = await upsertSuperinvestorListSnapshot(rows);
  return { ok: result.ok, rowCount: rows.length, error: result.error };
}
