import type { StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

type CuratedEntry = {
  /**
   * Return true when this history row should use the PDFs below. Avoid overlapping
   * predicates for the same ticker when you add more quarters.
   */
  when: (row: StockEarningsHistoryRow) => boolean;
  presentationPdfUrl: string;
  quarterlyReportPdfUrl: string;
};

const CURATED_BY_TICKER: Record<string, CuratedEntry[]> = {
  NVDA: [
    {
      // F1Q26: EODHD may set `fiscalPeriodEndYmd` to a few different April/May YMDs, and `reportDateYmd` is often the
      // late-May earnings call — match either so we do not fall back to SEC `browse-edgar` HTML.
      when: (row) => {
        const f = row.fiscalPeriodEndYmd;
        const r = row.reportDateYmd;
        if (f && f >= "2025-04-15" && f <= "2025-05-10") return true;
        if (r && r >= "2025-05-20" && r <= "2025-06-10") return true;
        return false;
      },
      presentationPdfUrl:
        "https://s201.q4cdn.com/141608511/files/doc_financials/2026/q1/NVDA-F1Q26-Quarterly-Presentation-FINAL.pdf",
      quarterlyReportPdfUrl:
        "https://s201.q4cdn.com/141608511/files/doc_financials/2026/q1/b6df1c5c-5cb6-4a41-9d28-dd1bcd34cc26.pdf",
    },
  ],
  NKE: [
    {
      when: (row) => row.fiscalPeriodEndYmd === "2025-11-30",
      presentationPdfUrl:
        "https://s1.q4cdn.com/806093406/files/doc_financials/2026/q2/Q2-FY26-Quarterly-Presentation-FINAL.pdf",
      quarterlyReportPdfUrl:
        "https://s1.q4cdn.com/806093406/files/doc_financials/2026/q2/Q2-FY26-Exhibit-99-1ER-FINAL-33-97.pdf",
    },
  ],
};

export function getCuratedIrEarningsRowUrls(
  listingTicker: string,
  row: StockEarningsHistoryRow,
): { presentationPdfUrl: string; quarterlyReportPdfUrl: string } | null {
  const t = listingTicker.trim().toUpperCase();
  const list = CURATED_BY_TICKER[t];
  if (!list) return null;
  for (const c of list) {
    if (c.when(row)) {
      return { presentationPdfUrl: c.presentationPdfUrl, quarterlyReportPdfUrl: c.quarterlyReportPdfUrl };
    }
  }
  return null;
}

/** Server-side: fill `secSlidesUrl` / `secFilingsUrl` (legacy field names) after SEC enrichment. */
export function applyCuratedIrEarningsDocumentUrls(
  listingTicker: string,
  history: StockEarningsHistoryRow[],
): StockEarningsHistoryRow[] {
  return history.map((row) => {
    const hit = getCuratedIrEarningsRowUrls(listingTicker, row);
    if (!hit) return row;
    return {
      ...row,
      secSlidesUrl: hit.presentationPdfUrl,
      secFilingsUrl: hit.quarterlyReportPdfUrl,
    };
  });
}
