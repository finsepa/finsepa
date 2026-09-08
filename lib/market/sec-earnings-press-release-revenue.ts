import "server-only";

import { formatUsdCompact } from "@/lib/market/key-stats-basic-format";
import {
  pickExhibit99PresentationHtmlUrl,
  pickExhibit99PressReleaseHtmlUrl,
} from "@/lib/market/sec-exhibit-html-pick";
import type { StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

export { pickExhibit99PresentationHtmlUrl, pickExhibit99PressReleaseHtmlUrl };

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
