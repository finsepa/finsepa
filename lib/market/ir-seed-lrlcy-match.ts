/** L'Oréal IR: CB earnings presentation as slides, English CP press as filings. Never RFS / URD / CEO-division RIF decks. */

export type LrlcyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

function files(path: string): string {
  return `https://www.loreal-finance.com/system/files/${path}`;
}

export const LRLCY_IR_PAGES = [
  "https://www.loreal-finance.com/eng/annual-results",
  "https://www.loreal-finance.com/eng/half-year-results",
  "https://www.loreal-finance.com/eng/news-release",
] as const;

/**
 * Calendar quarters. Q1/Q3 are sales press only (no CB deck). H1/FY use Christophe Babule presentations.
 */
export const LRLCY_KNOWN_QUARTER_DOCS: Readonly<Record<string, LrlcyQuarterDocs>> = {
  "Q2 2026": {
    slides: files("2026-07/C.B.%20Presentation%20_%201H26_EN.pdf"),
    filings: files("2026-07/CP_1H26_EN%2029.07.pdf"),
  },
  "Q1 2026": {
    slides: null,
    filings: files("2026-04/CP_1Q26_EN%20v22.04.26.pdf"),
  },
  "Q4 2025": {
    slides: files("2026-07/C.B.%20Presentation%20_%20RIF26_EN%20V.13.02.2026%208h.pdf"),
    filings: files("2026-02/CPFY25ENv12.02%2017.00.pdf"),
  },
  "Q3 2025": {
    slides: null,
    filings: files("2025-10/CP_9M25_EN%20v21.10.pdf"),
  },
  "Q2 2025": {
    slides: files("2025-07/C.B.%20Presentation_1H25_EN%2030.07.pdf"),
    filings: files("2025-07/CP_1H25_EN.pdf"),
  },
  "Q1 2025": {
    slides: null,
    filings: files("2025-04/CP_1Q25_EN%20v17.04%20Final%20%281%29.pdf"),
  },
  "Q4 2024": {
    slides: files("2025-02/C.B.%20Presentation%20_%20RIF25%20_%20V06.02.2025_EN_20.00.pdf"),
    filings: files("2025-02/CP_FY24_EN_06.02.25%20v23h.pdf"),
  },
  "Q3 2024": {
    slides: null,
    filings: files("migrate-files/CP_Q3_2024_EN%2022.10.2024.pdf"),
  },
  "Q2 2024": {
    slides: files("migrate-files/H1%2024%20-%20CB%20Presentation%20-%20v30.07.24%20EN%20v10.30.pdf"),
    filings: null,
  },
  "Q4 2023": {
    slides: files("migrate-files/RIF24%20-%20CB%20Presentation%20EN.pdf"),
    filings: null,
  },
  "Q2 2023": {
    slides: files("migrate-files/H1%2023%20CB%20EN%2027%20July%202023%20version%20site.pdf"),
    filings: null,
  },
};

export function isLrlcyRejected(href: string): boolean {
  const n = decodeURIComponent(href).toLowerCase();
  return /sec\.gov|loreal_rfs|_rfs_|deu_|urd|universal.?registration|hieronimus|megarbane|cohen-welgryn|resultats-semestriels|_fr\.pdf|strategic-presentations/i.test(
    n,
  );
}

export function isLrlcyIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  return (
    (/loreal-finance\.com\/system\/files\/.+\.pdf/i.test(url) || /loreal\.com\/.+\.pdf/i.test(url)) &&
    !isLrlcyRejected(url)
  );
}

export function mergeLrlcyKnownQuarterDocs(): Map<string, LrlcyQuarterDocs> {
  return new Map(Object.entries(LRLCY_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
