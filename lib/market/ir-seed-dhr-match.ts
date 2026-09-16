/**
 * Danaher (DHR) IR — calendar FY.
 * Slides = Earnings Presentation (`/image/Q{n}+{y}+Danaher+Earnings+Presentation.pdf`).
 * Filings = press release `?asPDF` export (WebDriver InvestorRoom).
 * Never Non-GAAP / Supplement / 10-Q / overview / SEC HTML.
 */

export type DhrQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const IMAGE = "https://investors.danaher.com/image";
const IR = "https://investors.danaher.com";

function slides(q: 1 | 2 | 3 | 4, y: number): string {
  return `${IMAGE}/Q${q}+${y}+Danaher+Earnings+Presentation.pdf`;
}

export const DHR_IR_PAGES = [
  "https://investors.danaher.com/",
  "https://investors.danaher.com/quarterly-earnings",
] as const;

/** HEAD-verified Presentation + press `?asPDF` (Q1 2022 → Q2 2026). */
export const DHR_KNOWN_QUARTER_DOCS: Readonly<Record<string, DhrQuarterDocs>> = {
  "Q2 2026": {
    slides: slides(2, 2026),
    filings: `${IR}/2026-07-21-Danaher-Reports-Second-Quarter-2026-Results?asPDF`,
  },
  "Q1 2026": {
    slides: slides(1, 2026),
    filings: `${IR}/2026-04-21-Danaher-Reports-First-Quarter-2026-Results?asPDF`,
  },
  "Q4 2025": {
    slides: slides(4, 2025),
    filings: `${IR}/2026-01-28-Danaher-Reports-Fourth-Quarter-and-Full-Year-2025-Results?asPDF`,
  },
  "Q3 2025": {
    slides: slides(3, 2025),
    filings: `${IR}/2025-10-21-Danaher-Reports-Third-Quarter-2025-Results?asPDF`,
  },
  "Q2 2025": {
    slides: slides(2, 2025),
    filings: `${IR}/2025-07-22-Danaher-Reports-Second-Quarter-2025-Results?asPDF`,
  },
  "Q1 2025": {
    slides: slides(1, 2025),
    filings: `${IR}/2025-04-22-Danaher-Reports-First-Quarter-2025-Results?asPDF`,
  },
  "Q4 2024": {
    slides: slides(4, 2024),
    filings: `${IR}/2025-01-29-Danaher-Reports-Fourth-Quarter-and-Full-Year-2024-Results?asPDF`,
  },
  "Q3 2024": {
    slides: slides(3, 2024),
    filings: `${IR}/2024-10-22-Danaher-Reports-Third-Quarter-2024-Results?asPDF`,
  },
  "Q2 2024": {
    slides: slides(2, 2024),
    filings: `${IR}/2024-07-23-Danaher-Reports-Second-Quarter-2024-Results?asPDF`,
  },
  "Q1 2024": {
    slides: slides(1, 2024),
    filings: `${IR}/2024-04-23-Danaher-Reports-First-Quarter-2024-Results?asPDF`,
  },
  "Q4 2023": {
    slides: slides(4, 2023),
    filings: `${IR}/2024-01-30-Danaher-Reports-Fourth-Quarter-and-Full-Year-2023-Results?asPDF`,
  },
  "Q3 2023": {
    slides: slides(3, 2023),
    filings: `${IR}/2023-10-24-Danaher-Reports-Third-Quarter-2023-Results?asPDF`,
  },
  "Q2 2023": {
    slides: slides(2, 2023),
    filings: `${IR}/2023-07-25-Danaher-Reports-Second-Quarter-2023-Results?asPDF`,
  },
  "Q1 2023": {
    slides: slides(1, 2023),
    filings: `${IR}/2023-04-25-Danaher-Reports-First-Quarter-2023-Results?asPDF`,
  },
  "Q4 2022": {
    slides: slides(4, 2022),
    filings: `${IR}/2023-01-24-Danaher-Reports-Fourth-Quarter-and-Full-Year-2022-Results?asPDF`,
  },
  "Q3 2022": {
    slides: slides(3, 2022),
    filings: `${IR}/2022-10-20-Danaher-Reports-Third-Quarter-2022-Results?asPDF`,
  },
  "Q2 2022": {
    slides: slides(2, 2022),
    filings: `${IR}/2022-07-21-Danaher-Reports-Second-Quarter-2022-Results?asPDF`,
  },
  "Q1 2022": {
    slides: slides(1, 2022),
    filings: `${IR}/2022-04-21-Danaher-Reports-First-Quarter-2022-Results?asPDF`,
  },
};

export function isDhrRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|non[-_\s]?gaap|reconciliat|supplement|earnings[-_\s]*note|10-?q|10-?k|overview|webcast|transcript|events-presentations/i.test(
    n,
  );
}

/** Danaher InvestorRoom press export (`?asPDF`) — PDF bytes, no `.pdf` suffix. */
export function isDhrAsPdfUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (!(host === "investors.danaher.com" || host.endsWith(".danaher.com"))) return false;
    if (!u.searchParams.has("asPDF")) return false;
    if (!/danaher-reports/i.test(u.pathname)) return false;
    return !isDhrRejected(url);
  } catch {
    return false;
  }
}

export function isDhrIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  if (isDhrAsPdfUrl(url)) return true;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (
      !(
        host === "investors.danaher.com" ||
        host === "filecache.investorroom.com" ||
        host.endsWith(".danaher.com") ||
        host.endsWith(".investorroom.com")
      )
    ) {
      return false;
    }
    if (!/\.pdf(?:$|[?#])/i.test(u.pathname) && !/\.pdf(?:$|[?#])/i.test(url)) return false;
    if (host.includes("danaher.com") && !u.pathname.includes("/image/")) return false;
    if (host === "filecache.investorroom.com" && !u.pathname.includes("/mr5ir_danaher/")) return false;
    return !isDhrRejected(url);
  } catch {
    return false;
  }
}

export function mergeDhrKnownQuarterDocs(): Map<string, DhrQuarterDocs> {
  return new Map(Object.entries(DHR_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
