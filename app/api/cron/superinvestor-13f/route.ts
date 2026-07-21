import { NextResponse } from "next/server";

import { pickProcessEnv } from "@/lib/env/pick-process-env";
import {
  forceRefreshSuperinvestorProfilePage,
  loadSuperinvestorProfilePageData,
  refreshAllSuperinvestor13fPortfolios,
} from "@/lib/superinvestors/load-superinvestor-profile-data";
import { SUPERINVESTOR_SLUG_CIK } from "@/lib/superinvestors/superinvestor-slug-cik";
import { finalizeSuperinvestorProfileIngest } from "@/lib/superinvestors/superinvestor-13f-ingest";
import { validateSuperinvestorProfilePage } from "@/lib/superinvestors/superinvestor-13f-validate";
import { hasSuperinvestor13fProfileSnapshot } from "@/lib/superinvestors/superinvestor-13f-holdings-transactions-snapshot";
import { cikPad10 } from "@/lib/superinvestors/superinvestor-13f-freshness";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorizeCron(request: Request): boolean {
  const secret = pickProcessEnv("CRON_SECRET");
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

async function refreshOneSlug(slug: string, enrichOnly: boolean) {
  const started = Date.now();
  const page = enrichOnly
    ? await loadSuperinvestorProfilePageData(slug)
    : await forceRefreshSuperinvestorProfilePage(slug);
  if (!page) {
    return {
      slug,
      ok: false,
      ingestMs: Date.now() - started,
      error: "unknown_slug",
    };
  }

  let validation = validateSuperinvestorProfilePage(page);
  let unresolved = validation.unresolvedTickerCount;
  let persisted = false;
  const cik = cikPad10(page.comparison.cik);
  if (cik) persisted = await hasSuperinvestor13fProfileSnapshot(cik);

  if (page.comparison.source === "edgar" && (enrichOnly || unresolved > 0 || !persisted)) {
    const finalized = await finalizeSuperinvestorProfileIngest(page);
    validation = finalized.validation;
    unresolved = finalized.enrich.afterUnresolved;
    persisted = finalized.persisted;
  }

  return {
    slug,
    ok: validation.ok && (persisted || page.comparison.source !== "edgar"),
    persisted,
    validationOk: validation.ok,
    unresolvedTickers: unresolved,
    holdingCount: validation.holdingCount,
    ingestMs: Date.now() - started,
    accession: page.comparison.current.accessionNumber,
    filingDate: page.comparison.current.filingDate,
    weightSum: validation.weightSum,
    enrichOnly,
    error: validation.ok
      ? persisted || page.comparison.source !== "edgar"
        ? undefined
        : "snapshot_not_persisted"
      : validation.errors.join(";"),
  };
}

/**
 * Probes SEC for new 13F-HR accessions, ensures durable snapshots, enriches tickers,
 * validates portfolios, and writes health metrics.
 *
 * Optional query params:
 * - `slug=ken-fisher` — single manager
 * - `enrichOnly=1` — skip SEC wipe; re-enrich + persist existing page (large books)
 */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug")?.trim();
    const enrichOnly = url.searchParams.get("enrichOnly") === "1";

    if (slug) {
      if (!SUPERINVESTOR_SLUG_CIK[slug]) {
        return NextResponse.json({ error: "unknown_slug", slug }, { status: 404 });
      }
      const one = await refreshOneSlug(slug, enrichOnly);
      return NextResponse.json({
        at: new Date().toISOString(),
        mode: enrichOnly ? "enrich" : "single",
        okCount: one.ok ? 1 : 0,
        results: [one],
      });
    }

    const { at, durationMs, averageProcessingTimeMs, okCount, results } =
      await refreshAllSuperinvestor13fPortfolios();
    return NextResponse.json({
      at,
      durationMs,
      averageProcessingTimeMs,
      okCount,
      results,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "refresh_failed";
    console.error("[cron/superinvestor-13f]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
