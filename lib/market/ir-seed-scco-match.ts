/**
 * Southern Copper (SCCO) IR — calendar FY.
 * Slides = results presentation (`pp*.pdf`); Filings = press release (`pr*.pdf`).
 * Host: southerncoppercorp.com wp-content. Never SEC HTML / company-wide marketing decks as fillers.
 */

export type SccoQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const SCCO_IR_PAGES = [
  "https://southerncoppercorp.com/eng/",
  "https://southerncoppercorp.com/",
] as const;

/**
 * %PDF-probed presentation (pp) + press (pr) paths. Gaps left empty (yellow).
 * Q2 2024 / Q1 2022 have no stable IR PDFs found; Q1 2026 slides empty (no earnings pp near report).
 */
export const SCCO_KNOWN_QUARTER_DOCS: Readonly<Record<string, SccoQuarterDocs>> = {
  "Q2 2026": {
    slides: "https://southerncoppercorp.com/wp-content/uploads/2026/07/pp260722.pdf",
    filings: "https://southerncoppercorp.com/wp-content/uploads/2026/07/pr260721.pdf",
  },
  "Q1 2026": {
    slides: null,
    filings: "https://southerncoppercorp.com/wp-content/uploads/2026/04/pr260423.pdf",
  },
  "Q4 2025": {
    slides: "https://southerncoppercorp.com/eng/wp-content/uploads/sites/2/2026/01/pp260128.pdf",
    filings: "https://southerncoppercorp.com/eng/wp-content/uploads/sites/2/2026/01/pr260127.pdf",
  },
  "Q3 2025": {
    slides: "https://southerncoppercorp.com/eng/wp-content/uploads/sites/2/2025/11/pp251029_2.pdf",
    filings: "https://southerncoppercorp.com/wp-content/uploads/2025/10/pr251028.pdf",
  },
  "Q2 2025": {
    slides: "https://southerncoppercorp.com/eng/wp-content/uploads/sites/2/2025/07/pp250730.pdf",
    filings: "https://southerncoppercorp.com/wp-content/uploads/2025/07/pr250728.pdf",
  },
  "Q1 2025": {
    slides: "https://southerncoppercorp.com/eng/wp-content/uploads/sites/2/2025/07/pp250430.pdf",
    filings: "https://southerncoppercorp.com/eng/wp-content/uploads/sites/2/2025/04/pr250424.pdf",
  },
  "Q4 2024": {
    slides: null,
    filings: "https://southerncoppercorp.com/wp-content/uploads/2025/01/pr250123.pdf",
  },
  "Q3 2024": {
    slides: "https://southerncoppercorp.com/wp-content/uploads/2024/10/pp241028.pdf",
    filings: "https://southerncoppercorp.com/wp-content/uploads/2024/10/pr241021.pdf",
  },
  "Q2 2024": {
    slides: null,
    filings: "https://southerncoppercorp.com/wp-content/uploads/2024/07/pr240719.pdf",
  },
  "Q1 2024": {
    slides: null,
    filings: "https://southerncoppercorp.com/wp-content/uploads/2024/04/pr240425.pdf",
  },
  "Q4 2023": {
    slides: "https://southerncoppercorp.com/wp-content/uploads/2024/02/pp240202.pdf",
    filings: "https://southerncoppercorp.com/wp-content/uploads/2024/01/pr240125.pdf",
  },
  "Q3 2023": {
    slides: null,
    filings: "https://southerncoppercorp.com/wp-content/uploads/2023/10/pr231024.pdf",
  },
  "Q2 2023": {
    slides: null,
    filings: "https://southerncoppercorp.com/wp-content/uploads/2023/07/pr230727.pdf",
  },
  "Q1 2023": {
    slides: "https://southerncoppercorp.com/wp-content/uploads/2023/04/pp230427.pdf",
    filings: "https://southerncoppercorp.com/wp-content/uploads/2023/04/pr230426.pdf",
  },
  "Q4 2022": {
    slides: null,
    filings: "https://southerncoppercorp.com/wp-content/uploads/2023/01/pr230126.pdf",
  },
  "Q3 2022": {
    slides: "https://southerncoppercorp.com/wp-content/uploads/2022/10/pp221028.pdf",
    filings: "https://southerncoppercorp.com/wp-content/uploads/2022/10/pr221027.pdf",
  },
  "Q2 2022": {
    slides: null,
    filings: "https://southerncoppercorp.com/eng/wp-content/uploads/sites/2/2022/07/pr220721.pdf",
  },
  "Q1 2022": {
    slides: null,
    filings: null,
  },
};

export function isSccoRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|transcript|10-?q|10-?k|webcast|investor[-_\s]*day|company[-_\s]*presentation|\.xls/i.test(
    n,
  );
}

export function isSccoIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (
      !(
        host === "southerncoppercorp.com" ||
        host === "www.southerncoppercorp.com" ||
        host.endsWith(".southerncoppercorp.com")
      )
    ) {
      return false;
    }
    if (!u.pathname.includes("/wp-content/uploads/")) return false;
    if (!/\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    const file = u.pathname.split("/").pop()?.toLowerCase() ?? "";
    const ok = /^pp\d{6}/i.test(file) || /^pr\d{6}/i.test(file);
    return ok && !isSccoRejected(url);
  } catch {
    return false;
  }
}

export function mergeSccoKnownQuarterDocs(): Map<string, SccoQuarterDocs> {
  return new Map(Object.entries(SCCO_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
