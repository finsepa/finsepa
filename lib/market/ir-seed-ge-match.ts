/** GE / GE Aerospace IR: earnings webcast presentation as slides. Never 10-Q, transcripts, Investor Day, or conference decks. */

export type GeQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const GE = "https://www.ge.com/sites/default/files";
const AER = "https://www.geaerospace.com/sites/default/files";

function gePres(file: string): string {
  return `${GE}/${file}`;
}

function aerPres(file: string): string {
  return `${AER}/${file}`;
}

function aerPress(file: string): string {
  return `${AER}/${file}`;
}

/**
 * GET-verified webcast presentation PDFs (report-date filenames).
 * Q2 2025 combined Investor Update + earnings — still the earnings webcast deck.
 * Do not lock investor-day-2024-presentation.pdf or Bernstein / DPT showcase decks.
 */
export const GE_KNOWN_QUARTER_DOCS: Readonly<Record<string, GeQuarterDocs>> = {
  "Q2 2026": {
    slides: aerPres("geaerospace_webcast_presentation_07162026_2.pdf"),
    filings: aerPress("geaerospace_webcast_pressrelease_07162026.pdf"),
  },
  "Q1 2026": {
    slides: aerPres("geaerospace_webcast_presentation_04212026.pdf"),
    filings: aerPress("geaerospace_webcast_pressrelease_04212026.pdf"),
  },
  "Q4 2025": { slides: aerPres("geaerospace_webcast_presentation_01222026.pdf"), filings: null },
  "Q3 2025": { slides: aerPres("geaerospace_webcast_presentation_10212025.pdf"), filings: null },
  "Q2 2025": { slides: aerPres("geaerospace_webcast_presentation_07172025.pdf"), filings: null },
  "Q1 2025": { slides: aerPres("geaerospace_webcast_presentation_04222025.pdf"), filings: null },
  "Q4 2024": { slides: aerPres("geaerospace_webcast_presentation_01232025.pdf"), filings: null },
  "Q3 2024": { slides: aerPres("geaerospace_webcast_presentation_10222024.pdf"), filings: null },
  "Q2 2024": { slides: aerPres("geaerospace_webcast_presentation_07232024.pdf"), filings: null },
  "Q1 2024": { slides: aerPres("geaerospace_webcast_presentation_04232024.pdf"), filings: null },
  "Q4 2023": { slides: gePres("ge_webcast_presentation_01232024.pdf"), filings: null },
  "Q3 2023": { slides: gePres("ge_webcast_presentation_10242023_0.pdf"), filings: null },
  "Q2 2023": { slides: gePres("ge_webcast_presentation_07252023.pdf"), filings: null },
  "Q1 2023": { slides: gePres("ge_webcast_presentation_04252023.pdf"), filings: null },
  "Q4 2022": { slides: gePres("ge_webcast_presentation_01242023.pdf"), filings: null },
  "Q3 2022": { slides: gePres("ge_webcast_presentation_10252022.pdf"), filings: null },
  "Q2 2022": { slides: gePres("ge_webcast_presentation_07262022.pdf"), filings: null },
  "Q1 2022": { slides: gePres("ge_webcast_presentation_04262022.pdf"), filings: null },
};

export const GE_IR_PAGES = [
  "https://www.geaerospace.com/investor-relations/events-reports",
  "https://www.geaerospace.com/investor-relations",
] as const;

export function mergeGeKnownQuarterDocs(fromHtml: Map<string, GeQuarterDocs>): Map<string, GeQuarterDocs> {
  const out = new Map(fromHtml);
  for (const [label, known] of Object.entries(GE_KNOWN_QUARTER_DOCS)) {
    const cur = out.get(label) ?? { slides: null, filings: null };
    out.set(label, {
      slides: cur.slides ?? known.slides,
      filings: cur.filings ?? known.filings,
    });
  }
  return out;
}

export function isGeRejectedAsSlides(href: string): boolean {
  const n = decodeURIComponent(href).toLowerCase();
  return /webcast_10q|webcast_transcript|webcast_mp3|investor-day|bernstein|defense-propulsion|acquire_|annual[-_]meeting|sec\.gov/i.test(
    n,
  );
}

function absGe(href: string, pageUrl: string): string | null {
  try {
    return new URL(href.replace(/&amp;/g, "&"), pageUrl).href.split("#")[0]!;
  } catch {
    return null;
  }
}

/**
 * Events-reports HTML: presentation PDFs as slides, pressrelease PDFs as filings.
 * Date-stamped filenames are mapped via the known catalog, not guessed from MMDDYYYY.
 */
export function parseGeEventsHtml(html: string, pageUrl: string): Map<string, GeQuarterDocs> {
  const out = new Map<string, GeQuarterDocs>();
  const hrefRe = /href\s*=\s*["']([^"']+\.pdf[^"']*)["']/gi;
  const byFile = new Map<string, string>();
  for (const m of html.matchAll(hrefRe)) {
    const href = absGe((m[1] ?? "").trim(), pageUrl);
    if (!href || !/\.pdf(?:$|[?#])/i.test(href)) continue;
    if (!/geaerospace\.com|ge\.com/i.test(href)) continue;
    byFile.set(decodeURIComponent(href).split("/").pop()?.split("?")[0]?.toLowerCase() ?? href, href);
  }
  for (const [label, known] of Object.entries(GE_KNOWN_QUARTER_DOCS)) {
    const slidesName = known.slides ? decodeURIComponent(known.slides).split("/").pop()?.toLowerCase() : null;
    const filingsName = known.filings ? decodeURIComponent(known.filings).split("/").pop()?.toLowerCase() : null;
    const slides = (slidesName && byFile.get(slidesName)) || known.slides;
    const filings = (filingsName && byFile.get(filingsName)) || known.filings;
    if (slides && isGeRejectedAsSlides(slides)) continue;
    out.set(label, { slides: slides ?? null, filings: filings ?? null });
  }
  return out;
}
