/**
 * Finalize a Superinvestor profile page after SEC parse:
 * enrich tickers → validate → await durable market_snapshot upsert.
 */

import "server-only";

import { cikPad10, thirteenFilingHeadCacheKey } from "@/lib/superinvestors/superinvestor-13f-freshness";
import {
  upsertSuperinvestor13fProfileSnapshot,
  type SuperinvestorSnapshotUpsertResult,
} from "@/lib/superinvestors/superinvestor-13f-holdings-transactions-snapshot";
import { enrichSuperinvestorProfileTickers } from "@/lib/superinvestors/superinvestor-13f-ticker-enrich";
import {
  validateSuperinvestorProfilePage,
  type Superinvestor13fValidationResult,
} from "@/lib/superinvestors/superinvestor-13f-validate";
import type { Superinvestor13fProfilePageData } from "@/lib/superinvestors/types";
import type { SuperinvestorTickerEnrichStats } from "@/lib/superinvestors/superinvestor-13f-ticker-enrich";
import { getLatest13fFilingHeadCached } from "@/lib/superinvestors/superinvestor-13f-freshness";

export type Superinvestor13fIngestResult = {
  page: Superinvestor13fProfilePageData;
  validation: Superinvestor13fValidationResult;
  enrich: SuperinvestorTickerEnrichStats;
  snapshot: SuperinvestorSnapshotUpsertResult | null;
  persisted: boolean;
  ingestMs: number;
  accession: string | null;
};

function accessionFromPage(page: Superinvestor13fProfilePageData): string | null {
  const acc = page.comparison.current.accessionNumber?.trim();
  return acc || null;
}

/**
 * Enrich + validate + persist. Returns page for SSR even when validation fails
 * (so UI can still render), but skips snapshot write on validation failure.
 */
export async function finalizeSuperinvestorProfileIngest(
  pageIn: Superinvestor13fProfilePageData,
  opts?: { skipEnrich?: boolean },
): Promise<Superinvestor13fIngestResult> {
  const started = Date.now();
  let page = pageIn;
  let enrich: SuperinvestorTickerEnrichStats = {
    beforeUnresolved: page.comparison.rows.filter((r) => !r.ticker?.trim()).length,
    afterUnresolved: page.comparison.rows.filter((r) => !r.ticker?.trim()).length,
    resolvedStaticOrMap: 0,
    resolvedOpenFigi: 0,
    resolvedEodhd: 0,
    holdingCount: page.comparison.rows.length,
    resolutionRate:
      page.comparison.rows.length > 0
        ? page.comparison.rows.filter((r) => r.ticker?.trim()).length / page.comparison.rows.length
        : 1,
  };

  if (!opts?.skipEnrich && page.comparison.source === "edgar") {
    const enriched = await enrichSuperinvestorProfileTickers(page);
    page = enriched.page;
    enrich = enriched.stats;
  }

  const validation = validateSuperinvestorProfilePage(page);
  const accession = accessionFromPage(page);
  const cik = cikPad10(page.comparison.cik);

  let snapshot: SuperinvestorSnapshotUpsertResult | null = null;
  let persisted = false;

  if (validation.ok && accession && cik) {
    const head = await getLatest13fFilingHeadCached(cik);
    const accKey = thirteenFilingHeadCacheKey(head);
    // Prefer live head accession; fall back to page accession digits.
    const segment = accKey !== "none" ? accKey : accession.replace(/-/g, "");
    snapshot = await upsertSuperinvestor13fProfileSnapshot(cik, segment, page);
    persisted = snapshot.ok;
    if (!snapshot.ok) {
      console.error("[superinvestor-13f-ingest] snapshot upsert failed", {
        cik,
        segment,
        error: snapshot.error,
        bytes: snapshot.bytes,
      });
    }
  } else if (!validation.ok) {
    console.error("[superinvestor-13f-ingest] validation failed — snapshot not written", {
      cik: page.comparison.cik,
      errors: validation.errors,
    });
  }

  return {
    page,
    validation,
    enrich,
    snapshot,
    persisted,
    ingestMs: Date.now() - started,
    accession,
  };
}
