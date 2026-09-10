/** Netflix IR: Letter to Shareholders as filings. No public quarterly slide deck. Never transcripts or XLS. */

export type NflxQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const NFLX_Q4CDN = "https://s22.q4cdn.com/959853165/files/doc_financials";

export function nflxShareholderLetterCandidates(fq: number, fy: number): string[] {
  const yy = String(fy).slice(-2);
  const dir = `${NFLX_Q4CDN}/${fy}/q${fq}`;
  return [
    `${dir}/FINAL-Q${fq}-${yy}-Shareholder-Letter.pdf`,
    `${dir}/Final-Q${fq}-${yy}-Shareholder-Letter.pdf`,
    `${dir}/NEW-FINAL-Q${fq}-${yy}-Shareholder-Letter.pdf`,
    `${dir}/COMBINED-Q${fq}-${yy}-Shareholder-Letter-V2.pdf`,
    `${dir}/COMBINED-Q${fq}-${yy}-Shareholder-Letter.pdf`,
  ];
}

/** HEAD-verified Letter to Shareholders PDFs. Slides stay empty — Netflix does not publish a quarterly deck. */
export const NFLX_KNOWN_QUARTER_DOCS: Readonly<Record<string, NflxQuarterDocs>> = {
  "Q2 2026": { slides: null, filings: nflxShareholderLetterCandidates(2, 2026)[0]! },
  "Q1 2026": { slides: null, filings: nflxShareholderLetterCandidates(1, 2026)[0]! },
  "Q4 2025": { slides: null, filings: nflxShareholderLetterCandidates(4, 2025)[0]! },
  "Q3 2025": { slides: null, filings: nflxShareholderLetterCandidates(3, 2025)[0]! },
  "Q2 2025": { slides: null, filings: nflxShareholderLetterCandidates(2, 2025)[0]! },
  "Q1 2025": { slides: null, filings: `${NFLX_Q4CDN}/2025/q1/COMBINED-Q1-25-Shareholder-Letter-V2.pdf` },
  "Q4 2024": { slides: null, filings: nflxShareholderLetterCandidates(4, 2024)[0]! },
  "Q3 2024": { slides: null, filings: nflxShareholderLetterCandidates(3, 2024)[0]! },
  "Q2 2024": { slides: null, filings: nflxShareholderLetterCandidates(2, 2024)[0]! },
  "Q1 2024": { slides: null, filings: nflxShareholderLetterCandidates(1, 2024)[0]! },
  "Q3 2023": { slides: null, filings: nflxShareholderLetterCandidates(3, 2023)[0]! },
  "Q2 2023": { slides: null, filings: nflxShareholderLetterCandidates(2, 2023)[0]! },
  "Q4 2023": { slides: null, filings: `${NFLX_Q4CDN}/2023/q4/NEW-FINAL-Q4-23-Shareholder-Letter.pdf` },
  "Q1 2023": { slides: null, filings: `${NFLX_Q4CDN}/2023/q1/Final-Q1-23-Shareholder-Letter.pdf` },
  "Q4 2022": { slides: null, filings: nflxShareholderLetterCandidates(4, 2022)[0]! },
  "Q3 2022": { slides: null, filings: nflxShareholderLetterCandidates(3, 2022)[0]! },
  "Q2 2022": { slides: null, filings: nflxShareholderLetterCandidates(2, 2022)[0]! },
  "Q1 2022": { slides: null, filings: nflxShareholderLetterCandidates(1, 2022)[0]! },
};

export const NFLX_IR_PAGES = [
  "https://ir.netflix.net/financials/quarterly-earnings/default.aspx",
] as const;

export function mergeNflxKnownQuarterDocs(
  fromHtml: Map<string, NflxQuarterDocs>,
): Map<string, NflxQuarterDocs> {
  const out = new Map(fromHtml);
  for (const [label, known] of Object.entries(NFLX_KNOWN_QUARTER_DOCS)) {
    const cur = out.get(label) ?? { slides: null, filings: null };
    out.set(label, {
      slides: null,
      filings: cur.filings ?? known.filings,
    });
  }
  return out;
}

export function isNflxRejected(href: string): boolean {
  const n = decodeURIComponent(href).toLowerCase();
  return /\.xls|\.xlsx|transcript|sec\.gov|presentation|slide/i.test(n);
}
