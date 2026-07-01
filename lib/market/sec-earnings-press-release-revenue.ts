import "server-only";

import { formatUsdCompact } from "@/lib/market/key-stats-basic-format";
import type { StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const SEC_ORIGIN = "https://www.sec.gov";

/** Unescape common HTML entities in href targets (SEC pages use &amp;). */
function decodeSecHref(s: string): string {
  return s.split("&amp;").join("&").split("&#38;").join("&");
}

function filingDirectoryBase(cikNumeric: string, accessionFlat: string): string {
  return `${SEC_ORIGIN}/Archives/edgar/data/${cikNumeric}/${accessionFlat}/`;
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseUsdFromAmountAndUnit(amountRaw: string, unitRaw: string): number | null {
  const amount = Number(amountRaw.replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = unitRaw.toLowerCase();
  if (unit.startsWith("b")) return amount * 1e9;
  if (unit.startsWith("m")) return amount * 1e6;
  if (unit.startsWith("k")) return amount * 1e3;
  return null;
}

/**
 * Parse total revenue from issuer earnings press releases (Exhibit 99.1 HTML).
 * Handles common phrasing like “record revenue of $6.62 billion”.
 */
export function extractTotalRevenueUsdFromPressReleaseHtml(html: string): number | null {
  const text = htmlToPlainText(html);
  const patterns: RegExp[] = [
    /record revenue of \$([\d,.]+)\s*(billion|million)\b/i,
    /total revenue of \$([\d,.]+)\s*(billion|million)\b/i,
    /revenue of \$([\d,.]+)\s*(billion|million)\b/i,
    /\$([\d,.]+)\s*(billion|million)\s+in revenue\b/i,
    /revenue was \$([\d,.]+)\s*(billion|million)\b/i,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const usd = parseUsdFromAmountAndUnit(m[1]!, m[2]!);
    if (usd != null && usd >= 1e6 && usd <= 5e12) return usd;
  }
  return null;
}

function scorePressReleaseExhibitHref(href: string): number {
  const n = href.toLowerCase();
  if (/shareholder\s*letter|shareholderletter/i.test(n)) return -100;
  if (/slide|slides|slidesfin|presentation|deck|992|ex[-_.]?99[-_.]?2/i.test(n)) return -100;
  let score = 50;
  if (/991|ex[-_.]?99[-_.]?1/i.test(n)) score += 150;
  if (/interim\s*report|interimreport/i.test(n)) score += 120;
  if (/ex[-_.]?99|exhibit[-_.]?99/i.test(n)) score += 80;
  if (/results\.htm/i.test(n) && !/cover/i.test(n)) score += 70;
  if (/press|release|earn|result|q\d|fy\d/i.test(n)) score += 40;
  if (/cover/i.test(n)) score -= 60;
  if (/\.htm$/i.test(n)) score += 10;
  return score;
}

function scorePresentationExhibitHref(href: string): number {
  const n = href.toLowerCase();
  if (/earningsrel|earningsrelease|earningsreleaseex|earnings[-_.]?release|ex991pressrelease|ex991earningsrelease/i.test(n)) {
    return -100;
  }
  if (/press|release|991|ex[-_.]?99[-_.]?1/i.test(n) && !/slide|present|deck/i.test(n)) return -100;
  let score = 40;
  if (/shareholder\s*letter|shareholderletter/i.test(n)) score += 170;
  if (/slide|slides|slidesfin|presentation|deck/i.test(n)) score += 180;
  if (/992|ex[-_.]?99[-_.]?2/i.test(n)) score += 100;
  if (/ex[-_.]?99|exhibit[-_.]?99/i.test(n)) score += 40;
  if (/earn|result|q\d|fy\d/i.test(n)) score += 20;
  if (/\.htm$/i.test(n)) score += 10;
  return score;
}

function pickExhibit99HtmlUrl(
  indexHtml: string,
  cikNumeric: string,
  accessionFlat: string,
  scoreHref: (href: string) => number,
): string | null {
  const html = decodeSecHref(indexHtml);
  const base = filingDirectoryBase(cikNumeric, accessionFlat);
  const candidates: { url: string; score: number }[] = [];

  for (const m of html.matchAll(/href=['"]([^'"]+)['"]/gi)) {
    const href = (m[1] ?? "").split("#")[0] ?? "";
    if (!href || /\.pdf$/i.test(href)) continue;
    if (!/\.htm/i.test(href)) continue;
    if (
      !/ex[-_.]?99|exhibit[-_.]?99|press|earn|result|interim|fnv|slide|present|deck|991|992|shareholder/i.test(
        href,
      )
    ) {
      continue;
    }
    if (/prcov|bbcov/i.test(href)) continue;

    const abs = href.startsWith("http")
      ? href
      : href.startsWith("/")
        ? `${SEC_ORIGIN}${href}`
        : `${base}${href.replace(/^\//, "")}`;

    const score = scoreHref(href);
    if (score < 0) continue;
    candidates.push({ url: abs, score });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.url ?? null;
}

/** Prefer earnings press release / interim report HTML from a Form 8-K or 6-K `index.htm`. */
export function pickExhibit99PressReleaseHtmlUrl(
  indexHtml: string,
  cikNumeric: string,
  accessionFlat: string,
): string | null {
  return pickExhibit99HtmlUrl(indexHtml, cikNumeric, accessionFlat, scorePressReleaseExhibitHref);
}

/** Prefer earnings presentation / slide deck HTML (Exhibit 99.2) from a Form 8-K index. */
export function pickExhibit99PresentationHtmlUrl(
  indexHtml: string,
  cikNumeric: string,
  accessionFlat: string,
): string | null {
  return pickExhibit99HtmlUrl(indexHtml, cikNumeric, accessionFlat, scorePresentationExhibitHref);
}

export function applyRevenueUsdToHistoryRow(
  row: StockEarningsHistoryRow,
  revenueUsd: number,
): StockEarningsHistoryRow {
  return {
    ...row,
    revenueActualUsd: revenueUsd,
    revenueActualDisplay: formatUsdCompact(revenueUsd),
  };
}
