import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  isDirectEarningsPdfUrl,
  isSecEdgarExhibitHtmlUrl,
} from "@/lib/market/earnings-document-url";
import type { StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

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
      "ticker,fiscal_period_end,presentation_pdf_url,quarterly_report_pdf_url,quarterly_report_html_url,resolution_source,report_date,verified_at,updated_at",
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
      isDirectEarningsPdfUrl(hit.presentation_pdf_url) ? hit.presentation_pdf_url : row.secSlidesUrl;
    const filingsFromPdf = isDirectEarningsPdfUrl(hit.quarterly_report_pdf_url)
      ? hit.quarterly_report_pdf_url
      : null;
    const filingsFromHtml = isSecEdgarExhibitHtmlUrl(hit.quarterly_report_html_url)
      ? hit.quarterly_report_html_url
      : null;
    const filings = filingsFromPdf ?? filingsFromHtml ?? row.secFilingsUrl;

    if (slides === row.secSlidesUrl && filings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: slides, secFilingsUrl: filings };
  });
}

type EnrichmentStepSnapshot = {
  step: Exclude<EarningsDocumentResolutionSource, "cache" | "unknown">;
  rows: StockEarningsHistoryRow[];
};

function urlAt(rows: readonly StockEarningsHistoryRow[], idx: number): {
  slides: string | null;
  filings: string | null;
} {
  const row = rows[idx];
  return {
    slides: row?.secSlidesUrl ?? null,
    filings: row?.secFilingsUrl ?? null,
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
      isDirectEarningsPdfUrl(curr.slides) && curr.slides !== baseline.slides;
    const filingsNew =
      (isDirectEarningsPdfUrl(curr.filings) || isSecEdgarExhibitHtmlUrl(curr.filings)) &&
      curr.filings !== baseline.filings;
    if (slidesNew || filingsNew) return step;
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
    resolution_source: EarningsDocumentResolutionSource;
    report_date: string | null;
    verified_at: string;
    updated_at: string;
  }[] = [];

  for (let i = 0; i < finalHistory.length; i++) {
    const row = finalHistory[i]!;
    const fiscal = row.fiscalPeriodEndYmd;
    if (!fiscal) continue;

    const slides = isDirectEarningsPdfUrl(row.secSlidesUrl) ? row.secSlidesUrl : null;
    const filingsPdf = isDirectEarningsPdfUrl(row.secFilingsUrl) ? row.secFilingsUrl : null;
    const filingsHtml =
      !filingsPdf && isSecEdgarExhibitHtmlUrl(row.secFilingsUrl) ? row.secFilingsUrl : null;
    if (!slides && !filingsPdf && !filingsHtml) continue;

    const prior = priorCache.get(cacheKey(sym, fiscal));
    const priorSlides = prior?.presentation_pdf_url ?? null;
    const priorFilingsPdf = prior?.quarterly_report_pdf_url ?? null;
    const priorFilingsHtml = prior?.quarterly_report_html_url ?? null;
    if (
      slides === priorSlides &&
      filingsPdf === priorFilingsPdf &&
      filingsHtml === priorFilingsHtml
    ) {
      continue;
    }

    payload.push({
      ticker: sym,
      fiscal_period_end: fiscal,
      presentation_pdf_url: slides,
      quarterly_report_pdf_url: filingsPdf,
      quarterly_report_html_url: filingsHtml,
      resolution_source: inferResolutionSource(i, [...baselineAfterCache], steps),
      report_date: row.reportDateYmd,
      verified_at: now,
      updated_at: now,
    });
  }

  if (payload.length === 0) return;

  const { error } = await admin
    .from("earnings_document_cache")
    .upsert(payload, { onConflict: "ticker,fiscal_period_end" });

  if (error) {
    console.warn(`earnings_document_cache_upsert_failed: ${error.message}`);
  }
}

export async function upsertEarningsDocumentCache(
  admin: SupabaseClient,
  rows: readonly {
    ticker: string;
    fiscalPeriodEndYmd: string;
    presentationPdfUrl: string | null;
    quarterlyReportPdfUrl: string | null;
    quarterlyReportHtmlUrl?: string | null;
    resolutionSource: EarningsDocumentResolutionSource;
    reportDateYmd: string | null;
  }[],
): Promise<void> {
  if (rows.length === 0) return;
  const now = new Date().toISOString();
  const payload = rows
    .map((row) => {
      const slides = isDirectEarningsPdfUrl(row.presentationPdfUrl) ? row.presentationPdfUrl : null;
      const filingsPdf = isDirectEarningsPdfUrl(row.quarterlyReportPdfUrl)
        ? row.quarterlyReportPdfUrl
        : null;
      const filingsHtml =
        !filingsPdf && isSecEdgarExhibitHtmlUrl(row.quarterlyReportHtmlUrl)
          ? row.quarterlyReportHtmlUrl
          : null;
      if (!slides && !filingsPdf && !filingsHtml) return null;
      return {
        ticker: normalizeTicker(row.ticker),
        fiscal_period_end: row.fiscalPeriodEndYmd,
        presentation_pdf_url: slides,
        quarterly_report_pdf_url: filingsPdf,
        quarterly_report_html_url: filingsHtml,
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
