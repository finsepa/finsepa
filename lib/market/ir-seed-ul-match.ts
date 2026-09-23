/**
 * Unilever ADR (UL) IR — calendar FY.
 * Slides = Results presentation PDF; Filings = Full announcement PDF.
 * Host: www.unilever.com/files/ (flat or UUID subfolder). Never transcript / highlights / SEC HTML.
 * Pre-Q4’23 archive mostly empty on current CDN (leave null).
 */

export type UlQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const UL_FILES = "https://www.unilever.com/files";

function file(name: string): string {
  return `${UL_FILES}/${name}`;
}

export const UL_IR_PAGES = [
  "https://www.unilever.com/investors/results-events/",
  "https://www.unilever.com/investors/results-events/results-events-webcasts/",
] as const;

/** Results-events webcast overviews (Q1 2022 → Q2 2026). */
export const UL_KNOWN_QUARTER_DOCS: Readonly<Record<string, UlQuarterDocs>> = {
  "Q1 2022": { slides: null, filings: null },
  "Q2 2022": { slides: null, filings: null },
  "Q3 2022": { slides: null, filings: null },
  "Q4 2022": { slides: null, filings: null },
  "Q1 2023": {
    slides: null,
    filings: file("9beca798-0d56-48a1-a390-0260ae42f546/ir-q1-2023-full-announcement.pdf"),
  },
  "Q2 2023": { slides: null, filings: null },
  "Q3 2023": {
    slides: null,
    filings: file("6e7c3e28-0eb0-4b59-b958-ed7f3cff1a62/ir-q3-2023-full-announcement.pdf"),
  },
  "Q4 2023": {
    slides: file("ir-q4-2023-results-presentation.pdf"),
    filings: file("ir-q4-2023-full-announcement.pdf"),
  },
  "Q1 2024": {
    slides: file("ir-q1-2024-results-presentation.pdf"),
    filings: file("ir-q1-2024-full-announcement.pdf"),
  },
  "Q2 2024": {
    slides: file("ir-q2-2024-results-presentation.pdf"),
    filings: file("ir-q2-2024-full-announcement.pdf"),
  },
  "Q3 2024": {
    slides: file("ir-q3-2024-results-presentation.pdf"),
    filings: file("ir-q3-2024-full-announcement.pdf"),
  },
  "Q4 2024": {
    slides: file("ir-q4-2024-results-presentation.pdf"),
    filings: file("ir-q4-2024-full-announcement.pdf"),
  },
  "Q1 2025": {
    slides: file("ir-q1-2025-results-presentation.pdf"),
    filings: file("ir-q1-2025-full-announcement.pdf"),
  },
  "Q2 2025": {
    slides: file("ir-q2-2025-presentation.pdf"),
    filings: file("ir-q2-2025-full-announcement.pdf"),
  },
  "Q3 2025": {
    slides: file("ir-q3-2025-presentation.pdf"),
    filings: file("q3-2025-full-announcement.pdf"),
  },
  "Q4 2025": {
    slides: file("q4-2025-presentation.pdf"),
    filings: file("ir-q4-2025-full-announcement.pdf"),
  },
  "Q1 2026": {
    slides: file("unilever-q1-2026-presentation.pdf"),
    filings: file("unilever-q1-2026-full-announcement.pdf"),
  },
  "Q2 2026": {
    slides: file("unilever-q2-2026-results-presentation.pdf"),
    filings: file("unilever-q2-2026-results-full-announcement.pdf"),
  },
};

export function isUlRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|transcript|highlights|webcast|key[-_\s]*highlights|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(
    n,
  );
}

export function isUlIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (!(host === "unilever.com" || host === "www.unilever.com" || host.endsWith(".unilever.com"))) {
      return false;
    }
    // Flat `/files/name.pdf` or UUID subfolder `/files/{uuid}/name.pdf`.
    if (!/\/files\/(?:[a-f0-9-]{36}\/)?[^/]+\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    return !isUlRejected(url);
  } catch {
    return false;
  }
}

export function mergeUlKnownQuarterDocs(): Map<string, UlQuarterDocs> {
  return new Map(Object.entries(UL_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
