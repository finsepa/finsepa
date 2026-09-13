/** TotalEnergies (TTE) IR — calendar FY. Slides = Results presentation when published (mostly Q4); Filings = Results press release. Never transcript / dividend / half-year-only / HTML. */

export type TteQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const ORIGIN = "https://totalenergies.com";

function abs(path: string): string {
  return path.startsWith("http") ? path : `${ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

export const TTE_IR_PAGES = [`${ORIGIN}/investors/results`] as const;

/** HTTP-verified catalog from totalenergies.com/investors/results. */
export const TTE_KNOWN_QUARTER_DOCS: Readonly<Record<string, TteQuarterDocs>> = {
  "Q2 2026": {
    slides: null,
    filings: abs("/system/files/documents/totalenergies_pr-results-2q26_2026_en.pdf"),
  },
  "Q1 2026": {
    slides: null,
    filings: abs("/system/files/documents/totalenergies_1q26-results-press-release_2026.pdf"),
  },
  "Q4 2025": {
    slides: abs(
      "/sites/g/files/nytnzq121/files/documents/totalenergies_2025-results-and-2026-objectives-presentation_2026_en.pdf",
    ),
    filings: abs("/system/files/documents/totalenergies_pr-results-q4-2025_2026_en.pdf"),
  },
  "Q3 2025": {
    slides: null,
    filings: abs("/system/files/documents/totalenergies_pr-results-3q25_2025_en.pdf"),
  },
  "Q2 2025": {
    slides: null,
    filings: abs("/system/files/documents/totalenergies_2Q25-results-press-release_2025_en.pdf"),
  },
  "Q1 2025": {
    slides: null,
    filings: abs("/system/files/documents/totalenergies_1q25-results-press-release_2025.pdf"),
  },
  "Q4 2024": {
    slides: abs("/system/files/documents/totalenergies_2024_Results_and_2025_Objectives_presentation.pdf"),
    filings: abs("/system/files/documents/totalenergies_pr-results-q4-2024_2025_en.pdf"),
  },
  "Q3 2024": {
    slides: null,
    filings: abs("/system/files/documents/totalenergies_pr-results-q3-2024_2024_en_pdf.pdf"),
  },
  "Q2 2024": {
    slides: null,
    filings: abs("/system/files/documents/2024-07/totalenergies_2q-2024-results-press-release_2024_en_pdf.pdf"),
  },
  "Q1 2024": {
    slides: null,
    filings: abs("/system/files/documents/2024-04/totalenergies_pr-results-q1-2024_2024_en_pdf.pdf"),
  },
  "Q4 2023": {
    slides: abs(
      "/sites/g/files/nytnzq121/files/documents/2024-02/TotalEnergies_2023_Results_and_2024_Objectives_presentation.pdf",
    ),
    filings: abs("/sites/g/files/nytnzq121/files/documents/2024-02/TotalEnergies_PR_4Q23_Results.pdf"),
  },
  "Q3 2023": {
    slides: null,
    filings: abs("/system/files/documents/2023-10/CP_Q3_2023_Results.pdf"),
  },
  "Q2 2023": {
    slides: null,
    filings: abs("/system/files/documents/2023-07/CP_Q2_2023_Results.pdf"),
  },
  "Q1 2023": {
    slides: null,
    filings: abs("/system/files/documents/2023-04/totalenergies-1q23-results.pdf"),
  },
  "Q4 2022": {
    slides: abs("/system/files/documents/2023-02/TotalEnergies_2022_Results_2023_Objectives-presentation.pdf"),
    filings: abs("/system/files/documents/2023-02/TotalEnergies_4Q22_Results.pdf"),
  },
  "Q3 2022": {
    slides: null,
    filings: abs("/system/files/documents/2022-10/3Q22_Results.pdf"),
  },
  "Q2 2022": {
    slides: null,
    filings: abs("/system/files/documents/2022-07/2Q22_Results.pdf"),
  },
  "Q1 2022": {
    slides: null,
    filings: abs("/system/files/documents/2022-04/1Q22_Results.pdf"),
  },
};

export function isTteRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|transcript|dividend|half-?year|sustainab|climate|databook|\.xlsx|notes.?to.?the|accounts.?append/i.test(
    n,
  );
}

export function isTteIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (!(u.hostname === "totalenergies.com" || u.hostname.endsWith(".totalenergies.com"))) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeTteKnownQuarterDocs(): Map<string, TteQuarterDocs> {
  return new Map(Object.entries(TTE_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
