import type { EarningsTranscript } from "@/lib/market/earnings-transcript-types";
import type { StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

/**
 * Lightweight transcript index for client components. Each transcript JSON (~1 MB with word timings)
 * loads on demand via its own `import()` chunk — statically importing them shipped ~12 MB to every page.
 * Keep in sync with the `*-earnings-transcript-fixture.ts` modules (enforced by the catalog test).
 */
export type EarningsTranscriptRef = {
  ticker: string;
  fiscalPeriodLabel: string;
  eventDateYmd: string;
  load: () => Promise<EarningsTranscript>;
};

type Loader = () => Promise<{ default: unknown }>;

function ref(ticker: string, fiscalPeriodLabel: string, eventDateYmd: string, loader: Loader): EarningsTranscriptRef {
  return {
    ticker,
    fiscalPeriodLabel,
    eventDateYmd,
    load: () => loader().then((m) => m.default as EarningsTranscript),
  };
}

export const EARNINGS_TRANSCRIPT_CATALOG: readonly EarningsTranscriptRef[] = [
  ref("NVDA", "Q1 2026", "2025-05-28", () => import("@/lib/market/fixtures/nvda-q1-2026-transcript.json")),
  ref("NVDA", "Q1 2027", "2026-05-20", () => import("@/lib/market/fixtures/nvda-q1-2027-transcript.json")),
  ref("NVDA", "Q2 2026", "2025-08-27", () => import("@/lib/market/fixtures/nvda-q2-2026-transcript.json")),
  ref("NVDA", "Q2 2027", "2026-08-26", () => import("@/lib/market/fixtures/nvda-q2-2027-transcript.json")),
  ref("NVDA", "Q3 2026", "2025-11-19", () => import("@/lib/market/fixtures/nvda-q3-2026-transcript.json")),
  ref("NVDA", "Q4 2026", "2026-02-25", () => import("@/lib/market/fixtures/nvda-q4-2026-transcript.json")),
  ref("AAPL", "Q2 2025", "2025-05-01", () => import("@/lib/market/fixtures/aapl-q2-2025-transcript.json")),
  ref("AAPL", "Q3 2025", "2025-07-31", () => import("@/lib/market/fixtures/aapl-q3-2025-transcript.json")),
  ref("AAPL", "Q4 2025", "2025-10-30", () => import("@/lib/market/fixtures/aapl-q4-2025-transcript.json")),
  ref("AAPL", "Q1 2026", "2026-01-29", () => import("@/lib/market/fixtures/aapl-q1-2026-transcript.json")),
  ref("AAPL", "Q2 2026", "2026-05-01", () => import("@/lib/market/fixtures/aapl-q2-2026-transcript.json")),
  ref("AAPL", "Q3 2026", "2026-07-31", () => import("@/lib/market/fixtures/aapl-q3-2026-transcript.json")),
  ref("GOOGL", "Q1 2025", "2025-04-24", () => import("@/lib/market/fixtures/googl-q1-2025-transcript.json")),
  ref("GOOGL", "Q2 2025", "2025-07-23", () => import("@/lib/market/fixtures/googl-q2-2025-transcript.json")),
  ref("GOOGL", "Q3 2025", "2025-10-29", () => import("@/lib/market/fixtures/googl-q3-2025-transcript.json")),
  ref("GOOGL", "Q4 2025", "2026-02-04", () => import("@/lib/market/fixtures/googl-q4-2025-transcript.json")),
  ref("GOOGL", "Q1 2026", "2026-04-29", () => import("@/lib/market/fixtures/googl-q1-2026-transcript.json")),
  ref("GOOGL", "Q2 2026", "2026-07-22", () => import("@/lib/market/fixtures/googl-q2-2026-transcript.json")),
  ref("MSFT", "Q3 2025", "2025-04-30", () => import("@/lib/market/fixtures/msft-q3-2025-transcript.json")),
  ref("MSFT", "Q4 2025", "2025-07-30", () => import("@/lib/market/fixtures/msft-q4-2025-transcript.json")),
  ref("MSFT", "Q1 2026", "2025-10-29", () => import("@/lib/market/fixtures/msft-q1-2026-transcript.json")),
  ref("MSFT", "Q2 2026", "2026-01-28", () => import("@/lib/market/fixtures/msft-q2-2026-transcript.json")),
  ref("MSFT", "Q3 2026", "2026-04-29", () => import("@/lib/market/fixtures/msft-q3-2026-transcript.json")),
  ref("MSFT", "Q4 2026", "2026-07-29", () => import("@/lib/market/fixtures/msft-q4-2026-transcript.json")),
];

/** Class C shares share the same Alphabet earnings calls. */
const TICKER_ALIASES: Readonly<Record<string, string>> = { GOOG: "GOOGL" };

/** Normalize `Q2 2027` / `Q2 FY2027` / `Q2FY2027` → `Q2|2027`. */
function normalizeQuarterKey(label: string | null | undefined): string | null {
  const m = label?.trim().match(/^Q([1-4])\s*(?:FY)?\s*(\d{4})$/i);
  if (!m) return null;
  return `Q${m[1]}|${m[2]}`;
}

/** Same quarter label, or same call date — shared by the server fixture lookup and this catalog. */
export function earningsTranscriptMatchesRow(
  row: Pick<StockEarningsHistoryRow, "fiscalPeriodLabel" | "reportDateYmd">,
  fiscalPeriodLabel: string,
  eventDateYmd: string,
): boolean {
  const a = normalizeQuarterKey(row.fiscalPeriodLabel);
  const b = normalizeQuarterKey(fiscalPeriodLabel);
  if (a != null && b != null && a === b) return true;
  const ymd = row.reportDateYmd?.trim() ?? "";
  return ymd.length > 0 && ymd === eventDateYmd;
}

export function findEarningsTranscriptRef(
  listingTicker: string,
  row: Pick<StockEarningsHistoryRow, "fiscalPeriodLabel" | "reportDateYmd" | "reported">,
): EarningsTranscriptRef | null {
  if (!row.reported) return null;
  const raw = listingTicker.trim().toUpperCase();
  const ticker = TICKER_ALIASES[raw] ?? raw;
  for (const entry of EARNINGS_TRANSCRIPT_CATALOG) {
    if (entry.ticker === ticker && earningsTranscriptMatchesRow(row, entry.fiscalPeriodLabel, entry.eventDateYmd)) {
      return entry;
    }
  }
  return null;
}
