/** GE Vernova IR: earnings webcast presentation as slides, press PDF as filings. Never transcript / 10-Q / infographic / Investor Update. */

export type GevQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const FILES = "https://www.gevernova.com/sites/default/files";

function pdf(file: string): string {
  return `${FILES}/${file}`;
}

export const GEV_IR_PAGES = ["https://www.gevernova.com/investors"] as const;

/**
 * Calendar FY. Standalone IR from Q1 2024 (spin ~Apr 2 2024). Pre-spin quarters stay empty.
 * Filenames are report dates (`MMDDYYYY`), not period-end. Never lock `12092025` Investor Update.
 */
export const GEV_KNOWN_QUARTER_DOCS: Readonly<Record<string, GevQuarterDocs>> = {
  "Q2 2026": {
    slides: pdf("gev_webcast_presentation_07222026.pdf"),
    filings: pdf("gev_webcast_pressrelease_07222026.pdf"),
  },
  "Q1 2026": {
    slides: pdf("gev_webcast_presentation_04222026.pdf"),
    filings: pdf("gev_webcast_pressrelease_04222026.pdf"),
  },
  "Q4 2025": {
    slides: pdf("gev_webcast_presentation_01282026.pdf"),
    filings: pdf("gev_webcast_pressrelease_01282026.pdf"),
  },
  "Q3 2025": {
    slides: pdf("gev_webcast_presentation_10222025.pdf"),
    filings: pdf("gev_webcast_pressrelease_10222025.pdf"),
  },
  "Q2 2025": {
    slides: pdf("gev_webcast_presentation_07232025.pdf"),
    filings: pdf("gev_webcast_pressrelease_07232025.pdf"),
  },
  "Q1 2025": {
    slides: pdf("gev_webcast_presentation_04232025.pdf"),
    filings: pdf("gev_webcast_pressrelease_04232025.pdf"),
  },
  "Q4 2024": {
    slides: pdf("gev_webcast_presentation_01222025.pdf"),
    filings: pdf("gev_webcast_pressrelease_01222025.pdf"),
  },
  "Q3 2024": {
    slides: pdf("gev_webcast_presentation_10232024.pdf"),
    filings: pdf("gev_webcast_pressrelease_10232024.pdf"),
  },
  "Q2 2024": {
    slides: pdf("gev_webcast_presentation_07242024.pdf"),
    filings: pdf("gev_webcast_pressrelease_07242024.pdf"),
  },
  "Q1 2024": {
    slides: pdf("gev_webcast_presentation_04252024.pdf"),
    filings: pdf("gev_webcast_pressrelease_04252024.pdf"),
  },
};

export function isGevRejected(href: string): boolean {
  const n = decodeURIComponent(href).toLowerCase();
  return /sec\.gov|webcast_transcript|webcast_highlights|webcast_10q|webcast_mp3|transcript|infographic|investor[-_\s]*update|12092025/i.test(
    n,
  );
}

export function isGevIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  return /gevernova\.com\/sites\/default\/files\/.+\.pdf/i.test(url) && !isGevRejected(url);
}

export function mergeGevKnownQuarterDocs(): Map<string, GevQuarterDocs> {
  return new Map(Object.entries(GEV_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
