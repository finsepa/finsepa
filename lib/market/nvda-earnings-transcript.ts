import type { StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";
import {
  NVDA_EARNINGS_TRANSCRIPTS,
  type NvdaEarningsTranscript,
} from "@/lib/market/nvda-earnings-transcript-fixture";

const NVDA = "NVDA";

/** Normalize `Q2 2027` / `Q2 FY2027` / `Q2FY2027` → `Q2|2027`. */
function normalizeQuarterKey(label: string | null | undefined): string | null {
  const m = label?.trim().match(/^Q([1-4])\s*(?:FY)?\s*(\d{4})$/i);
  if (!m) return null;
  return `Q${m[1]}|${m[2]}`;
}

function matchesFiscalLabel(rowLabel: string | null | undefined, fixtureLabel: string): boolean {
  const a = normalizeQuarterKey(rowLabel);
  const b = normalizeQuarterKey(fixtureLabel);
  return a != null && b != null && a === b;
}

function matchesEventDate(rowYmd: string | null | undefined, fixtureYmd: string): boolean {
  const a = rowYmd?.trim() ?? "";
  return a.length > 0 && a === fixtureYmd;
}

export function isNvdaTranscriptTicker(ticker: string): boolean {
  return ticker.trim().toUpperCase() === NVDA;
}

export function listNvdaEarningsTranscripts(): readonly NvdaEarningsTranscript[] {
  return NVDA_EARNINGS_TRANSCRIPTS;
}

export function getNvdaEarningsTranscript(
  listingTicker: string,
  row: Pick<StockEarningsHistoryRow, "fiscalPeriodLabel" | "reportDateYmd" | "reported">,
): NvdaEarningsTranscript | null {
  if (!isNvdaTranscriptTicker(listingTicker) || !row.reported) return null;
  for (const fixture of NVDA_EARNINGS_TRANSCRIPTS) {
    if (
      matchesFiscalLabel(row.fiscalPeriodLabel, fixture.fiscalPeriodLabel) ||
      matchesEventDate(row.reportDateYmd, fixture.eventDateYmd)
    ) {
      return fixture;
    }
  }
  return null;
}

export function hasNvdaEarningsTranscript(
  listingTicker: string,
  row: Pick<StockEarningsHistoryRow, "fiscalPeriodLabel" | "reportDateYmd" | "reported">,
): boolean {
  return getNvdaEarningsTranscript(listingTicker, row) != null;
}
