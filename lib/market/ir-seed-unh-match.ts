/**
 * UnitedHealth Group IR publishes earnings releases, 8-Ks, 10-Q/10-K, and prepared
 * remarks — not a quarterly earnings slide deck. Never lock remarks, releases, or SEC HTML as Slides.
 */

export type UnhQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const UNH_IR_PAGES = [
  "https://www.unitedhealthgroup.com/investors/financial-reports.html",
] as const;

/** Empty catalog: no public quarterly slide decks on IR. */
export const UNH_KNOWN_QUARTER_DOCS: Readonly<Record<string, UnhQuarterDocs>> = {};

export function unhRejectsAsSlides(href: string): boolean {
  const n = decodeURIComponent(href).toLowerCase();
  return (
    /sec\.gov/i.test(n) ||
    /remarks/i.test(n) ||
    /earnings[-_]?release/i.test(n) ||
    /10-q|10-k|form-10|8-k/i.test(n) ||
    /vpower|\.htm(?:l)?(?:$|[?#])/i.test(n)
  );
}
