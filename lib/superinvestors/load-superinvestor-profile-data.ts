import "server-only";

import type { Superinvestor13fProfilePageData, Berkshire13fComparisonRow } from "@/lib/superinvestors/types";
import {
  paginateSuperinvestorHoldingsComparison,
  parseSuperinvestorHoldingsPage,
} from "@/lib/superinvestors/superinvestor-holdings-page";
import { clearSuperinvestor13fInMemoryCaches } from "@/lib/superinvestors/berkshire-13f";
import {
  deleteSuperinvestor13fSnapshotsForCik,
  hasSuperinvestor13fProfileSnapshot,
} from "@/lib/superinvestors/superinvestor-13f-holdings-transactions-snapshot";
import {
  clearSuperinvestor13fDevMemoCaches,
  filingHeadMatchesComparison,
} from "@/lib/superinvestors/superinvestor-13f-cache-utils";
import {
  cikPad10,
  getLatest13fFilingHeadCached,
} from "@/lib/superinvestors/superinvestor-13f-freshness";
import { SUPERINVESTOR_REGISTRY } from "@/lib/superinvestors/superinvestor-registry";
import { SUPERINVESTOR_SLUG_CIK } from "@/lib/superinvestors/superinvestor-slug-cik";
import { writeSuperinvestor13fHealthFromCron } from "@/lib/superinvestors/superinvestor-13f-health";
import { finalizeSuperinvestorProfileIngest } from "@/lib/superinvestors/superinvestor-13f-ingest";
import { validateSuperinvestorProfilePage } from "@/lib/superinvestors/superinvestor-13f-validate";

export type SuperinvestorProfilePageData = Superinvestor13fProfilePageData & {
  /** Full book rows for allocation donut (server-side top-N). */
  allocationRows: Berkshire13fComparisonRow[];
  holdingsPage: number;
  holdingsTotalPages: number;
};

export type Superinvestor13fRefreshResult = {
  slug: string;
  ok: boolean;
  persisted?: boolean;
  validationOk?: boolean;
  unresolvedTickers?: number;
  holdingCount?: number;
  ingestMs?: number;
  accession?: string | null;
  filingDate?: string | null;
  weightSum?: number;
  error?: string;
};

export type Superinvestor13fRefreshSummary = {
  at: string;
  durationMs: number;
  averageProcessingTimeMs: number;
  okCount: number;
  results: Superinvestor13fRefreshResult[];
};

function devMemoProfilePage<T>(slug: string, fn: () => Promise<T>): Promise<T> {
  if (process.env.NODE_ENV === "production") return fn();
  const g = globalThis as unknown as {
    __finsepaDevMemo?: Map<string, { exp: number; v: Promise<unknown> }>;
  };
  if (!g.__finsepaDevMemo) g.__finsepaDevMemo = new Map();
  const key = `13f:profile-page-v2:${slug}`;
  const now = Date.now();
  const ttlMs = 5 * 60 * 1000;
  const hit = g.__finsepaDevMemo.get(key);
  if (hit && hit.exp > now) return hit.v as Promise<T>;
  const v = fn();
  g.__finsepaDevMemo.set(key, { exp: now + ttlMs, v });
  void v.catch(() => {
    const cur = g.__finsepaDevMemo?.get(key);
    if (cur?.v === v) g.__finsepaDevMemo?.delete(key);
  });
  return v;
}

/**
 * Match the superinvestors list page: probe SEC for the latest 13F-HR and reload when
 * cached profile data is behind (Supabase snapshot / dev memo).
 */
async function loadProfilePageMatchingLatestFilingHead(
  load: () => Promise<Superinvestor13fProfilePageData>,
): Promise<Superinvestor13fProfilePageData> {
  let page = await load();
  const cikPadded = cikPad10(page.comparison.cik);
  if (!cikPadded) return page;

  /**
   * If SEC already failed (unavailable / fixture), don't wipe snapshots and re-hit EDGAR —
   * that doubles hang time and keeps the skeleton up.
   */
  if (page.comparison.source !== "edgar") return page;

  const head = await getLatest13fFilingHeadCached(cikPadded);
  if (filingHeadMatchesComparison(head, page.comparison)) return page;

  clearSuperinvestor13fDevMemoCaches();
  clearSuperinvestor13fInMemoryCaches();
  await deleteSuperinvestor13fSnapshotsForCik(cikPadded);

  page = await load();
  return page;
}

/**
 * One SEC snapshot pass per profile (comparison + transactions share filings via `getInstitutional13fSnapshots`).
 * Cached by latest 13F accession — repeat visits only probe SEC submissions JSON (~1 req/hr per filer).
 * Berkshire also persists the full page + holdings-scoped tx history in `market_snapshot` (incremental on new 13F).
 */
export async function loadSuperinvestorProfilePageData(
  slug: string,
  opts?: { holdingsPage?: number },
): Promise<SuperinvestorProfilePageData | null> {
  const item = SUPERINVESTOR_REGISTRY.find((entry) => entry.slug === slug);
  if (!item) return null;

  const holdingsPage = parseSuperinvestorHoldingsPage(
    opts?.holdingsPage != null ? String(opts.holdingsPage) : "1",
  );

  return devMemoProfilePage(`${slug}:p${holdingsPage}`, async () => {
    const page = await loadProfilePageMatchingLatestFilingHead(() => item.loadProfilePage());
    const paginated = paginateSuperinvestorHoldingsComparison(page.comparison, holdingsPage);
    return {
      comparison: paginated.comparison,
      transactions: page.transactions,
      allocationRows: paginated.allocationRows,
      holdingsPage: paginated.page,
      holdingsTotalPages: paginated.totalPages,
    };
  });
}

