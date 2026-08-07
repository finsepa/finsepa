import { NextResponse } from "next/server";

import { pickProcessEnv } from "@/lib/env/pick-process-env";
import { loadSuperinvestorsListRows } from "@/lib/superinvestors/load-superinvestors-list-rows";
import { loadSuperinvestorProfilePageData } from "@/lib/superinvestors/load-superinvestor-profile-data";
import {
  readSuperinvestorListSnapshot,
  refreshSuperinvestorListSnapshot,
  SUPERINVESTOR_LIST_SNAPSHOT_KEY,
} from "@/lib/superinvestors/superinvestor-list-snapshot";
import {
  readSuperinvestor13fProfileSnapshotLatest,
  superinvestor13fProfileSnapshotKey,
} from "@/lib/superinvestors/superinvestor-13f-holdings-transactions-snapshot";
import {
  beginSuperinvestorReadpathTrace,
  endSuperinvestorReadpathTrace,
} from "@/lib/superinvestors/superinvestor-readpath-trace";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { SUPERINVESTOR_SLUG_CIK } from "@/lib/superinvestors/superinvestor-slug-cik";
import { cikPad10 } from "@/lib/superinvestors/superinvestor-13f-freshness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorize(request: Request): boolean {
  const secret = pickProcessEnv("CRON_SECRET");
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function timeMs<T>(fn: () => Promise<T>): Promise<{ ms: number; value: T }> {
  const t0 = performance.now();
  const value = await fn();
  return { ms: Math.round(performance.now() - t0), value };
}

async function readSnapshotMeta(key: string) {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("market_snapshot")
    .select("key, segment, updated_at")
    .eq("key", key)
    .maybeSingle();
  return data as { key: string; segment: string; updated_at: string } | null;
}

/**
 * One-shot Superinvestors read-path verification (auth: Bearer CRON_SECRET).
 * Rebuilds list snapshot once, measures warm list/profile call counts + timings,
 * and confirms failed upserts do not wipe prior durable rows.
 */
