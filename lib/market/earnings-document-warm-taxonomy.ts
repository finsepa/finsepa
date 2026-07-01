import {
  isEarningsFilingsPreviewUrl,
  isEarningsSlidesPreviewUrl,
} from "@/lib/market/earnings-document-url";
import type { StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

export type EarningsDocumentWarmFailureClass =
  | "ok"
  | "no_payload"
  | "no_reported_history"
  | "missing_all"
  | "missing_slides_all"
  | "missing_slides_partial"
  | "missing_filings_all"
  | "missing_filings_partial"
  | "missing_both_partial"
  | "error";

export type EarningsDocumentWarmTickerResult = {
  ticker: string;
  failureClass: EarningsDocumentWarmFailureClass;
  reportedRows: number;
  recentReportedRows: number;
  withSlides: number;
  withFilings: number;
  missingSlides: number;
  missingFilings: number;
  slideFormats: Record<string, number>;
};

const RECENT_REPORTED_QUARTERS = 8;

function slideFormatBucket(url: string | null): string {
  if (!url) return "none";
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host.includes("sec.gov")) return "sec-html";
    if (/\/static-files\//i.test(u.pathname)) return "static-files";
    if (host.includes("q4cdn.com")) return "q4cdn";
    if (host.includes("cloudfront.net") && /\/presentation\//i.test(u.pathname)) return "cloudfront";
    if (host.includes("microsoft.com")) return "pptx";
    if (/\.pdf/i.test(u.pathname)) return "pdf";
    return "other";
  } catch {
    return "other";
  }
}

export function classifyEarningsDocumentWarmResult(
  ticker: string,
  history: readonly StockEarningsHistoryRow[] | null | undefined,
): EarningsDocumentWarmTickerResult {
  if (!history) {
    return {
      ticker,
      failureClass: "no_payload",
      reportedRows: 0,
      recentReportedRows: 0,
      withSlides: 0,
      withFilings: 0,
      missingSlides: 0,
      missingFilings: 0,
      slideFormats: {},
    };
  }

  const reported = history.filter((r) => r.reported);
  const recent = reported
    .slice()
    .sort((a, b) => (b.reportDateYmd ?? "").localeCompare(a.reportDateYmd ?? ""))
    .slice(0, RECENT_REPORTED_QUARTERS);

  if (reported.length === 0) {
    return {
      ticker,
      failureClass: "no_reported_history",
      reportedRows: 0,
      recentReportedRows: 0,
      withSlides: 0,
      withFilings: 0,
      missingSlides: 0,
      missingFilings: 0,
      slideFormats: {},
    };
  }

  const withSlides = recent.filter((r) => isEarningsSlidesPreviewUrl(r.secSlidesUrl)).length;
  const withFilings = recent.filter((r) => isEarningsFilingsPreviewUrl(r.secFilingsUrl)).length;
  const missingSlides = recent.length - withSlides;
  const missingFilings = recent.length - withFilings;

  const slideFormats: Record<string, number> = {};
  for (const row of recent) {
    const bucket = slideFormatBucket(row.secSlidesUrl);
    slideFormats[bucket] = (slideFormats[bucket] ?? 0) + 1;
  }

  let failureClass: EarningsDocumentWarmFailureClass = "ok";
  if (withSlides === 0 && withFilings === 0) {
    failureClass = "missing_all";
  } else if (missingSlides === recent.length) {
    failureClass = "missing_slides_all";
  } else if (missingFilings === recent.length) {
    failureClass = "missing_filings_all";
  } else if (missingSlides > 0 && missingFilings > 0) {
    failureClass = "missing_both_partial";
  } else if (missingSlides > 0) {
    failureClass = "missing_slides_partial";
  } else if (missingFilings > 0) {
    failureClass = "missing_filings_partial";
  }

  return {
    ticker,
    failureClass,
    reportedRows: reported.length,
    recentReportedRows: recent.length,
    withSlides,
    withFilings,
    missingSlides,
    missingFilings,
    slideFormats,
  };
}

export function aggregateWarmFailureTaxonomy(
  results: readonly EarningsDocumentWarmTickerResult[],
): Record<EarningsDocumentWarmFailureClass, number> {
  const out: Record<EarningsDocumentWarmFailureClass, number> = {
    ok: 0,
    no_payload: 0,
    no_reported_history: 0,
    missing_all: 0,
    missing_slides_all: 0,
    missing_slides_partial: 0,
    missing_filings_all: 0,
    missing_filings_partial: 0,
    missing_both_partial: 0,
    error: 0,
  };
  for (const r of results) out[r.failureClass] += 1;
  return out;
}