/** Bust dev memo + Supabase 13F snapshots, then reload from SEC (new filing detection). */
export async function forceRefreshSuperinvestorProfilePage(
  slug: string,
): Promise<SuperinvestorProfilePageData | null> {
  const item = SUPERINVESTOR_REGISTRY.find((entry) => entry.slug === slug);
  if (!item) return null;

  clearSuperinvestor13fDevMemoCaches();
  clearSuperinvestor13fInMemoryCaches();

  const cikPadded = cikPad10((await item.loadProfilePage()).comparison.cik);
  if (cikPadded) await deleteSuperinvestor13fSnapshotsForCik(cikPadded);

  clearSuperinvestor13fDevMemoCaches();
  clearSuperinvestor13fInMemoryCaches();

  return loadSuperinvestorProfilePageData(slug);
}

/**
 * Cron: ensure every manager has a durable snapshot; re-enrich unresolved tickers;
 * validate; write health blob. Soft-loads when snapshot exists (head probe still catches new filings).
 */
export async function refreshAllSuperinvestor13fPortfolios(): Promise<Superinvestor13fRefreshSummary> {
  const started = Date.now();
  const results: Superinvestor13fRefreshResult[] = [];

  for (const item of SUPERINVESTOR_REGISTRY) {
    const slugStarted = Date.now();
    try {
      const cikHint = cikPad10(SUPERINVESTOR_SLUG_CIK[item.slug] ?? "");
      const hasSnap = cikHint ? await hasSuperinvestor13fProfileSnapshot(cikHint) : false;

      let page: Superinvestor13fProfilePageData | null = null;
      if (!hasSnap) {
        // Force SEC reload; createSuperinvestorProfilePageLoader awaits finalize+upsert.
        page = await forceRefreshSuperinvestorProfilePage(item.slug);
      } else {
        page = await loadSuperinvestorProfilePageData(item.slug);
      }

      if (!page) {
        results.push({
          slug: item.slug,
          ok: false,
          ingestMs: Date.now() - slugStarted,
          filingDate: null,
          accession: null,
          error: "unknown_slug",
        });
        continue;
      }

      const snapAfterLoad = cikHint ? await hasSuperinvestor13fProfileSnapshot(cikHint) : false;
      const unresolvedBefore = page.comparison.rows.filter((r) => !r.ticker?.trim()).length;
      // Re-enrich existing snapshots with unresolved tickers (no full SEC wipe).
      const needsEnrichPersist =
        page.comparison.source === "edgar" && unresolvedBefore > 0 && snapAfterLoad;

      let persisted = snapAfterLoad;
      let validation = validateSuperinvestorProfilePage(page);
      let unresolved = validation.unresolvedTickerCount;

      if (needsEnrichPersist) {
        const finalized = await finalizeSuperinvestorProfileIngest(page);
        page = finalized.page;
        validation = finalized.validation;
        unresolved = finalized.enrich.afterUnresolved;
        persisted = finalized.persisted;
      } else if (!snapAfterLoad && page.comparison.source === "edgar") {
        // Loader finalize may have skipped on validation failure — retry once for metrics.
        const finalized = await finalizeSuperinvestorProfileIngest(page);
        page = finalized.page;
        validation = finalized.validation;
        unresolved = finalized.enrich.afterUnresolved;
        persisted = finalized.persisted;
      }

      results.push({
        slug: item.slug,
        ok: validation.ok && (persisted || page.comparison.source !== "edgar"),
        persisted,
        validationOk: validation.ok,
        unresolvedTickers: unresolved,
        holdingCount: validation.holdingCount,
        ingestMs: Date.now() - slugStarted,
        accession: page.comparison.current.accessionNumber,
        filingDate: page.comparison.current.filingDate,
        weightSum: validation.weightSum,
        error: validation.ok
          ? persisted || page.comparison.source !== "edgar"
            ? undefined
            : "snapshot_not_persisted"
          : validation.errors.join(";"),
      });
    } catch (e) {
      results.push({
        slug: item.slug,
        ok: false,
        ingestMs: Date.now() - slugStarted,
        filingDate: null,
        accession: null,
        error: e instanceof Error ? e.message : "load_failed",
      });
    }
  }

  const okTimes = results.filter((r) => r.ok && r.ingestMs != null).map((r) => r.ingestMs!);
  const averageProcessingTimeMs =
    okTimes.length > 0 ? Math.round(okTimes.reduce((a, b) => a + b, 0) / okTimes.length) : 0;
  const at = new Date().toISOString();

  await writeSuperinvestor13fHealthFromCron({
    at,
    averageProcessingTimeMs,
    results,
  });

  return {
    at,
    durationMs: Date.now() - started,
    averageProcessingTimeMs,
    okCount: results.filter((r) => r.ok).length,
    results,
  };
}
