/**
 * Vertex Pharmaceuticals (VRTX) IR — calendar FY.
 * Slides = Quarterly Presentation on investors.vrtx.com/static-files.
 * Filings = null (earnings release is HTML news-release-details only).
 * Never 10-Q / 10-K / transcript / reconciliation / SEC HTML.
 */

export type VrtxQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const VRTX_STATIC = "https://investors.vrtx.com/static-files";

function staticFiles(uuid: string): string {
  return `${VRTX_STATIC}/${uuid}`;
}

export const VRTX_IR_PAGES = [
  "https://investors.vrtx.com/",
  "https://investors.vrtx.com/financial-information/quarterly-results",
] as const;

/** Quarterly-results Presentation links (Q1 2022 → Q2 2026). */
export const VRTX_KNOWN_QUARTER_DOCS: Readonly<Record<string, VrtxQuarterDocs>> = {
  "Q2 2026": {
    slides: staticFiles("25a09e85-5615-46d3-8f28-7e5e75440a14"),
    filings: null,
  },
  "Q1 2026": {
    slides: staticFiles("ad9b77b2-32d0-43a7-b42f-a056fdf5bd41"),
    filings: null,
  },
  "Q4 2025": {
    slides: staticFiles("7a35cf94-49dd-45fb-9c34-6113d3c67075"),
    filings: null,
  },
  "Q3 2025": {
    slides: staticFiles("7bd09616-955e-41a4-a1f2-cc1463a34521"),
    filings: null,
  },
  "Q2 2025": {
    slides: staticFiles("c5172a57-63f2-4ae5-8b19-f1fb2406f890"),
    filings: null,
  },
  "Q1 2025": {
    slides: staticFiles("f1e5e23f-953d-442a-b8b9-db44de4bdea9"),
    filings: null,
  },
  "Q4 2024": {
    slides: staticFiles("06064a48-ec16-46a3-9c2c-6f7bcfc787d3"),
    filings: null,
  },
  "Q3 2024": {
    slides: staticFiles("eafe620a-981b-4b21-a6c4-bf1e0a0a0014"),
    filings: null,
  },
  "Q2 2024": {
    slides: staticFiles("ad6251e9-8f7e-481b-bcf3-4f2417b7d63b"),
    filings: null,
  },
  "Q1 2024": {
    slides: staticFiles("9c6d5ac2-46a6-4116-94a9-9123d06a10b0"),
    filings: null,
  },
  "Q4 2023": {
    slides: staticFiles("dc6f3af0-27b6-4ca8-8082-f989e85fba38"),
    filings: null,
  },
  "Q3 2023": {
    slides: staticFiles("03c42305-90c3-4fa9-9ef7-a1aca11e40f9"),
    filings: null,
  },
  "Q2 2023": {
    slides: staticFiles("f20c0556-1438-47a0-937c-8e41fe86b49f"),
    filings: null,
  },
  "Q1 2023": {
    slides: staticFiles("cf7785c5-b670-4c27-a26a-a79c47983c4f"),
    filings: null,
  },
  "Q4 2022": {
    slides: staticFiles("f14e129c-8f45-479b-9d99-106fa7a204ce"),
    filings: null,
  },
  "Q3 2022": {
    slides: staticFiles("1153e5c3-9c41-42ab-9345-501ec098cd2c"),
    filings: null,
  },
  "Q2 2022": {
    slides: staticFiles("c47d1203-2c22-4572-b8bc-3894813ae08f"),
    filings: null,
  },
  "Q1 2022": {
    slides: staticFiles("db991666-a316-4f9b-b751-711680934abd"),
    filings: null,
  },
};

export function isVrtxRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|reconciliation|webcast|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(
    n,
  );
}

export function isVrtxIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (!(host === "investors.vrtx.com" || host === "vrtx.com" || host.endsWith(".vrtx.com"))) {
      return false;
    }
    if (!/\/static-files\/[a-f0-9-]{36}/i.test(u.pathname)) return false;
    return !isVrtxRejected(url);
  } catch {
    return false;
  }
}

export function mergeVrtxKnownQuarterDocs(): Map<string, VrtxQuarterDocs> {
  return new Map(Object.entries(VRTX_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
