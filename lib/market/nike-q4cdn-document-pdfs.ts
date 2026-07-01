/**
 * Nike IR PDFs on Q4 CDN (`s1.q4cdn.com/806093406`).
 * Filenames use `Q{n}-FY{yy}-…` under `doc_financials/{fy}/q{n}/`.
 */

export const NIKE_Q4CDN_FINANCIALS_BASE =
  "https://s1.q4cdn.com/806093406/files/doc_financials";

/** Hand-verified URLs when patterned HEAD probes miss (odd suffix hashes). */
export const NIKE_KNOWN_DOCUMENT_URLS: Partial<
  Record<`${number}-q${1 | 2 | 3 | 4}`, { slides?: string; filings: string }>
> = {
  "2026-q2": {
    filings: `${NIKE_Q4CDN_FINANCIALS_BASE}/2026/q2/Q2-FY26-Exhibit-99-1ER-FINAL-33-97.pdf`,
  },
};

function quarterDir(fy: number, fq: number): string {
  return `${NIKE_Q4CDN_FINANCIALS_BASE}/${fy}/q${fq}`;
}

function fySuffix(fy: number): string {
  return String(fy % 100).padStart(2, "0");
}

export function nikePresentationCandidateUrls(fq: number, fy: number): string[] {
  const yy = fySuffix(fy);
  const dir = quarterDir(fy, fq);
  return [
    `${dir}/Q${fq}-FY${yy}-Quarterly-Presentation-FINAL.pdf`,
    `${dir}/Q${fq}-FY${yy}-Earnings-Presentation-FINAL.pdf`,
    `${dir}/Q${fq}-FY${yy}-Investor-Presentation-FINAL.pdf`,
    `${dir}/NIKE-F${fq}Q${yy}-Quarterly-Presentation-FINAL.pdf`,
    `${dir}/NKE-F${fq}Q${yy}-Quarterly-Presentation-FINAL.pdf`,
  ];
}

export function nikeFilingCandidateUrls(fq: number, fy: number): string[] {
  const yy = fySuffix(fy);
  const dir = quarterDir(fy, fq);
  const known = NIKE_KNOWN_DOCUMENT_URLS[`${fy}-q${fq}` as keyof typeof NIKE_KNOWN_DOCUMENT_URLS];
  const patterned = [
    `${dir}/Q${fq}-FY${yy}-Exhibit-99-1ER-FINAL.pdf`,
    `${dir}/Q${fq}-FY${yy}-Earnings-Release-FINAL.pdf`,
    `${dir}/Q${fq}-FY${yy}-Earnings-Release.pdf`,
    `${dir}/NKE-Q${fq}-${fy}-Earnings-Release-FINAL.pdf`,
    `${dir}/NKE-F${fq}Q${yy}-Earnings-Release-FINAL.pdf`,
  ];
  if (known?.filings) return [known.filings, ...patterned];
  return patterned;
}

export function nikeKnownPresentationUrl(fq: number, fy: number): string | null {
  const known = NIKE_KNOWN_DOCUMENT_URLS[`${fy}-q${fq}` as keyof typeof NIKE_KNOWN_DOCUMENT_URLS];
  return known?.slides ?? null;
}
