/**
 * ConocoPhillips (COP) IR — calendar FY.
 * Slides = earnings release/call deck; Filings = earnings release PDF.
 * Never supplemental / transcript / stockholder Q&A / SEC HTML.
 * Host: static.conocophillips.com/files/resources/
 */

export type CopQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const R = "https://static.conocophillips.com/files/resources";

function res(file: string): string {
  return `${R}/${file}`;
}

export const COP_IR_PAGES = [
  "https://www.conocophillips.com/investor-relations/",
  "https://www.conocophillips.com/investor-relations/investor-presentations/earnings-archive/",
] as const;

/** Archive + IR hub; %PDF-probed samples. Q1 2022 → Q2 2026. */
export const COP_KNOWN_QUARTER_DOCS: Readonly<Record<string, CopQuarterDocs>> = {
  "Q2 2026": {
    slides: res("2q26_earnings_release_deck.pdf"),
    filings: res("2q26_earnings_release_final.pdf"),
  },
  "Q1 2026": {
    slides: res("1q26_earnings_release_deck.pdf"),
    filings: res("1q26_earnings_release_final.pdf"),
  },
  "Q4 2025": {
    slides: res("4q25_earnings_release_deck.pdf"),
    filings: res("4q25_earnings_release-final.pdf"),
  },
  "Q3 2025": {
    slides: res("3q25_earnings_release_deck.pdf"),
    filings: res("3q25_earnings_release.pdf"),
  },
  "Q2 2025": {
    slides: res("2q25_earnings_release_deck.pdf"),
    filings: res("2q25-earnings-release.pdf"),
  },
  "Q1 2025": {
    slides: res("1q25-earnings-release-deck.pdf"),
    filings: res("1q25-earnings-release.pdf"),
  },
  "Q4 2024": {
    slides: res("4q24-earnings-release-deck.pdf"),
    filings: res("4q24-earnings-release.pdf"),
  },
  "Q3 2024": {
    slides: res("3q24-earnings-release-deck.pdf"),
    filings: res("3q24-earnings-release.pdf"),
  },
  "Q2 2024": {
    slides: res("2q24-earnings-call-deck.pdf"),
    filings: res("2q24-earnings-release.pdf"),
  },
  "Q1 2024": {
    slides: res("1q24-earnings-call-deck.pdf"),
    filings: res("1q24-earnings-release.pdf"),
  },
  "Q4 2023": {
    slides: res("4q23-earnings-call-deck.pdf"),
    filings: res("4q23-earnings-release.pdf"),
  },
  "Q3 2023": {
    slides: res("3q23-earnings-call-deck.pdf"),
    filings: res("3q23-earnings-release.pdf"),
  },
  "Q2 2023": {
    slides: res("2q23_earnings_call_deck_final-080223.pdf"),
    filings: res("2q23_earnings_release-final-080223.pdf"),
  },
  "Q1 2023": {
    slides: res("1q23-earnings-call-deck.pdf"),
    filings: res("1q23-earnings-release.pdf"),
  },
  "Q4 2022": {
    slides: res("4q22-earnings-call-deck.pdf"),
    filings: res("4q22-earnings-release.pdf"),
  },
  "Q3 2022": {
    slides: res("3q22-earnings-call-deck.pdf"),
    filings: res("3q22-earnings-release.pdf"),
  },
  "Q2 2022": {
    slides: res("2q22-earnings-call-deck.pdf"),
    filings: res("2q22-earnings-release.pdf"),
  },
  "Q1 2022": {
    slides: res("1q22-earnings-call-deck.pdf"),
    filings: res("1q22-earnings-release.pdf"),
  },
};

export function isCopRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|transcript|supplemental|stockholder[-_\s]?question|10-?q|10-?k|8-?k|webcast|investor[-_\s]?day/i.test(
    n,
  );
}

export function isCopIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const okHost =
      host === "static.conocophillips.com" ||
      host === "www.conocophillips.com" ||
      host.endsWith(".conocophillips.com");
    if (!okHost) return false;
    if (!/\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    if (!u.pathname.includes("/files/resources/")) return false;
    return !isCopRejected(url);
  } catch {
    return false;
  }
}

export function mergeCopKnownQuarterDocs(): Map<string, CopQuarterDocs> {
  return new Map(Object.entries(COP_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
