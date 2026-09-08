/** Apple Newsroom CFS (slides) + q4cdn 10-Q / 10-K (filings) filename variants. */

const APPLE_Q4CDN = "https://s2.q4cdn.com/470004039/files";
const APPLE_NEWSROOM = "https://www.apple.com/newsroom/pdfs";

function yy2(fy: number): string {
  return String(fy % 100).padStart(2, "0");
}

/** Flat `FY22_Q2_…`, nested `fy2024-q2/`, and compact `fy2026q2/`. */
export function appleNewsroomConsolidatedStatementsCandidates(fy: number, fq: number): string[] {
  const yy = yy2(fy);
  const file = `FY${yy}_Q${fq}_Consolidated_Financial_Statements.pdf`;
  return [
    `${APPLE_NEWSROOM}/${file}`,
    `${APPLE_NEWSROOM}/fy${fy}-q${fq}/${file}`,
    `${APPLE_NEWSROOM}/fy${fy}q${fq}/${file}`,
  ];
}

export function apple10qCandidates(fy: number, fq: number): string[] {
  return [
    `${APPLE_Q4CDN}/doc_financials/${fy}/q${fq}/_10-Q-Q${fq}-${fy}-As-Filed.pdf`,
    `${APPLE_Q4CDN}/doc_financials/${fy}/q${fq}/_10-Q-Q${fq}-${fy}-(As-Filed).pdf`,
    `${APPLE_Q4CDN}/doc_earnings/${fy}/q${fq}/filing/10Q-Q${fq}-${fy}-as-filed.pdf`,
    `${APPLE_Q4CDN}/doc_earnings/${fy}/q${fq}/filing/_10-Q-Q${fq}-${fy}-As-Filed.pdf`,
  ];
}

/** FY24 10-K is posted as `10-Q4-2024-As-Filed.pdf` under doc_earnings. */
export function apple10kCandidates(fy: number): string[] {
  return [
    `${APPLE_Q4CDN}/doc_financials/${fy}/q4/_10-K-${fy}-(As-Filed).pdf`,
    `${APPLE_Q4CDN}/doc_earnings/${fy}/q4/filing/10-Q4-${fy}-As-Filed.pdf`,
    `${APPLE_Q4CDN}/doc_earnings/${fy}/q4/filing/10K-Q4-${fy}-as-filed.pdf`,
    `${APPLE_Q4CDN}/doc_earnings/${fy}/q4/filing/_10-K-Q4-${fy}-As-Filed.pdf`,
    `${APPLE_Q4CDN}/doc_earnings/${fy}/q4/filing/10-K-Q4-${fy}-As-Filed.pdf`,
    `${APPLE_Q4CDN}/doc_financials/${fy}/ar/_10-K-${fy}-As-Filed.pdf`,
  ];
}

export function appleFilingsCandidates(fy: number, fq: number): string[] {
  return fq === 4 ? apple10kCandidates(fy) : apple10qCandidates(fy, fq);
}
