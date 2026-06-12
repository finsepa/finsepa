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

/** Prefer Exhibit 99.1 HTML press releases linked from a Form 8-K `index.htm`. */
export function pickExhibit99PressReleaseHtmlUrl(
  indexHtml: string,
  cikNumeric: string,
  accessionFlat: string,
): string | null {
  const html = decodeSecHref(indexHtml);
  const base = filingDirectoryBase(cikNumeric, accessionFlat);
  const candidates: { url: string; score: number }[] = [];

  for (const m of html.matchAll(/href=['"]([^'"]+)['"]/gi)) {
    const href = (m[1] ?? "").split("#")[0] ?? "";
    if (!href || /\.pdf$/i.test(href)) continue;
    if (!/\.htm/i.test(href)) continue;
    if (!/ex[-_.]?99|exhibit[-_.]?99|press|earn|result/i.test(href)) continue;

    const abs = href.startsWith("http")
      ? href
      : href.startsWith("/")
        ? `${SEC_ORIGIN}${href}`
        : `${base}${href.replace(/^\//, "")}`;

    let score = 50;
    if (/ex[-_.]?99|exhibit[-_.]?99/i.test(href)) score += 80;
    if (/press|earn|result|q\d|fy\d/i.test(href)) score += 40;
    if (/\.htm$/i.test(href)) score += 10;
    candidates.push({ url: abs, score });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.url ?? null;
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
