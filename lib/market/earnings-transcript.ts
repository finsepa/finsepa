import type { StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";
import type { EarningsTranscript } from "@/lib/market/earnings-transcript-types";
import { NVDA_EARNINGS_TRANSCRIPTS } from "@/lib/market/nvda-earnings-transcript-fixture";
import { AAPL_EARNINGS_TRANSCRIPTS } from "@/lib/market/aapl-earnings-transcript-fixture";
import { GOOGL_EARNINGS_TRANSCRIPTS } from "@/lib/market/googl-earnings-transcript-fixture";

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

const BY_TICKER: Record<string, readonly EarningsTranscript[]> = {
  NVDA: NVDA_EARNINGS_TRANSCRIPTS,
  AAPL: AAPL_EARNINGS_TRANSCRIPTS,
  GOOGL: GOOGL_EARNINGS_TRANSCRIPTS,
  // Class C shares share the same Alphabet earnings calls.
  GOOG: GOOGL_EARNINGS_TRANSCRIPTS,
};

export function listEarningsTranscripts(ticker: string): readonly EarningsTranscript[] {
  return BY_TICKER[ticker.trim().toUpperCase()] ?? [];
}

export function getEarningsTranscript(
  listingTicker: string,
  row: Pick<StockEarningsHistoryRow, "fiscalPeriodLabel" | "reportDateYmd" | "reported">,
): EarningsTranscript | null {
  if (!row.reported) return null;
  const list = listEarningsTranscripts(listingTicker);
  for (const fixture of list) {
    if (
      matchesFiscalLabel(row.fiscalPeriodLabel, fixture.fiscalPeriodLabel) ||
      matchesEventDate(row.reportDateYmd, fixture.eventDateYmd)
    ) {
      return fixture;
    }
  }
  return null;
}

export function hasEarningsTranscript(
  listingTicker: string,
  row: Pick<StockEarningsHistoryRow, "fiscalPeriodLabel" | "reportDateYmd" | "reported">,
): boolean {
  return getEarningsTranscript(listingTicker, row) != null;
}

/** @deprecated Prefer getEarningsTranscript. */
export function getNvdaEarningsTranscript(
  listingTicker: string,
  row: Pick<StockEarningsHistoryRow, "fiscalPeriodLabel" | "reportDateYmd" | "reported">,
): EarningsTranscript | null {
  return getEarningsTranscript(listingTicker, row);
}

/** @deprecated Prefer hasEarningsTranscript. */
export function hasNvdaEarningsTranscript(
  listingTicker: string,
  row: Pick<StockEarningsHistoryRow, "fiscalPeriodLabel" | "reportDateYmd" | "reported">,
): boolean {
  return hasEarningsTranscript(listingTicker, row);
}

/** @deprecated Prefer listEarningsTranscripts("NVDA"). */
export function listNvdaEarningsTranscripts(): readonly EarningsTranscript[] {
  return listEarningsTranscripts("NVDA");
}

/** @deprecated Prefer checking list length / getEarningsTranscript. */
export function isNvdaTranscriptTicker(ticker: string): boolean {
  return listEarningsTranscripts(ticker).length > 0;
}