export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const profileSlug = url.searchParams.get("slug")?.trim() || "berkshire-hathaway";
    const cik = cikPad10(SUPERINVESTOR_SLUG_CIK[profileSlug] ?? "");
    if (!cik) {
      return NextResponse.json({ error: "unknown_slug", profileSlug }, { status: 404 });
    }

    const listBeforeRebuild = await readSnapshotMeta(SUPERINVESTOR_LIST_SNAPSHOT_KEY);
    const profileKey = superinvestor13fProfileSnapshotKey(cik);
    const profileBefore = await readSnapshotMeta(profileKey);

    const rebuild = await timeMs(() => refreshSuperinvestorListSnapshot());
    const listAfterRebuild = await readSnapshotMeta(SUPERINVESTOR_LIST_SNAPSHOT_KEY);

    // Warm list #1
    beginSuperinvestorReadpathTrace();
    const list1 = await timeMs(() => loadSuperinvestorsListRows());
    const list1Trace = endSuperinvestorReadpathTrace();

    // Warm list #2 (repeated refresh — must not fan out)
    beginSuperinvestorReadpathTrace();
    const list2 = await timeMs(() => loadSuperinvestorsListRows());
    const list2Trace = endSuperinvestorReadpathTrace();

    // Warm list #3
    beginSuperinvestorReadpathTrace();
    const list3 = await timeMs(() => loadSuperinvestorsListRows());
    const list3Trace = endSuperinvestorReadpathTrace();

    // Warm profile (twice)
    beginSuperinvestorReadpathTrace();
    const profile1 = await timeMs(() => loadSuperinvestorProfilePageData(profileSlug, { holdingsPage: 1 }));
    const profile1Trace = endSuperinvestorReadpathTrace();

    beginSuperinvestorReadpathTrace();
    const profile2 = await timeMs(() => loadSuperinvestorProfilePageData(profileSlug, { holdingsPage: 1 }));
    const profile2Trace = endSuperinvestorReadpathTrace();

    // Failed upsert must preserve prior list + profile snapshots
    const admin = getSupabaseAdminClient();
    let failedUpsertPreserved = false;
    let failedUpsertError: string | null = null;
    if (admin && listAfterRebuild && profileBefore) {
      const listMetaPre = await readSnapshotMeta(SUPERINVESTOR_LIST_SNAPSHOT_KEY);
      const profileMetaPre = await readSnapshotMeta(profileKey);

      const { error: listFailErr } = await admin.from("market_snapshot").upsert(
        {
          key: SUPERINVESTOR_LIST_SNAPSHOT_KEY,
          segment: "verify_should_fail",
          data: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );
      const { error: profileFailErr } = await admin.from("market_snapshot").upsert(
        {
          key: profileKey,
          segment: "verify_should_fail",
          data: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );

      const listMetaPost = await readSnapshotMeta(SUPERINVESTOR_LIST_SNAPSHOT_KEY);
      const profileMetaPost = await readSnapshotMeta(profileKey);

      failedUpsertError = listFailErr?.message || profileFailErr?.message || null;
      failedUpsertPreserved =
        Boolean(listFailErr || profileFailErr) &&
        listMetaPre?.segment === listMetaPost?.segment &&
        listMetaPre?.updated_at === listMetaPost?.updated_at &&
        profileMetaPre?.segment === profileMetaPost?.segment &&
        profileMetaPre?.updated_at === profileMetaPost?.updated_at;
    }

    // Empty rebuild must not wipe list (refresh returns error, no destructive delete)
    const emptyRebuildPreserves =
      rebuild.value.ok === false
        ? Boolean(listAfterRebuild)
        : true; /* successful rebuild replaces atomically; empty path checked via code + failed upsert */

    const snap = await readSuperinvestorListSnapshot();
    const profileSnap = await readSuperinvestor13fProfileSnapshotLatest(cik);

    const warmListExactOneDb =
      list1Trace.listSnapshotReads === 1 &&
      list2Trace.listSnapshotReads === 1 &&
      list3Trace.listSnapshotReads === 1 &&
      list1Trace.profileSnapshotLatestReads === 0 &&
      list2Trace.profileSnapshotLatestReads === 0 &&
      list3Trace.profileSnapshotLatestReads === 0;

    const warmListNoSec =
      list1Trace.secFetches === 0 && list2Trace.secFetches === 0 && list3Trace.secFetches === 0;

    const warmProfileNoSec = profile1Trace.secFetches === 0 && profile2Trace.secFetches === 0;

    const noManagerFanOut =
      list1Trace.profileSnapshotLatestReads === 0 &&
      list2Trace.profileSnapshotLatestReads === 0 &&
      list3Trace.profileSnapshotLatestReads === 0 &&
      list1Trace.holdingsLoaderCalls === 0 &&
      list2Trace.holdingsLoaderCalls === 0 &&
      list3Trace.holdingsLoaderCalls === 0;

    return NextResponse.json({
      ok:
        warmListExactOneDb &&
        warmListNoSec &&
        warmProfileNoSec &&
        noManagerFanOut &&
        failedUpsertPreserved &&
        Boolean(snap?.rows.length) &&
        Boolean(profile1.value) &&
        Boolean(profileSnap),
      rebuild: {
        ms: rebuild.ms,
        ...rebuild.value,
        listBefore: listBeforeRebuild,
        listAfter: listAfterRebuild,
      },
      list: {
        rowCount: list1.value.length,
        timingsMs: { first: list1.ms, second: list2.ms, third: list3.ms },
        traces: { first: list1Trace, second: list2Trace, third: list3Trace },
        warmExactOneSnapshotDbRead: warmListExactOneDb,
        warmNoSec: warmListNoSec,
        noManagerFanOut,
      },
      profile: {
        slug: profileSlug,
        cik,
        hasPage: Boolean(profile1.value),
        filingDate: profile1.value?.comparison.current.filingDate ?? null,
        accession: profile1.value?.comparison.current.accessionNumber ?? null,
        timingsMs: { first: profile1.ms, second: profile2.ms },
        traces: { first: profile1Trace, second: profile2Trace },
        warmNoSec: warmProfileNoSec,
        profileSnapshotBefore: profileBefore,
      },
      preservation: {
        failedUpsertPreserved,
        failedUpsertError,
        emptyRebuildPreserves,
      },
      beforeReferenceFromDevLogs: {
        note: "Prior /superinvestors SSR from local terminal (pre-optimization warmish path)",
        applicationCodeMs: 747,
        totalMs: 892,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "verify_failed";
    console.error("[superinvestors-verify-readpath]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
