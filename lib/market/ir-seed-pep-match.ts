/** PepsiCo (PEP) IR — calendar FY labels. Slides = Prepared Management Remarks; Filings = Earnings Release. Never transcript / 10-Q / SEC HTML / CAGNY. */

export type PepQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

/** PepsiCo reports on a 12/16-week fiscal calendar; catalog labels match issuer Qn YYYY. */
export const PEP_FY_END = "12-31";

const CDN = "https://investors.pepsico.com/docs/pepsico-5v9wci20/media/Files/investors";

export const PEP_IR_PAGES = [
  "https://www.pepsico.com/investors",
  "https://investors.pepsico.com/",
] as const;

function pepDocs(q: number, y: number): PepQuarterDocs {
  return {
    slides: `${CDN}/q${q}-${y}-prepared-management-remarks.pdf`,
    filings: `${CDN}/q${q}-${y}-earnings-release.pdf`,
  };
}

/** HTTP-verified catalog (Q1 2022 → Q2 2026). Q3/Q4 2026 not published yet. */
export const PEP_KNOWN_QUARTER_DOCS: Readonly<Record<string, PepQuarterDocs>> = {
  "Q2 2026": pepDocs(2, 2026),
  "Q1 2026": pepDocs(1, 2026),
  "Q4 2025": pepDocs(4, 2025),
  "Q3 2025": pepDocs(3, 2025),
  "Q2 2025": pepDocs(2, 2025),
  "Q1 2025": pepDocs(1, 2025),
  "Q4 2024": pepDocs(4, 2024),
  "Q3 2024": pepDocs(3, 2024),
  "Q2 2024": pepDocs(2, 2024),
  "Q1 2024": pepDocs(1, 2024),
  "Q4 2023": pepDocs(4, 2023),
  "Q3 2023": pepDocs(3, 2023),
  "Q2 2023": pepDocs(2, 2023),
  "Q1 2023": pepDocs(1, 2023),
  "Q4 2022": pepDocs(4, 2022),
  "Q3 2022": pepDocs(3, 2022),
  "Q2 2022": pepDocs(2, 2022),
  "Q1 2022": pepDocs(1, 2022),
};

export function isPepRejected(href: string, title = ""): boolean {
  const n = `${href} ${title}`.toLowerCase();
  return (
    n.includes("transcript") ||
    n.includes("10-q") ||
    n.includes("10-k") ||
    n.includes("cagny") ||
    n.includes("proxy") ||
    n.includes("sec.gov") ||
    /\.htm(?:l)?(?:$|[?#])/i.test(href)
  );
}

export function isPepIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    if (!(h === "investors.pepsico.com" || h === "pepsico.com" || h.endsWith(".pepsico.com"))) {
      return false;
    }
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergePepKnownQuarterDocs(): Map<string, PepQuarterDocs> {
  return new Map(Object.entries(PEP_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
