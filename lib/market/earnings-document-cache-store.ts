import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { recordSlideHostPatternsFromUrls } from "@/lib/market/earnings-slide-pattern-store";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  isDirectEarningsPdfUrl,
  isEarningsFilingsPreviewUrl,
  isEarningsSlidesPreviewUrl,
  isSecEdgarExhibitHtmlUrl,
} from "@/lib/market/earnings-document-url";
import type { StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";
import { detectNewlyAvailableEarningsDocs, type EarningsDocsAvailabilityEvent } from "@/lib/notifications/earnings-docs-notify-model";
import { scheduleNotifyEarningsDocsAvailable } from "@/lib/notifications/earnings-docs-notify";

export type EarningsDocumentResolutionSource =
  | "cache"
  | "sec"
  | "curated"
  | "ir_seed"
  | "generic_q4"
  | "unknown";

export type EarningsDocumentCacheRow = {
  ticker: string;
  fiscal_period_end: string;
  presentation_pdf_url: string | null;
  quarterly_report_pdf_url: string | null;
  quarterly_report_html_url: string | null;
  eight_k_url: string | null;
  form10_url: string | null;
  form10_kind: "10-Q" | "10-K" | null;
  resolution_source: EarningsDocumentResolutionSource;
  report_date: string | null;
  verified_at: string;
  updated_at: string;
};

export function earningsDocumentCacheReadEnabled(): boolean {
  return process.env.FINSEPA_EARNINGS_DOC_CACHE_READ !== "0";
}

export function earningsDocumentCacheWriteEnabled(): boolean {
  return process.env.FINSEPA_EARNINGS_DOC_CACHE_WRITE !== "0";
}

function cacheKey(ticker: string, fiscalPeriodEndYmd: string): string {
  return `${ticker.trim().toUpperCase()}|${fiscalPeriodEndYmd}`;
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

export async function loadEarningsDocumentCacheForHistory(
  ticker: string,
  history: readonly StockEarningsHistoryRow[],
): Promise<Map<string, EarningsDocumentCacheRow>> {
  const out = new Map<string, EarningsDocumentCacheRow>();
  if (!earningsDocumentCacheReadEnabled()) return out;

  const admin = getSupabaseAdminClient();
  if (!admin) return out;

  const sym = normalizeTicker(ticker);
  const fiscalEnds = [
    ...new Set(
      history
        .map((r) => r.fiscalPeriodEndYmd)
        .filter((f): f is string => typeof f === "string" && f.length > 0),
    ),
  ];
  if (fiscalEnds.length === 0) return out;

  const { data, error } = await admin
    .from("earnings_document_cache")
    .select(
      "ticker,fiscal_period_end,presentation_pdf_url,quarterly_report_pdf_url,quarterly_report_html_url,eight_k_url,form10_url,form10_kind,resolution_source,report_date,verified_at,updated_at",
    )
    .eq("ticker", sym)
    .in("fiscal_period_end", fiscalEnds);

  if (error) {
    console.warn(`earnings_document_cache_load_failed: ${error.message}`);
    return out;
  }

  for (const row of data ?? []) {
    const t = typeof row.ticker === "string" ? row.ticker : "";
    const fiscal = typeof row.fiscal_period_end === "string" ? row.fiscal_period_end : "";
    if (!t || !fiscal) continue;
    out.set(cacheKey(t, fiscal), row as EarningsDocumentCacheRow);
  }
  return out;
}

/** Pre-fill history rows from Supabase before SEC / IR resolution. */
export function applyEarningsDocumentCacheToHistory(
  ticker: string,
  history: StockEarningsHistoryRow[],
  cache: ReadonlyMap<string, EarningsDocumentCacheRow>,
): StockEarningsHistoryRow[] {
  if (cache.size === 0) return history;

  const sym = normalizeTicker(ticker);
  return history.map((row) => {
    const fiscal = row.fiscalPeriodEndYmd;
    if (!fiscal) return row;

    const hit = cache.get(cacheKey(sym, fiscal));
    if (!hit) return row;

    const slides =
      isEarningsSlidesPreviewUrl(hit.presentation_pdf_url) ? hit.presentation_pdf_url : row.secSlidesUrl;
    const filingsFromPdf = isDirectEarningsPdfUrl(hit.quarterly_report_pdf_url)
      ? hit.quarterly_report_pdf_url
      : null;
    const filingsFromHtml = isEarningsFilingsPreviewUrl(hit.quarterly_report_html_url)
      ? hit.quarterly_report_html_url
      : null;
    const filings = filingsFromPdf ?? filingsFromHtml ?? row.secFilingsUrl;
    const eightK = isEarningsFilingsPreviewUrl(hit.eight_k_url) ? hit.eight_k_url : row.eightKUrl;
    const form10 = isEarningsFilingsPreviewUrl(hit.form10_url) ? hit.form10_url : row.form10Url;
    const form10Kind =
      hit.form10_kind === "10-Q" || hit.form10_kind === "10-K" ? hit.form10_kind : row.form10Kind;

    if (
      slides === row.secSlidesUrl &&
      filings === row.secFilingsUrl &&
      eightK === row.eightKUrl &&
      form10 === row.form10Url &&
      form10Kind === row.form10Kind
    ) {
      return row;
    }
    return { ...row, secSlidesUrl: slides, secFilingsUrl: filings, eightKUrl: eightK, form10Url: form10, form10Kind };
  });
}

type EnrichmentStepSnapshot = {
  step: Exclude<EarningsDocumentResolutionSource, "cache" | "unknown">;
  rows: StockEarningsHistoryRow[];
};

function urlAt(rows: readonly StockEarningsHistoryRow[], idx: number): {
  slides: string | null;
  filings: string | null;
  eightK: string | null;
  form10: string | null;
} {
  const row = rows[idx];
  return {
    slides: row?.secSlidesUrl ?? null,
    filings: row?.secFilingsUrl ?? null,
    eightK: row?.eightKUrl ?? null,
    form10: row?.form10Url ?? null,
  };
}

function inferResolutionSource(
  idx: number,
  beforeCache: StockEarningsHistoryRow[],
  steps: readonly EnrichmentStepSnapshot[],
): EarningsDocumentResolutionSource {
  const baseline = urlAt(beforeCache, idx);
  for (const { step, rows } of steps) {
    const curr = urlAt(rows, idx);
    const slidesNew =
      isEarningsSlidesPreviewUrl(curr.slides) && curr.slides !== baseline.slides;
    const filingsNew =
      (isDirectEarningsPdfUrl(curr.filings) || isSecEdgarExhibitHtmlUrl(curr.filings)) &&
      curr.filings !== baseline.filings;
    const reportsNew =
      (isEarningsFilingsPreviewUrl(curr.eightK) && curr.eightK !== baseline.eightK) ||
      (isEarningsFilingsPreviewUrl(curr.form10) && curr.form10 !== baseline.form10);
    if (slidesNew || filingsNew || reportsNew) return step;
  }
  return "unknown";
}

/** Persist newly resolved direct PDF URLs after the enrichment pipeline. */
export async function persistResolvedEarningsDocuments(
  ticker: string,
  finalHistory: readonly StockEarningsHistoryRow[],
  baselineAfterCache: readonly StockEarningsHistoryRow[],
  priorCache: ReadonlyMap<string, EarningsDocumentCacheRow>,
  steps: readonly EnrichmentStepSnapshot[],
  options?: { replaceSecReports?: boolean },
): Promise<void> {
  if (!earningsDocumentCacheWriteEnabled()) return;

  const admin = getSupabaseAdminClient();
  if (!admin) return;

  const sym = normalizeTicker(ticker);
  const now = new Date().toISOString();
  const payload: {
    ticker: string;
    fiscal_period_end: string;
    presentation_pdf_url: string | null;
    quarterly_report_pdf_url: string | null;
    quarterly_report_html_url: string | null;
    eight_k_url: string | null;
    form10_url: string | null;
    form10_kind: "10-Q" | "10-K" | null;
    resolution_source: EarningsDocumentResolutionSource;
    report_date: string | null;
    verified_at: string;
    updated_at: string;
  }[] = [];
  const docsNotifyEvents: EarningsDocsAvailabilityEvent[] = [];

  for (let i = 0; i < finalHistory.length; i++) {
    const row = finalHistory[i]!;
    const fiscal = row.fiscalPeriodEndYmd;
    if (!fiscal) continue;

    const slides = isEarningsSlidesPreviewUrl(row.secSlidesUrl) ? row.secSlidesUrl : null;
    const filingsPdf = isDirectEarningsPdfUrl(row.secFilingsUrl) ? row.secFilingsUrl : null;
    const filingsHtml =
      !filingsPdf && isSecEdgarExhibitHtmlUrl(row.secFilingsUrl) ? row.secFilingsUrl : null;
    const eightK = isEarningsFilingsPreviewUrl(row.eightKUrl) ? row.eightKUrl : null;
    const form10 = isEarningsFilingsPreviewUrl(row.form10Url) ? row.form10Url : null;
    const form10Kind = form10 && (row.form10Kind === "10-Q" || row.form10Kind === "10-K") ? row.form10Kind : null;

    const prior = priorCache.get(cacheKey(sym, fiscal));
    const replaceSecReports = Boolean(options?.replaceSecReports);
    const nextSlides = slides ?? prior?.presentation_pdf_url ?? null;
    const nextFilingsPdf = filingsPdf ?? prior?.quarterly_report_pdf_url ?? null;
    const nextFilingsHtml = filingsHtml ?? prior?.quarterly_report_html_url ?? null;
    const nextEightK = replaceSecReports ? eightK : (eightK ?? prior?.eight_k_url ?? null);
    const nextForm10 = replaceSecReports ? form10 : (form10 ?? prior?.form10_url ?? null);
    const nextForm10Kind = replaceSecReports ? form10Kind : (form10Kind ?? prior?.form10_kind ?? null);

    docsNotifyEvents.push(
      ...detectNewlyAvailableEarningsDocs({
        ticker: sym,
        fiscalPeriodEndYmd: fiscal,
        reportDateYmd: row.reportDateYmd ?? prior?.report_date ?? null,
        priorSlides: prior?.presentation_pdf_url ?? null,
        nextSlides,
        priorEightK: prior?.eight_k_url ?? null,
        nextEightK,
        priorForm10: prior?.form10_url ?? null,
        nextForm10,
      }),
    );

    if (!nextSlides && !nextFilingsPdf && !nextFilingsHtml && !nextEightK && !nextForm10) continue;

    if (
      nextSlides === (prior?.presentation_pdf_url ?? null) &&
      nextFilingsPdf === (prior?.quarterly_report_pdf_url ?? null) &&
      nextFilingsHtml === (prior?.quarterly_report_html_url ?? null) &&
      nextEightK === (prior?.eight_k_url ?? null) &&
      nextForm10 === (prior?.form10_url ?? null) &&
      nextForm10Kind === (prior?.form10_kind ?? null)
    ) {
      continue;
    }

    payload.push({
      ticker: sym,
      fiscal_period_end: fiscal,
      presentation_pdf_url: nextSlides,
      quarterly_report_pdf_url: nextFilingsPdf,
      quarterly_report_html_url: nextFilingsHtml,
      eight_k_url: nextEightK,
      form10_url: nextForm10,
      form10_kind: nextForm10Kind,
      resolution_source: inferResolutionSource(i, [...baselineAfterCache], steps),
      report_date: row.reportDateYmd,
      verified_at: now,
      updated_at: now,
    });
  }

  if (payload.length === 0) {
    scheduleNotifyEarningsDocsAvailable(docsNotifyEvents);
    return;
  }

  const { error } = await admin
    .from("earnings_document_cache")
    .upsert(payload, { onConflict: "ticker,fiscal_period_end" });

  if (error) {
    console.warn(`earnings_document_cache_upsert_failed: ${error.message}`);
    return;
  }

  await recordSlideHostPatternsFromUrls(
    sym,
    finalHistory.map((r) => r.secSlidesUrl),
  );

  scheduleNotifyEarningsDocsAvailable(docsNotifyEvents);
}

export async function upsertEarningsDocumentCache(
  admin: SupabaseClient,
  rows: readonly {
    ticker: string;
    fiscalPeriodEndYmd: string;
    presentationPdfUrl: string | null;
    quarterlyReportPdfUrl: string | null;
    quarterlyReportHtmlUrl?: string | null;
    eightKUrl?: string | null;
    form10Url?: string | null;
    form10Kind?: "10-Q" | "10-K" | null;
    resolutionSource: EarningsDocumentResolutionSource;
    reportDateYmd: string | null;
  }[],
): Promise<void> {
  if (rows.length === 0) return;
  const now = new Date().toISOString();
  const payload = rows
    .map((row) => {
      const slides = isEarningsSlidesPreviewUrl(row.presentationPdfUrl) ? row.presentationPdfUrl : null;
      const filingsPdf = isDirectEarningsPdfUrl(row.quarterlyReportPdfUrl)
        ? row.quarterlyReportPdfUrl
        : null;
      const filingsHtml =
        !filingsPdf && isSecEdgarExhibitHtmlUrl(row.quarterlyReportHtmlUrl)
          ? row.quarterlyReportHtmlUrl
          : null;
      const eightK = isEarningsFilingsPreviewUrl(row.eightKUrl) ? row.eightKUrl : null;
      const form10 = isEarningsFilingsPreviewUrl(row.form10Url) ? row.form10Url : null;
      const form10Kind = form10 && (row.form10Kind === "10-Q" || row.form10Kind === "10-K") ? row.form10Kind : null;
      if (!slides && !filingsPdf && !filingsHtml && !eightK && !form10) return null;
      return {
        ticker: normalizeTicker(row.ticker),
        fiscal_period_end: row.fiscalPeriodEndYmd,
        presentation_pdf_url: slides,
        quarterly_report_pdf_url: filingsPdf,
        quarterly_report_html_url: filingsHtml,
        eight_k_url: eightK,
        form10_url: form10,
        form10_kind: form10Kind,
        resolution_source: row.resolutionSource,
        report_date: row.reportDateYmd,
        verified_at: now,
        updated_at: now,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r != null);

  if (payload.length === 0) return;

  const { error } = await admin
    .from("earnings_document_cache")
    .upsert(payload, { onConflict: "ticker,fiscal_period_end" });
  if (error) throw new Error(`earnings_document_cache_upsert_failed: ${error.message}`);
}

/**
 * Tickers that already have some document cache rows but are missing slides on ≥1 quarter.
 * Cheap Supabase aggregate — no EODHD. Used to prioritize warm backfill at small DAU scale.
 */
export async function listTickersWithPartialSlidesGaps(
  universe: readonly string[],
  limit = 8,
): Promise<string[]> {
  if (universe.length === 0 || limit <= 0) return [];
  const admin = getSupabaseAdminClient();
  if (!admin) return [];

  const allowed = new Set(universe.map((t) => t.trim().toUpperCase()).filter(Boolean));
  const { data, error } = await admin
    .from("earnings_document_cache")
    .select("ticker,presentation_pdf_url")
    .in("ticker", [...allowed]);

  if (error) {
    console.warn(`earnings_document_cache_gap_scan_failed: ${error.message}`);
    return [];
  }

  const stats = new Map<string, { total: number; withSlides: number }>();
  for (const row of data ?? []) {
    const t = typeof row.ticker === "string" ? row.ticker.trim().toUpperCase() : "";
    if (!t || !allowed.has(t)) continue;
    const cur = stats.get(t) ?? { total: 0, withSlides: 0 };
    cur.total += 1;
    if (typeof row.presentation_pdf_url === "string" && row.presentation_pdf_url.length > 0) {
      cur.withSlides += 1;
    }
    stats.set(t, cur);
  }

  return [...stats.entries()]
    .filter(([, s]) => s.total >= 2 && s.withSlides < s.total)
    .sort((a, b) => {
      const missA = a[1].total - a[1].withSlides;
      const missB = b[1].total - b[1].withSlides;
      return missB - missA;
    })
    .slice(0, limit)
    .map(([ticker]) => ticker);
}
