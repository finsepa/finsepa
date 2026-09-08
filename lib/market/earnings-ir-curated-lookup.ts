import type { StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";
import { MU_IR_QUARTER_DOCS } from "@/lib/market/ir-seed-mu-catalog";

type CuratedEntry = {
  /**
   * Return true when this history row should use the PDFs below. Avoid overlapping
   * predicates for the same ticker when you add more quarters.
   */
  when: (row: StockEarningsHistoryRow) => boolean;
  presentationPdfUrl?: string;
  quarterlyReportPdfUrl?: string;
};

const MU_CURATED: CuratedEntry[] = MU_IR_QUARTER_DOCS.map((d) => ({
  when: (row: StockEarningsHistoryRow) =>
    row.fiscalPeriodEndYmd === d.fiscalPeriodEndYmd ||
    row.fiscalPeriodLabel?.trim() === d.label,
  presentationPdfUrl: d.slides,
  quarterlyReportPdfUrl: d.filings,
}));

const CURATED_BY_TICKER: Record<string, CuratedEntry[]> = {
  MU: MU_CURATED,
  AMZN: [
    {
      // Q2 2026 — Filings = IR-hosted 10-Q (SEC Forms), not earnings-release; slides = Webslides.
      when: (row) => {
        const f = row.fiscalPeriodEndYmd;
        const label = row.fiscalPeriodLabel?.trim();
        if (f === "2026-06-30") return true;
        if (label === "Q2 2026" || label === "Q2 '26") return true;
        return false;
      },
      presentationPdfUrl:
        "https://s2.q4cdn.com/299287126/files/doc_earnings/2026/q2/presentation/Webslides_Q226.pdf",
      quarterlyReportPdfUrl:
        "https://d18rn0p25nwr6d.cloudfront.net/CIK-0001018724/8b65cc1d-13ba-4465-ab3b-7b408e2fcdaf.pdf",
    },
    {
      // Q1 2026 — same mapping as Q2 2026.
      when: (row) => {
        const f = row.fiscalPeriodEndYmd;
        const label = row.fiscalPeriodLabel?.trim();
        if (f === "2026-03-31") return true;
        if (label === "Q1 2026" || label === "Q1 '26") return true;
        return false;
      },
      presentationPdfUrl:
        "https://s2.q4cdn.com/299287126/files/doc_earnings/2026/q1/presentation/Webslides_Q126.pdf",
      quarterlyReportPdfUrl:
        "https://d18rn0p25nwr6d.cloudfront.net/CIK-0001018724/e5b7de6a-55b0-4300-b981-4e5a8857972d.pdf",
    },
  ],
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
  PG: [
    {
      // Q3 FY2025 (ended Mar 31) — confirmed on CDN; generic patterns miss ScriptSlides/JFM naming.
      when: (row) => {
        const f = row.fiscalPeriodEndYmd;
        const label = row.fiscalPeriodLabel?.trim();
        if (f === "2025-03-31") return true;
        if (label === "Q3 2025") return true;
        return false;
      },
      presentationPdfUrl:
        "https://s204.q4cdn.com/332108499/files/doc_financials/2025/q3/ScriptSlides-JFM-2025-Reg-G-FINAL.pdf",
      quarterlyReportPdfUrl:
        "https://s204.q4cdn.com/332108499/files/doc_financials/2025/q3/Q3-FY2425-RELEASE-Final.pdf",
    },
  ],
  ORCL: [
    {
      // FY ends May 31. Q4 FY2026 (ended May 31) reported Jun 10 — first quarter with IR slides.
      when: (row) => {
        const f = row.fiscalPeriodEndYmd;
        const r = row.reportDateYmd;
        const label = row.fiscalPeriodLabel?.trim();
        if (f === "2026-05-31") return true;
        if (r && r >= "2026-06-08" && r <= "2026-06-12") return true;
        if (label === "Q4 2026" || label === "Q4 '26") return true;
        return false;
      },
      presentationPdfUrl:
        "https://s23.q4cdn.com/440135859/files/doc_earnings/2026/q4/presentation/Presentation-Slides-Q4-26.pdf",
      quarterlyReportPdfUrl:
        "https://s23.q4cdn.com/440135859/files/doc_earnings/2026/q4/earnings-result/4q26-pressrelease-final.pdf",
    },
    {
      // Q3 FY2026 (ended Feb 28) reported Mar 10 — press release + tables only (no slides deck yet).
      when: (row) => {
        const f = row.fiscalPeriodEndYmd;
        const r = row.reportDateYmd;
        const label = row.fiscalPeriodLabel?.trim();
        if (f === "2026-02-28") return true;
        if (r && r >= "2026-03-08" && r <= "2026-03-12") return true;
        if (label === "Q3 2026" || label === "Q3 '26") return true;
        return false;
      },
      quarterlyReportPdfUrl:
        "https://s23.q4cdn.com/440135859/files/doc_financials/2026/q3/3q26-pressrelease-March-FINAL.pdf",
    },
    {
      when: (row) => {
        const f = row.fiscalPeriodEndYmd;
        const r = row.reportDateYmd;
        const label = row.fiscalPeriodLabel?.trim();
        if (f === "2025-11-30") return true;
        if (r && r >= "2025-12-08" && r <= "2025-12-12") return true;
        if (label === "Q2 2026" || label === "Q2 '26") return true;
        return false;
      },
      quarterlyReportPdfUrl:
        "https://s23.q4cdn.com/440135859/files/doc_earnings/2026/q2/earnings-result/2q26-pressrelease-final.pdf",
    },
    {
      when: (row) => {
        const f = row.fiscalPeriodEndYmd;
        const r = row.reportDateYmd;
        const label = row.fiscalPeriodLabel?.trim();
        if (f === "2025-08-31") return true;
        if (r && r >= "2025-09-08" && r <= "2025-09-12") return true;
        if (label === "Q1 2026" || label === "Q1 '26") return true;
        return false;
      },
      quarterlyReportPdfUrl:
        "https://s23.q4cdn.com/440135859/files/doc_financials/2026/q1/1q26-pressrelease-September-final_.pdf",
    },
  ],
  // WMT: no curated URLs — IR scrape + scored filters in ir-seed-walmart-match.ts.
  CMCSA: [
    {
      when: (row) => row.fiscalPeriodLabel === "Q1 2026",
      presentationPdfUrl:
        "https://www.cmcsa.com/static-files/d62ea722-6b4f-455d-9eb0-e70b98f254d4",
    },
    {
      when: (row) => row.fiscalPeriodLabel === "Q4 2025",
      presentationPdfUrl:
        "https://www.cmcsa.com/static-files/b40b8cef-831e-4b0f-bf7f-7f02223f8a13",
    },
    {
      when: (row) => row.fiscalPeriodLabel === "Q3 2025",
      presentationPdfUrl:
        "https://www.cmcsa.com/static-files/6624bc9f-8c67-424f-be37-244065f21680",
    },
    {
      when: (row) => row.fiscalPeriodLabel === "Q2 2025",
      presentationPdfUrl: "https://media.eulerpool.com/presentation/4957.pdf",
    },
    {
      when: (row) => row.fiscalPeriodLabel === "Q1 2025",
      presentationPdfUrl:
        "https://www.cmcsa.com/static-files/ce929fe6-52c8-4117-8c54-9d3c50c86bf8",
    },
  ],
};

export function getCuratedIrEarningsRowUrls(
  listingTicker: string,
  row: StockEarningsHistoryRow,
): { presentationPdfUrl?: string; quarterlyReportPdfUrl?: string } | null {
  const t = listingTicker.trim().toUpperCase();
  const list = CURATED_BY_TICKER[t];
  if (!list) return null;
  for (const c of list) {
    if (c.when(row)) {
      return {
        presentationPdfUrl: c.presentationPdfUrl,
        quarterlyReportPdfUrl: c.quarterlyReportPdfUrl,
      };
    }
  }
  return null;
}

/** Server-side: fill `secSlidesUrl` / `secFilingsUrl` last so QA curated URLs always win. */
export function applyCuratedIrEarningsDocumentUrls(
  listingTicker: string,
  history: StockEarningsHistoryRow[],
): StockEarningsHistoryRow[] {
  return history.map((row) => {
    const hit = getCuratedIrEarningsRowUrls(listingTicker, row);
    if (!hit) return row;
    return {
      ...row,
      ...(hit.presentationPdfUrl ? { secSlidesUrl: hit.presentationPdfUrl } : {}),
      ...(hit.quarterlyReportPdfUrl ? { secFilingsUrl: hit.quarterlyReportPdfUrl } : {}),
    };
  });
}
