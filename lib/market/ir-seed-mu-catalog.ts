/**
 * Micron (MU) IR docs on s25.q4cdn.com/621799436.
 * FY ends ~late August.
 * - Slides = earnings deck / presentation PDF (not investors.micron.com/static-files — those 403 in `/api/ir-pdf`).
 * - Filings = prepared remarks PDF (press is often HTML-only).
 */

export type MuQuarterDocs = {
  fiscalPeriodEndYmd: string;
  label: string;
  slides: string;
  filings: string;
};

/** Scraped from investors.micron.com/financials/quarterly-results (Q2 FY2022+). */
export const MU_IR_QUARTER_DOCS: readonly MuQuarterDocs[] = [
  {
    fiscalPeriodEndYmd: "2026-05-31",
    label: "Q3 2026",
    slides: "https://s25.q4cdn.com/621799436/files/doc_financials/2026/q3/Micron_Q3_26_Earnings_Deck.pdf",
    filings: "https://s25.q4cdn.com/621799436/files/doc_financials/2026/q3/Q3-FY26-Prepared-Remarks.pdf",
  },
  {
    fiscalPeriodEndYmd: "2026-02-28",
    label: "Q2 2026",
    slides: "https://s25.q4cdn.com/621799436/files/doc_financials/2026/q2/Q2-2026-Earnings-Deck.pdf",
    filings: "https://s25.q4cdn.com/621799436/files/doc_financials/2026/q2/Q2-2026-Prepared-Remarks.pdf",
  },
  {
    fiscalPeriodEndYmd: "2025-11-30",
    label: "Q1 2026",
    slides: "https://s25.q4cdn.com/621799436/files/doc_financials/2026/q1/Micron-Q1-26-Earnings-Deck_R.pdf",
    filings: "https://s25.q4cdn.com/621799436/files/doc_financials/2026/q1/Micron_Q1-2026-Prepared-Remarks.pdf",
  },
  {
    fiscalPeriodEndYmd: "2025-08-31",
    label: "Q4 2025",
    slides: "https://s25.q4cdn.com/621799436/files/doc_financials/2025/q4/Q4-25-Earnings-Deck.pdf",
    filings: "https://s25.q4cdn.com/621799436/files/doc_financials/2025/q4/Q4-2025-Prepared-Remarks-1.pdf",
  },
  {
    fiscalPeriodEndYmd: "2025-05-31",
    label: "Q3 2025",
    slides: "https://s25.q4cdn.com/621799436/files/doc_financials/2025/q3/Micron_Q3-25-Earnings-Deck.pdf",
    filings: "https://s25.q4cdn.com/621799436/files/doc_financials/2025/q3/Micron_FY25_Q3_Prepared_Remarks.pdf",
  },
  {
    fiscalPeriodEndYmd: "2025-02-28",
    label: "Q2 2025",
    slides: "https://s25.q4cdn.com/621799436/files/doc_financials/2025/q2/Micron_Q2_25_Earnings_Deck-1.pdf",
    filings: "https://s25.q4cdn.com/621799436/files/doc_financials/2025/q2/Micron_FY25_Q2_Prepared_Remarks_2-1.pdf",
  },
  {
    fiscalPeriodEndYmd: "2024-11-30",
    label: "Q1 2025",
    slides: "https://s25.q4cdn.com/621799436/files/doc_financials/2025/q1/Q1-25-Earnings-Deck.pdf",
    filings: "https://s25.q4cdn.com/621799436/files/doc_financials/2025/q1/FY25-Q1-Prepared-Remarks.pdf",
  },
  {
    fiscalPeriodEndYmd: "2024-08-31",
    label: "Q4 2024",
    slides: "https://s25.q4cdn.com/621799436/files/doc_financials/2024/q4/Q4-24-Earnings-Deck.pdf",
    filings: "https://s25.q4cdn.com/621799436/files/doc_financials/2024/q4/FY24-Q4-Prepared-Remarks-3.pdf",
  },
  {
    fiscalPeriodEndYmd: "2024-05-31",
    label: "Q3 2024",
    slides: "https://s25.q4cdn.com/621799436/files/doc_financials/2024/q3/Q3-24-Earnings-Presentation.pdf",
    filings: "https://s25.q4cdn.com/621799436/files/doc_financials/2024/q3/FY24-Q3-Prepared-Remarks-FINAL.pdf",
  },
  {
    fiscalPeriodEndYmd: "2024-02-29",
    label: "Q2 2024",
    slides: "https://s25.q4cdn.com/621799436/files/doc_financials/2024/q2/Q2-24-Earnings-Deck.pdf",
    filings: "https://s25.q4cdn.com/621799436/files/doc_financials/2024/q2/FY24-Q2-Prepared-Remarks.pdf",
  },
  {
    fiscalPeriodEndYmd: "2023-11-30",
    label: "Q1 2024",
    slides: "https://s25.q4cdn.com/621799436/files/doc_financials/2024/q1/Q1-24-Earnings-Deck-for-Website.pdf",
    filings: "https://s25.q4cdn.com/621799436/files/doc_financials/2024/q1/Q1-FY24-Prepared-Remarks.pdf",
  },
  {
    fiscalPeriodEndYmd: "2023-08-31",
    label: "Q4 2023",
    slides: "https://s25.q4cdn.com/621799436/files/doc_financials/2023/q4/Q4-23-Earnings-Deck-for-Website.pdf",
    filings: "https://s25.q4cdn.com/621799436/files/doc_financials/2023/q4/Q4-FY23-Prepared-Remarks.pdf",
  },
  {
    fiscalPeriodEndYmd: "2023-05-31",
    label: "Q3 2023",
    slides: "https://s25.q4cdn.com/621799436/files/doc_financials/2023/q3/Q3-2023-Earnings-Deck-for-Website.pdf",
    filings: "https://s25.q4cdn.com/621799436/files/doc_financials/2023/q3/Q3-FY23-Prepared-Remarks.pdf",
  },
  {
    fiscalPeriodEndYmd: "2023-02-28",
    label: "Q2 2023",
    slides: "https://s25.q4cdn.com/621799436/files/doc_financials/2023/q2/Q2-2023-Earnings-Deck-for-Website.pdf",
    filings: "https://s25.q4cdn.com/621799436/files/doc_financials/2023/q2/Q2-FY23-Prepared-Remarks.pdf",
  },
  {
    fiscalPeriodEndYmd: "2022-11-30",
    label: "Q1 2023",
    slides: "https://s25.q4cdn.com/621799436/files/doc_financials/2023/q1/Q1-2023-Earnings-Deck-for-WEBSITE.pdf",
    filings: "https://s25.q4cdn.com/621799436/files/doc_financials/2023/q1/Q1-FY23-Prepared-Remarks.pdf",
  },
  {
    fiscalPeriodEndYmd: "2022-08-31",
    label: "Q4 2022",
    slides: "https://s25.q4cdn.com/621799436/files/doc_financials/2022/q4/Q4-2022-Earnings-Deck-for-IR-site-final-final.pdf",
    filings: "https://s25.q4cdn.com/621799436/files/doc_financials/2022/q4/Q4-2022-Prepared-Remarks.pdf",
  },
  {
    fiscalPeriodEndYmd: "2022-05-31",
    label: "Q3 2022",
    slides: "https://s25.q4cdn.com/621799436/files/doc_financials/2022/q3/Q3-2022-Earnings-Presentation.pdf",
    filings: "https://s25.q4cdn.com/621799436/files/doc_financials/2022/q3/FQ3-22-Prepared-Remarks.pdf",
  },
  {
    fiscalPeriodEndYmd: "2022-02-28",
    label: "Q2 2022",
    slides: "https://s25.q4cdn.com/621799436/files/doc_financials/2022/q2/Q2-2022-Earnings-Deck.pdf",
    filings: "https://s25.q4cdn.com/621799436/files/doc_financials/2022/q2/Q2-2022-Prepared-Remarks.pdf",
  },
];

export function muDocsByPeriodEnd(): Map<string, { slides: string; filings: string }> {
  const out = new Map<string, { slides: string; filings: string }>();
  for (const row of MU_IR_QUARTER_DOCS) {
    out.set(row.fiscalPeriodEndYmd, { slides: row.slides, filings: row.filings });
  }
  return out;
}

/** @deprecated use muDocsByPeriodEnd */
export function muPreparedRemarksByPeriodEnd(): Map<string, string> {
  const out = new Map<string, string>();
  for (const row of MU_IR_QUARTER_DOCS) {
    out.set(row.fiscalPeriodEndYmd, row.filings);
  }
  return out;
}
