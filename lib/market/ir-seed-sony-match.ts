/**
 * Sony Group ADR (SONY) IR — FY ends 03-31 (issuer fiscal labels).
 * Slides = Presentation (`*_sonypre.pdf`); Filings = Financial Statements (`*_sony.pdf`).
 * Host: sony.com/.../presen/er/pdf/. Never speech / Q&A / supplemental / Form 20-F / SEC HTML.
 *
 * Filename year is Sony’s IR FY label = our fq/fy year − 1
 * (e.g. period 2026-06-30 → Q1 2027 → `26q1`; period 2025-06-30 → Q1 2026 → `25q1`).
 */

export type SonyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

/** Japanese FY ends March 31. */
export const SONY_FY_END = "03-31";

const ER = "https://www.sony.com/en/SonyInfo/IR/library/presen/er/pdf";

/** Map Finsepa `Q{q} {fy}` (FY ends 03-31) → Sony `{YYqN}` tag (IR FY = fy−1). */
function tagFor(fq: number, fy: number): string {
  const sonyFy = fy - 1;
  return `${String(sonyFy).slice(-2)}q${fq}`;
}

function docs(fq: number, fy: number): SonyQuarterDocs {
  const tag = tagFor(fq, fy);
  return {
    slides: `${ER}/${tag}_sonypre.pdf`,
    filings: `${ER}/${tag}_sony.pdf`,
  };
}

export const SONY_IR_PAGES = [
  "https://www.sony.com/en/SonyInfo/IR/",
  "https://www.sony.com/en/SonyInfo/IR/library/presen/er/",
  "https://www.sony.com/en/SonyInfo/IR/library/presen/er/archive.html",
] as const;

/**
 * Browser-verified Presentation + Financial Statements.
 * Scope covers vault history Q4 2022 → Q1 2027 (period ends 2022-03-31 … 2026-06-30).
 */
export const SONY_KNOWN_QUARTER_DOCS: Readonly<Record<string, SonyQuarterDocs>> = {
  "Q1 2027": docs(1, 2027), // 26q1 — Apr–Jun 2026
  "Q4 2026": docs(4, 2026), // 25q4 — YE Mar 2026
  "Q3 2026": docs(3, 2026), // 25q3
  "Q2 2026": docs(2, 2026), // 25q2
  "Q1 2026": docs(1, 2026), // 25q1
  "Q4 2025": docs(4, 2025), // 24q4
  "Q3 2025": docs(3, 2025), // 24q3
  "Q2 2025": docs(2, 2025), // 24q2
  "Q1 2025": docs(1, 2025), // 24q1
  "Q4 2024": docs(4, 2024), // 23q4
  "Q3 2024": docs(3, 2024), // 23q3
  "Q2 2024": docs(2, 2024), // 23q2
  "Q1 2024": docs(1, 2024), // 23q1
  "Q4 2023": docs(4, 2023), // 22q4
  "Q3 2023": docs(3, 2023), // 22q3
  "Q2 2023": docs(2, 2023), // 22q2
  "Q1 2023": docs(1, 2023), // 22q1
  "Q4 2022": docs(4, 2022), // 21q4 — YE Mar 2022
};

export function isSonyRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|speech|q&a|q\s*&\s*a|supplemental|webcast|20-?f|corporate[-_\s]*strategy|sonyfg|forecast|transcript|10-?q|10-?k|8-?k/i.test(
    n,
  );
}

export function isSonyIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.sony.com" || host === "sony.com" || host.endsWith(".sony.com"))) {
      return false;
    }
    if (!/\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    if (!u.pathname.includes("/SonyInfo/IR/library/presen/er/pdf/")) return false;
    const path = u.pathname.toLowerCase();
    const ok = /_sonypre\.pdf$/i.test(path) || /_sony\.pdf$/i.test(path);
    return ok && !isSonyRejected(url);
  } catch {
    return false;
  }
}

export function mergeSonyKnownQuarterDocs(): Map<string, SonyQuarterDocs> {
  return new Map(Object.entries(SONY_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
