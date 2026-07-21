/**
 * Superinvestors Phase 1 health / monitoring metrics (snapshot + last cron blob).
 */

import "server-only";

import { SUPERINVESTOR_REGISTRY } from "@/lib/superinvestors/superinvestor-registry";
import { SUPERINVESTOR_SLUG_CIK } from "@/lib/superinvestors/superinvestor-slug-cik";
import { superinvestor13fProfileSnapshotKey } from "@/lib/superinvestors/superinvestor-13f-holdings-transactions-snapshot";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { marketSnapshotReadEnabled } from "@/lib/market/market-snapshot-store";
import { cikPad10 } from "@/lib/superinvestors/superinvestor-13f-freshness";
import type { Superinvestor13fProfilePageData } from "@/lib/superinvestors/types";
import { validateSuperinvestorProfilePage } from "@/lib/superinvestors/superinvestor-13f-validate";

export { SUPERINVESTOR_SLUG_CIK } from "@/lib/superinvestors/superinvestor-slug-cik";

export const SUPERINVESTOR_13F_HEALTH_SNAPSHOT_KEY = "superinvestor_13f_health_v1";

export type Superinvestor13fHealthMetrics = {
  managersTotal: number;
  managersFresh: number;
  managersMissingSnapshots: number;
  unresolvedTickers: number;
  portfoliosFailingValidation: number;
  lastSuccessfulIngest: string | null;
  newestSECAccession: string | null;
  latestPortfolioAgeHours: number | null;
  averageProcessingTimeMs: number | null;
  managers: Array<{
    slug: string;
    cik: string;
    hasSnapshot: boolean;
    segment: string | null;
    updatedAt: string | null;
    holdingCount: number | null;
    unresolvedTickers: number | null;
    weightSum: number | null;
    validationOk: boolean | null;
    filingDate: string | null;
  }>;
  generatedAt: string;
};

type LastIngestBlob = {
  at: string;
  averageProcessingTimeMs: number;
  results: Array<{
    slug: string;
    ok: boolean;
    persisted?: boolean;
    validationOk?: boolean;
    unresolvedTickers?: number;
    holdingCount?: number;
    ingestMs?: number;
    accession?: string | null;
    filingDate?: string | null;
    error?: string;
  }>;
};

export async function writeSuperinvestor13fHealthFromCron(blob: LastIngestBlob): Promise<void> {
  const admin = getSupabaseAdminClient();
  if (!admin) return;
  await admin.from("market_snapshot").upsert(
    {
      key: SUPERINVESTOR_13F_HEALTH_SNAPSHOT_KEY,
      segment: "health",
      data: blob,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
}

export async function computeSuperinvestor13fHealthMetrics(): Promise<Superinvestor13fHealthMetrics> {
  const admin = getSupabaseAdminClient();
  const managersTotal = SUPERINVESTOR_REGISTRY.length;
  const generatedAt = new Date().toISOString();

  let lastIngest: LastIngestBlob | null = null;
  if (admin && marketSnapshotReadEnabled()) {
    const { data } = await admin
      .from("market_snapshot")
      .select("data")
      .eq("key", SUPERINVESTOR_13F_HEALTH_SNAPSHOT_KEY)
      .maybeSingle();
    if (data?.data && typeof data.data === "object") {
      lastIngest = data.data as LastIngestBlob;
    }
  }

  const managers: Superinvestor13fHealthMetrics["managers"] = [];
  let managersFresh = 0;
  let managersMissingSnapshots = 0;
  let unresolvedTickers = 0;
  let portfoliosFailingValidation = 0;
  let newestFilingDate: string | null = null;
  let newestSECAccession: string | null = null;

  const ingestBySlug = new Map(lastIngest?.results?.map((r) => [r.slug, r]) ?? []);

  let rowsByKey = new Map<string, { segment: string; updated_at: string | null; data: unknown }>();
  if (admin && marketSnapshotReadEnabled()) {
    const { data: rows } = await admin
      .from("market_snapshot")
      .select("key, segment, updated_at, data")
      .like("key", "superinvestor_13f_profile_v3_%");
    rowsByKey = new Map(
      (rows ?? []).map((r) => [
        r.key as string,
        { segment: r.segment as string, updated_at: r.updated_at as string | null, data: r.data },
      ]),
    );
  }

  for (const item of SUPERINVESTOR_REGISTRY) {
    const cik = cikPad10(SUPERINVESTOR_SLUG_CIK[item.slug] ?? "");
    const key = superinvestor13fProfileSnapshotKey(cik);
    const row = rowsByKey.get(key);
    const hasSnapshot = Boolean(row);
    if (!hasSnapshot) managersMissingSnapshots += 1;

    let holdingCount: number | null = null;
    let unresolved: number | null = null;
    let weightSum: number | null = null;
    let validationOk: boolean | null = null;
    let filingDate: string | null = ingestBySlug.get(item.slug)?.filingDate ?? null;

    if (row?.data && typeof row.data === "object") {
      const page = row.data as Superinvestor13fProfilePageData;
      if (page.comparison) {
        const v = validateSuperinvestorProfilePage(page);
        holdingCount = v.holdingCount;
        unresolved = v.unresolvedTickerCount;
        weightSum = v.weightSum;
        validationOk = v.ok;
        unresolvedTickers += v.unresolvedTickerCount;
        if (!v.ok) portfoliosFailingValidation += 1;
        filingDate = page.comparison.current.filingDate ?? filingDate;
        const acc = page.comparison.current.accessionNumber;
        if (acc && filingDate) {
          if (!newestFilingDate || filingDate > newestFilingDate) {
            newestFilingDate = filingDate;
            newestSECAccession = acc;
          }
        }
        const pageAcc = acc?.replace(/-/g, "") ?? "";
        if (hasSnapshot && pageAcc && row.segment === pageAcc) managersFresh += 1;
        else if (hasSnapshot && ingestBySlug.get(item.slug)?.persisted) managersFresh += 1;
      }
    } else {
      const cron = ingestBySlug.get(item.slug);
      if (cron && !cron.validationOk) portfoliosFailingValidation += 1;
      if (cron?.unresolvedTickers) unresolvedTickers += cron.unresolvedTickers;
    }

    managers.push({
      slug: item.slug,
      cik,
      hasSnapshot,
      segment: row?.segment ?? null,
      updatedAt: row?.updated_at ?? null,
      holdingCount,
      unresolvedTickers: unresolved,
      weightSum,
      validationOk,
      filingDate,
    });
  }

  let latestPortfolioAgeHours: number | null = null;
  if (newestFilingDate) {
    const ageMs = Date.now() - Date.parse(`${newestFilingDate}T00:00:00Z`);
    if (Number.isFinite(ageMs)) latestPortfolioAgeHours = Math.round((ageMs / 3_600_000) * 10) / 10;
  }

  return {
    managersTotal,
    managersFresh,
    managersMissingSnapshots,
    unresolvedTickers,
    portfoliosFailingValidation,
    lastSuccessfulIngest: lastIngest?.at ?? null,
    newestSECAccession,
    latestPortfolioAgeHours,
    averageProcessingTimeMs: lastIngest?.averageProcessingTimeMs ?? null,
    managers,
    generatedAt,
  };
}
