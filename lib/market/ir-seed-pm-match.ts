/** PMI IR: earnings presentation as slides, press-release PDF as filings. Never script, webcast advisory, glossary, or Investor Day. */

export type PmQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const GCS = "https://philipmorrisinternational.gcs-web.com/static-files";

function gcs(uuid: string): string {
  return `${GCS}/${uuid}`;
}

/**
 * Verified from pmi.com/{yyyy}Q{n}earnings and 2026-q{n}-results pages.
 * Q4 2025 vanity URL 404 from this host — leave empty.
 */
export const PM_KNOWN_QUARTER_DOCS: Readonly<Record<string, PmQuarterDocs>> = {
  "Q2 2026": { slides: gcs("60cbe6dd-3101-4893-b19d-355154ad8164"), filings: gcs("1413f36d-6ebf-4fc0-9fe3-d721a794ef1e") },
  "Q1 2026": { slides: gcs("bc8f0707-b24e-43a9-892c-60b2583e587c"), filings: gcs("de3f8c27-9f6b-4d9e-9890-85a231ac759e") },
  "Q3 2025": { slides: gcs("cbb6105c-9cc6-4b3b-8850-307cc2aef996"), filings: gcs("3fc905b7-c236-4a38-a14f-fbe3db8a8637") },
  "Q2 2025": { slides: gcs("6c7383bb-6219-4039-8204-a68dec869cf4"), filings: gcs("b5677465-b1cb-4835-88ba-7556cb767b38") },
  "Q1 2025": { slides: gcs("7a4fc96b-b570-407e-bdfa-caa9a819cf80"), filings: gcs("950f5ba1-cfee-4e97-a137-a90ad7afead5") },
  "Q4 2024": { slides: gcs("1813fa3f-dc65-4087-a48b-72d768b56b69"), filings: gcs("5fc769ed-86dd-4d0c-96df-7ff916b3ecd8") },
  "Q3 2024": { slides: gcs("f4a65b8e-b907-446f-b505-c3d1f6eb14c1"), filings: gcs("5adc93ee-d1c2-4614-9af1-2eecae59cc4b") },
  "Q2 2024": { slides: gcs("0a1b3141-b436-4164-8b58-fabb50864562"), filings: gcs("8efa194a-14c1-452b-9e88-2c925d0b116f") },
  "Q1 2024": { slides: gcs("9c68827e-0517-49b1-91da-2568b68c8739"), filings: gcs("4e563937-1e81-40ea-acf4-89f192e69664") },
  "Q4 2023": { slides: gcs("ab305c2e-108d-4aa8-ba57-4091e29d38ae"), filings: gcs("60fa0bd7-478e-487b-be76-b592a01e1033") },
  "Q3 2023": { slides: gcs("ddfa249a-2374-434c-b284-af1504a3bb80"), filings: gcs("1de1a6d8-f42c-4327-95cb-32dff08eadc7") },
  "Q2 2023": { slides: gcs("ad9af0a5-ff25-4a50-8aa8-02ac99a2469f"), filings: gcs("f5a30b07-bd67-44b5-896b-06d1f36cd77b") },
  "Q1 2023": { slides: gcs("92ea3850-1667-41fb-a7be-d481c1dc60c7"), filings: gcs("c04236e0-823c-4dc2-a4fb-ccd6c313d379") },
  "Q4 2022": { slides: gcs("65813297-f2f6-4cc6-ab91-ee3f1c0e22e5"), filings: gcs("881c7a3f-5997-4796-98c1-0ba1ee8459df") },
  "Q3 2022": { slides: gcs("74c4f7b4-64db-40af-8320-b92694a104d0"), filings: gcs("5cc586e1-77ef-4a73-8cb0-9abcbf3d556f") },
  "Q2 2022": { slides: gcs("3ddd3935-2bc4-439f-8c77-0598aad8b526"), filings: gcs("32fc2dba-93b6-4ba2-a106-3e6549d65705") },
  "Q1 2022": { slides: gcs("5509f08d-2780-4fc5-b30e-a26e73c16724"), filings: gcs("edb74b14-9bb1-4a81-84e5-bc7c249bc97b") },
};

export function pmEarningsPageUrls(fq: number, fy: number): string[] {
  return [
    `https://www.pmi.com/${fy}Q${fq}earnings`,
    `https://www.pmi.com/investor-relations/press-releases-and-events/${fy}-q${fq}-results`,
  ];
}

export const PM_IR_PAGES = [
  "https://www.pmi.com/investor-relations/press-releases-and-events/2026-q2-results",
  "https://www.pmi.com/investor-relations/press-releases-and-events/2026-q1-results",
  "https://www.pmi.com/2025Q3earnings",
] as const;

export function labelFromPmPageUrl(pageUrl: string): string | null {
  const vanity = pageUrl.match(/\/(\d{4})q([1-4])earnings/i);
  if (vanity) return `Q${vanity[2]} ${vanity[1]}`;
  const long = pageUrl.match(/\/(\d{4})-q([1-4])-results/i);
  if (long) return `Q${long[2]} ${long[1]}`;
  return null;
}

export function isPmRejected(href: string, labelText = ""): boolean {
  const n = `${decodeURIComponent(href)} ${labelText}`.toLowerCase();
  return /sec\.gov|script|webcast advisory|glossary|recast|investor[-_\s]*day|europe-investor/i.test(n);
}

function absPm(href: string, pageUrl: string): string | null {
  try {
    return new URL(href.replace(/&amp;/g, "&"), pageUrl).href.split("#")[0]!;
  } catch {
    return null;
  }
}

function isPmSlidesLabel(text: string): boolean {
  return /presentation|slides/i.test(text) && !isPmRejected("", text);
}

function isPmFilingsLabel(text: string): boolean {
  return /press\s*release/i.test(text) && !isPmRejected("", text);
}

/** Parse PMI earnings-event HTML for Presentation / Press Release static-files. */
export function parsePmEarningsHtml(html: string, pageUrl: string): Map<string, PmQuarterDocs> {
  const out = new Map<string, PmQuarterDocs>();
  const pageLabel = labelFromPmPageUrl(pageUrl);
  const anchorRe = /<a\b([^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*)>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(anchorRe)) {
    const attrs = m[1] ?? "";
    const href = absPm((m[2] ?? "").trim(), pageUrl);
    if (!href || !/philipmorrisinternational\.gcs-web\.com\/static-files\//i.test(href)) continue;
    const inner = (m[3] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const aria = attrs.match(/\baria-label\s*=\s*["']([^"']+)["']/i)?.[1] ?? "";
    const text = `${aria} ${inner}`;
    if (isPmRejected(href, text)) continue;
    const label = pageLabel;
    if (!label) continue;
    const cur = out.get(label) ?? { slides: null, filings: null };
    if (!cur.slides && isPmSlidesLabel(text)) cur.slides = href;
    else if (!cur.filings && isPmFilingsLabel(text)) cur.filings = href;
    out.set(label, cur);
  }
  return out;
}

export function mergePmKnownQuarterDocs(fromHtml: Map<string, PmQuarterDocs>): Map<string, PmQuarterDocs> {
  const out = new Map(fromHtml);
  for (const [label, known] of Object.entries(PM_KNOWN_QUARTER_DOCS)) {
    const cur = out.get(label) ?? { slides: null, filings: null };
    out.set(label, {
      slides: cur.slides ?? known.slides,
      filings: cur.filings ?? known.filings,
    });
  }
  return out;
}
