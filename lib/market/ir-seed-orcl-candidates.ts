/**
 * Oracle q4cdn candidates. FY ends May 31.
 * Press releases: doc_financials/{fy}/q{q}/{q}q{yy}-pressrelease-{Month}-final*.pdf
 * Recent decks: doc_earnings/{fy}/q{q}/presentation/Presentation-Slides-Q{q}-{yy}.pdf
 */

export const ORCL_Q4CDN_FILES = "https://s23.q4cdn.com/440135859/files";

/** Calendar month named in press-release filename for each Oracle fiscal quarter. */
const ORCL_PRESS_MONTHS: Record<number, string[]> = {
  1: ["September", "Sept"],
  2: ["December", "Dec"],
  3: ["March", "Mar"],
  4: ["June", "Jun"],
};

function yy2(fy: number): string {
  return String(fy % 100).padStart(2, "0");
}

export type OrclQuarterDocs = { slides?: string; filings?: string };

function qLabel(fq: number, fy: number): string {
  return `Q${fq} ${fy}`;
}

/** GET-verified press paths (capital Q folders / no `-final` suffix). */
export const ORCL_KNOWN_QUARTER_DOCS: Readonly<Record<string, OrclQuarterDocs>> = {
  [qLabel(3, 2022)]: {
    filings: `${ORCL_Q4CDN_FILES}/doc_financials/2022/q3/3q22-pressrelease-March.pdf`,
  },
  [qLabel(1, 2024)]: {
    filings: `${ORCL_Q4CDN_FILES}/doc_financials/2024/Q1/1q24-pressrelease-September-final.pdf`,
  },
  [qLabel(2, 2024)]: {
    filings: `${ORCL_Q4CDN_FILES}/doc_financials/2024/Q2/2q24-pressrelease-December-final.pdf`,
  },
  [qLabel(4, 2026)]: {
    slides: `${ORCL_Q4CDN_FILES}/doc_earnings/2026/q4/presentation/Presentation-Slides-Q4-26.pdf`,
  },
};

export function orclKnownDocsForQuarter(fq: number, fy: number): OrclQuarterDocs | undefined {
  return ORCL_KNOWN_QUARTER_DOCS[qLabel(fq, fy)];
}

export function orclSlidesCandidateUrls(fq: number, fy: number): string[] {
  const yy = yy2(fy);
  const base = ORCL_Q4CDN_FILES;
  return [
    `${base}/doc_earnings/${fy}/q${fq}/presentation/Presentation-Slides-Q${fq}-${yy}.pdf`,
    `${base}/doc_financials/${fy}/q${fq}/presentation/Presentation-Slides-Q${fq}-${yy}.pdf`,
  ];
}

export function orclFilingsCandidateUrls(fq: number, fy: number): string[] {
  const yy = yy2(fy);
  const base = ORCL_Q4CDN_FILES;
  const out: string[] = [
    `${base}/doc_earnings/${fy}/q${fq}/earnings-result/${fq}q${yy}-pressrelease-final.pdf`,
    `${base}/doc_financials/${fy}/q${fq}/${fq}q${yy}-pressrelease-final.pdf`,
    `${base}/doc_financials/${fy}/Q${fq}/${fq}q${yy}-pressrelease-final.pdf`,
  ];
  for (const month of ORCL_PRESS_MONTHS[fq] ?? []) {
    out.push(
      `${base}/doc_financials/${fy}/q${fq}/${fq}q${yy}-pressrelease-${month}-final.pdf`,
      `${base}/doc_financials/${fy}/q${fq}/${fq}q${yy}-pressrelease-${month}-FINAL.pdf`,
      `${base}/doc_financials/${fy}/q${fq}/${fq}q${yy}-pressrelease-${month}-final_.pdf`,
      `${base}/doc_financials/${fy}/q${fq}/${fq}q${yy}-pressrelease-${month}.pdf`,
      `${base}/doc_financials/${fy}/Q${fq}/${fq}q${yy}-pressrelease-${month}-final.pdf`,
      `${base}/doc_financials/${fy}/Q${fq}/${fq}q${yy}-pressrelease-${month}.pdf`,
    );
  }
  const known = orclKnownDocsForQuarter(fq, fy);
  if (known?.filings) out.push(known.filings);
  return out;
}
