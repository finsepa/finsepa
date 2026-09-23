/**
 * TJX Companies (TJX) IR — January FY (fy ends ~Jan 31).
 * Filings-only: earnings press release PDF (no IR slide deck).
 * Host: www.tjx.com/docs/default-source/investor-docs/quarterly-results/.
 * Never 10-Q / 10-K / reconciliations / SEC HTML.
 */

export type TjxQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const TJX_QR =
  "https://www.tjx.com/docs/default-source/investor-docs/quarterly-results";

function press(filename: string): string {
  return `${TJX_QR}/${filename}`;
}

export const TJX_IR_PAGES = [
  "https://www.tjx.com/investors/financial-information/quarterly-results",
  "https://investor.tjx.com/",
] as const;

/** January FY labels (Q4 2022 → Q2 2027). Slides always null. */
export const TJX_KNOWN_QUARTER_DOCS: Readonly<Record<string, TjxQuarterDocs>> = {
  "Q2 2027": {
    slides: null,
    filings: press("tjx-second-quarter-fiscal-year-2027-earnings-press-release.pdf"),
  },
  "Q1 2027": {
    slides: null,
    filings: press("tjx-first-quarter-fiscal-year-2027-earnings-press-release.pdf"),
  },
  "Q4 2026": {
    slides: null,
    filings: press("tjx-fourth-quarter-fiscal-year-2026-earnings-press-release.pdf"),
  },
  "Q3 2026": {
    slides: null,
    filings: press("tjx-third-quarter-fiscal-year-2026-earnings-press-release.pdf"),
  },
  "Q2 2026": {
    slides: null,
    filings: press("tjx-second-quarter-fiscal-year-2026-earnings-press-release.pdf"),
  },
  "Q1 2026": {
    slides: null,
    filings: press("tjx-first-quarter-fiscal-year-2026-earnings-press-release.pdf"),
  },
  "Q4 2025": {
    slides: null,
    filings: press("tjx-fourth-quarter-fiscal-year-2025-earnings-press-release.pdf"),
  },
  "Q3 2025": {
    slides: null,
    filings: press("tjx-third-quarter-fiscal-year-2025-earnings-press-release.pdf"),
  },
  "Q2 2025": {
    slides: null,
    filings: press("tjx-second-quarter-fiscal-year-2025-earnings-press-release.pdf"),
  },
  "Q1 2025": {
    slides: null,
    filings: press("tjx-first-quarter-fiscal-year-2025-earnings-press-release.pdf"),
  },
  "Q4 2024": {
    slides: null,
    filings: press("tjx-fourth-quarter-fiscal-year-2024-earnings-press-release.pdf"),
  },
  "Q3 2024": {
    slides: null,
    filings: press("tjx-third-quarter-fiscal-year-2024-earnings-press-release.pdf"),
  },
  "Q2 2024": {
    slides: null,
    filings: press("tjx-second-quarter-fiscal-year-2024-earnings-press-release.pdf"),
  },
  "Q1 2024": {
    slides: null,
    filings: press("tjx-first-quarter-fiscal-year-2024-earnings-press-release.pdf"),
  },
  "Q4 2023": {
    slides: null,
    filings: press("tjx-fourth-quarter-fiscal-year-2023-earnings-press-release.pdf"),
  },
  "Q3 2023": {
    slides: null,
    filings: press("tjx-third-quarter-fiscal-year-2023-earnings-press-release.pdf"),
  },
  "Q2 2023": {
    slides: null,
    filings: press("tjx-second-quarter-fiscal-year-2023-earnings-press-release.pdf"),
  },
  "Q1 2023": {
    slides: null,
    filings: press("tjx-first-quarter-fiscal-year-2023-earnings-press-release.pdf"),
  },
  "Q4 2022": {
    slides: null,
    filings: press("tjx-fourth-quarter-fiscal-year-2022-earnings-press-release.pdf"),
  },
};

export function isTjxRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|reconcil|form[-_\s]*10|webcast|transcript|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(
    n,
  );
}

export function isTjxIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (!(host === "tjx.com" || host === "www.tjx.com" || host.endsWith(".tjx.com"))) {
      return false;
    }
    if (!/\/docs\/default-source\/investor-docs\/quarterly-results\//i.test(u.pathname)) {
      return false;
    }
    if (!/\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    if (!/earnings[-_\s]*press[-_\s]*release/i.test(u.pathname)) return false;
    return !isTjxRejected(url);
  } catch {
    return false;
  }
}

export function mergeTjxKnownQuarterDocs(): Map<string, TjxQuarterDocs> {
  return new Map(Object.entries(TJX_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
