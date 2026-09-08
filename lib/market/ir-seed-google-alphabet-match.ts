/** Alphabet (GOOGL / GOOG) q4cdn earnings PDF path builders. */

export const ALPHABET_Q4_FINANCIALS = "https://s206.q4cdn.com/479360582/files/doc_financials";

/**
 * Dated 10-Q / 10-K filenames Alphabet used before the stable `goog-10-q-q{n}-{year}.pdf` pattern.
 * Do not reuse earnings-release PDFs as filings.
 */
const ALPHABET_KNOWN_FILINGS: Readonly<Record<string, readonly string[]>> = {
  "Q1 2022": [`${ALPHABET_Q4_FINANCIALS}/2022/q1/20220427-alphabet-10q.pdf`],
  "Q2 2022": [`${ALPHABET_Q4_FINANCIALS}/2022/q2/20220726-alphabet-10q.pdf`],
  "Q3 2022": [`${ALPHABET_Q4_FINANCIALS}/2022/q3/20221025-alphabet-10q.pdf`],
  "Q1 2023": [`${ALPHABET_Q4_FINANCIALS}/2023/q1/20230426-alphabet-10q.pdf`],
  "Q2 2023": [`${ALPHABET_Q4_FINANCIALS}/2023/q2/goog-10-q-q2-2023-4.pdf`],
  "Q4 2023": [`${ALPHABET_Q4_FINANCIALS}/2023/q4/goog-10-k-2023-final.pdf`],
};

/** GET-verified 10-Q / 10-K when q4cdn HEAD 404s. Never the earnings-release PDF. */
export function alphabetKnownFilingUrl(fiscalYear: number, fiscalQuarter: number): string | undefined {
  return ALPHABET_KNOWN_FILINGS[`Q${fiscalQuarter} ${fiscalYear}`]?.[0];
}

export function alphabetSlidesCandidates(fiscalYear: number, fiscalQuarter: number): string[] {
  const fy = fiscalYear;
  const fq = fiscalQuarter;
  const folder = `${ALPHABET_Q4_FINANCIALS}/${fy}/q${fq}`;
  return [
    `${folder}/${fy}q${fq}-alphabet-earnings-slides.pdf`,
    `${folder}/${fy}Q${fq}-alphabet-earnings-slides.pdf`,
    // Pre-2025 quarters published an earnings-release PDF instead of a slide deck.
    `${folder}/${fy}q${fq}-alphabet-earnings-release.pdf`,
  ];
}

export function alphabetFilingCandidates(fiscalYear: number, fiscalQuarter: number): string[] {
  const fy = fiscalYear;
  const fq = fiscalQuarter;
  const folder = `${ALPHABET_Q4_FINANCIALS}/${fy}/q${fq}`;
  const known = ALPHABET_KNOWN_FILINGS[`Q${fq} ${fy}`] ?? [];
  if (fq === 4) {
    return [
      ...known,
      `${folder}/goog-10-k-${fy}.pdf`,
      `${folder}/GOOG-10-K-${fy}.pdf`,
      `${folder}/goog-10-k-${fy}-final.pdf`,
    ];
  }
  return [
    ...known,
    `${folder}/goog-10-q-q${fq}-${fy}.pdf`,
    `${folder}/GOOG-10-Q-Q${fq}-${fy}.pdf`,
  ];
}
