/**
 * Cisco (CSCO) IR PDFs on s21.q4cdn.com/812015656 — FY ends ~late July.
 * Slides = Earnings Slides; Filings = Press Release.
 */

export type CscoQuarterDocs = {
  fq: number;
  fy: number;
  slides?: string;
  filings?: string;
};

/** Scraped from investor.cisco.com quarterly-results (Q1 FY2022+). */
export const CSCO_IR_QUARTER_DOCS: readonly CscoQuarterDocs[] = [
  {
    fq: 4,
    fy: 2026,
    slides:
      "https://s21.q4cdn.com/812015656/files/doc_earnings/2026/q4/presentation/Q4FY26-Cisco-Earnings-Slides.pdf",
    filings:
      "https://s21.q4cdn.com/812015656/files/doc_earnings/2026/q4/earnings-result/Q4FY26-Press-Release.pdf",
  },
  {
    fq: 3,
    fy: 2026,
    slides: "https://s21.q4cdn.com/812015656/files/doc_financials/2026/q3/Q3FY26-Earnings-Slides.pdf",
    filings:
      "https://s21.q4cdn.com/812015656/files/doc_earnings/2026/q3/earnings-result/Q3FY26-Press-Release.pdf",
  },
  {
    fq: 2,
    fy: 2026,
    slides: "https://s21.q4cdn.com/812015656/files/doc_financials/2026/q2/Q2-26-Earnings-Slides.pdf",
    filings: "https://s21.q4cdn.com/812015656/files/doc_financials/2026/q2/Q2FY26-Press-Release.pdf",
  },
  {
    fq: 1,
    fy: 2026,
    slides: "https://s21.q4cdn.com/812015656/files/doc_financials/2026/q1/Q1-26-Earnings-Slides.pdf",
    filings: "https://s21.q4cdn.com/812015656/files/doc_financials/2026/q1/Q1FY26-Press-Release.pdf",
  },
  {
    fq: 4,
    fy: 2025,
    slides: "https://s21.q4cdn.com/812015656/files/doc_financials/2025/q4/Q4FY25-Earnings-Slides.pdf",
    filings: "https://s21.q4cdn.com/812015656/files/doc_financials/2025/q4/Q4FY25-Press-Release.pdf",
  },
  {
    fq: 3,
    fy: 2025,
    slides: "https://s21.q4cdn.com/812015656/files/doc_financials/2025/q3/Q3FY25-Earnings-Slides.pdf",
    filings: "https://s21.q4cdn.com/812015656/files/doc_financials/2025/q3/Q3FY25-Press-Release.pdf",
  },
  {
    fq: 2,
    fy: 2025,
    slides: "https://s21.q4cdn.com/812015656/files/doc_financials/2025/q2/Q2FY25-Earnings-Slides.pdf",
    filings: "https://s21.q4cdn.com/812015656/files/doc_financials/2025/q2/Q2FY25-Press-Release.pdf",
  },
  {
    fq: 1,
    fy: 2025,
    slides: "https://s21.q4cdn.com/812015656/files/doc_financials/2025/q1/Q1FY25-Earnings-Slides-Web.pdf",
    filings: "https://s21.q4cdn.com/812015656/files/doc_financials/2025/q1/Q1FY25-Press-Release.pdf",
  },
  {
    fq: 4,
    fy: 2024,
    slides: "https://s21.q4cdn.com/812015656/files/doc_financials/2024/q4/Q4FY24-Earnings-Slides.pdf",
    filings: "https://s21.q4cdn.com/812015656/files/doc_financials/2024/q4/Q4FY24-Press-Release.pdf",
  },
  {
    fq: 3,
    fy: 2024,
    slides: "https://s21.q4cdn.com/812015656/files/doc_financials/2024/q3/Q3FY24-Earnings-Slides.pdf",
    filings: "https://s21.q4cdn.com/812015656/files/doc_financials/2024/q3/Q3FY24-Press-Release.pdf",
  },
  {
    fq: 2,
    fy: 2024,
    slides: "https://s21.q4cdn.com/812015656/files/doc_financials/2024/q2/Q2FY24-Earnings-Slides.pdf",
    filings: "https://s21.q4cdn.com/812015656/files/doc_financials/2024/q2/Q2FY24-Press-Release.pdf",
  },
  {
    fq: 1,
    fy: 2024,
    slides: "https://s21.q4cdn.com/812015656/files/doc_financials/2024/q1/Q1FY24-Earnings-Slides.pdf",
    filings: "https://s21.q4cdn.com/812015656/files/doc_financials/2024/q1/Q1FY24-Press-Release.pdf",
  },
  {
    fq: 4,
    fy: 2023,
    slides: "https://s21.q4cdn.com/812015656/files/doc_financials/2023/q4/Q4FY23-Earnings-Slides.pdf",
    filings: "https://s21.q4cdn.com/812015656/files/doc_financials/2023/q4/Q4FY23-Press-Release.pdf",
  },
  {
    fq: 3,
    fy: 2023,
    slides: "https://s21.q4cdn.com/812015656/files/doc_financials/2023/q3/Q3FY23-Earnings-Slides-1.pdf",
    filings: "https://s21.q4cdn.com/812015656/files/doc_financials/2023/q3/Q3FY23-Press-Release_.pdf",
  },
  {
    fq: 2,
    fy: 2023,
    slides: "https://s21.q4cdn.com/812015656/files/doc_financials/2023/q2/Q2FY23-Earnings-Slides.pdf",
    filings: "https://s21.q4cdn.com/812015656/files/doc_financials/2023/q2/Q2FY23-Press-Release.pdf",
  },
  {
    fq: 1,
    fy: 2023,
    slides: "https://s21.q4cdn.com/812015656/files/doc_financials/2023/q1/Q1FY23-Earnings-Slides.pdf",
    filings: "https://s21.q4cdn.com/812015656/files/doc_financials/2023/q1/Q1FY23-Press-Release.pdf",
  },
  {
    fq: 4,
    fy: 2022,
    slides: "https://s21.q4cdn.com/812015656/files/doc_financials/2022/q4/Q4FY22-Cisco-Earnings-Slides.pdf",
    filings: "https://s21.q4cdn.com/812015656/files/doc_financials/2022/q4/Q4FY22-Press-Release_.pdf",
  },
  {
    fq: 3,
    fy: 2022,
    slides: "https://s21.q4cdn.com/812015656/files/doc_financials/2022/q3/Q3FY22-Cisco-Earnings-Slides.pdf",
    filings: "https://s21.q4cdn.com/812015656/files/doc_financials/2022/q3/Q3FY22-Press-Release.pdf",
  },
  {
    fq: 2,
    fy: 2022,
    slides: "https://s21.q4cdn.com/812015656/files/doc_financials/2022/q2/Q2FY22-Earnings-Slides.pdf",
    filings: "https://s21.q4cdn.com/812015656/files/doc_financials/2022/q2/Q2FY22-Press-Release.pdf",
  },
  {
    fq: 1,
    fy: 2022,
    filings: "https://s21.q4cdn.com/812015656/files/doc_financials/2022/q1/Q1-FY22-Earnings-News-Release.pdf",
  },
];

export function cscoDocsByLabel(): Map<string, CscoQuarterDocs> {
  const m = new Map<string, CscoQuarterDocs>();
  for (const d of CSCO_IR_QUARTER_DOCS) m.set(`Q${d.fq} ${d.fy}`, d);
  return m;
}
