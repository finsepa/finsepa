/**
 * Adobe (ADBE) IR — Nov FY. Slides = "Earnings script and slides" PDF;
 * Filings = "Earnings press release" PDF on www.adobe.com/cc-shared/...
 * Never lock transcripts, datasheets, or SEC HTML into Slides/Filings.
 */

export type AdbeQuarterDocs = {
  fiscalPeriodEndYmd: string;
  label: string;
  slides: string | null;
  filings: string | null;
};

/** Adobe fiscal year ends ~late November. */
export const ADBE_FY_END = "11-30";

export const ADBE_IR_PAGES = [
  "https://www.adobe.com/investor-relations/financial-documents.html",
  "https://www.adobe.com/investor-relations.html",
] as const;

/**
 * Browser-verified catalog (Q1 2022+). Live HTML parse prefers fresher links;
 * catalog covers when Cloudflare blocks the server fetch.
 */
export const ADBE_IR_QUARTER_DOCS: readonly AdbeQuarterDocs[] = [
  {
    fiscalPeriodEndYmd: "2026-08-31",
    label: "Q3 2026",
    slides: "https://www.adobe.com/cc-shared/assets/investor-relations/pdfs/01906202/c6yetrerew.pdf",
    filings: "https://www.adobe.com/cc-shared/assets/investor-relations/pdfs/01906202/au56y4ter.pdf",
  },
  {
    fiscalPeriodEndYmd: "2026-05-31",
    label: "Q2 2026",
    slides: "https://www.adobe.com/cc-shared/assets/investor-relations/pdfs/11606202/c5y6yteraf.pdf",
    filings: "https://www.adobe.com/cc-shared/assets/investor-relations/pdfs/11606202/a5543arefgt.pdf",
  },
  {
    fiscalPeriodEndYmd: "2026-02-28",
    label: "Q1 2026",
    slides: "https://www.adobe.com/cc-shared/assets/investor-relations/pdfs/21306202/c545hjdryueyw34.pdf",
    filings: "https://www.adobe.com/cc-shared/assets/investor-relations/pdfs/21306202/ay45th643t5y46.pdf",
  },
  {
    fiscalPeriodEndYmd: "2025-11-30",
    label: "Q4 2025",
    slides: "https://www.adobe.com/cc-shared/assets/investor-relations/pdfs/01215202/c54trgt53r4aw.pdf",
    filings: "https://www.adobe.com/cc-shared/assets/investor-relations/pdfs/01215202/a54gu6y5tegrrf.pdf",
  },
  {
    fiscalPeriodEndYmd: "2025-08-31",
    label: "Q3 2025",
    slides: "https://www.adobe.com/cc-shared/assets/investor-relations/pdfs/11905202/cu564stre3e.pdf",
    filings: "https://www.adobe.com/cc-shared/assets/investor-relations/pdfs/11905202/aiy4w5teshy5t.pdf",
  },
  {
    fiscalPeriodEndYmd: "2025-05-31",
    label: "Q2 2025",
    slides: "https://www.adobe.com/cc-shared/assets/investor-relations/pdfs/12605202/cyt34ae5rfwe.pdf",
    filings: "https://www.adobe.com/cc-shared/assets/investor-relations/pdfs/12605202/a654erthgf.pdf",
  },
  {
    fiscalPeriodEndYmd: "2025-02-28",
    label: "Q1 2025",
    slides: "https://www.adobe.com/cc-shared/assets/investor-relations/pdfs/21305202/c56hryhwgerfaw.pdf",
    filings: "https://www.adobe.com/cc-shared/assets/investor-relations/pdfs/21305202/a4t3greafe.pdf",
  },
  {
    fiscalPeriodEndYmd: "2024-11-29",
    label: "Q4 2024",
    slides: "https://www.adobe.com/cc-shared/assets/investor-relations/pdfs/11214202/c75e6yhrste.pdf",
    filings: "https://www.adobe.com/cc-shared/assets/investor-relations/pdfs/11214202/a56sthg53egr.pdf",
  },
  {
    fiscalPeriodEndYmd: "2024-08-30",
    label: "Q3 2024",
    slides: "https://www.adobe.com/cc-shared/assets/investor-relations/pdfs/cjyhgr4tw5gt.pdf",
    filings: "https://www.adobe.com/cc-shared/assets/investor-relations/pdfs/au4736wy45tg.pdf",
  },
  {
    fiscalPeriodEndYmd: "2024-05-31",
    label: "Q2 2024",
    slides: "https://www.adobe.com/cc-shared/assets/investor-relations/pdfs/cj54y53tgrww.pdf",
    filings: "https://www.adobe.com/cc-shared/assets/investor-relations/pdfs/au56y45ethgrf.pdf",
  },
  {
    fiscalPeriodEndYmd: "2024-03-01",
    label: "Q1 2024",
    slides: "https://www.adobe.com/cc-shared/assets/investor-relations/pdfs/cu6yw45htesgr.pdf",
    filings: "https://www.adobe.com/cc-shared/assets/investor-relations/pdfs/a4w5ergfj54.pdf",
  },
];

export function adbeDocsByPeriodEnd(): Map<string, { slides: string | null; filings: string | null }> {
  const out = new Map<string, { slides: string | null; filings: string | null }>();
  for (const row of ADBE_IR_QUARTER_DOCS) {
    out.set(row.fiscalPeriodEndYmd, { slides: row.slides, filings: row.filings });
  }
  return out;
}

export function adbeDocsByLabel(): Map<string, { slides: string | null; filings: string | null }> {
  const out = new Map<string, { slides: string | null; filings: string | null }>();
  for (const row of ADBE_IR_QUARTER_DOCS) {
    out.set(row.label, { slides: row.slides, filings: row.filings });
  }
  return out;
}

function absAdobeUrl(href: string, pageUrl: string): string | null {
  try {
    const u = new URL(href, pageUrl);
    if (!/\.pdf($|\?)/i.test(u.pathname)) return null;
    if (!/adobe\.com$/i.test(u.hostname.replace(/^www\./, "")) && !/\.adobe\.com$/i.test(u.hostname)) {
      return null;
    }
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Parse Adobe financial-documents / IR home HTML into `Qn YYYY` → slides + filings.
 */
export function parseAdbeFinancialDocumentsHtml(
  html: string,
  pageUrl: string,
): Map<string, { slides: string | null; filings: string | null }> {
  const out = new Map<string, { slides: string | null; filings: string | null }>();
  let fy: number | null = null;
  let q: number | null = null;

  const tokenRe =
    /<h2[^>]*>\s*Fiscal year\s+(\d{4})\s*<\/h2>|<h3[^>]*>\s*Q([1-4])\s*<\/h3>|<a[^>]+href=["']([^"']+)["'][^>]*>\s*([^<]*?)\s*<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(html))) {
    if (m[1]) {
      fy = Number(m[1]);
      q = null;
      continue;
    }
    if (m[2]) {
      q = Number(m[2]);
      continue;
    }
    const href = m[3];
    const text = (m[4] ?? "").replace(/\s+/g, " ").trim();
    if (!fy || !q || !href) continue;
    const abs = absAdobeUrl(href, pageUrl);
    if (!abs) continue;
    const label = `Q${q} ${fy}`;
    const cur = out.get(label) ?? { slides: null, filings: null };
    if (/earnings script and slides/i.test(text) && !cur.slides) {
      cur.slides = abs;
    } else if (/earnings press release/i.test(text) && !cur.filings) {
      cur.filings = abs;
    }
    out.set(label, cur);
  }
  return out;
}

export function mergeAdbeKnownQuarterDocs(
  parsed: Map<string, { slides: string | null; filings: string | null }>,
): Map<string, { slides: string | null; filings: string | null }> {
  const byLabel = adbeDocsByLabel();
  for (const [label, docs] of parsed) {
    const base = byLabel.get(label) ?? { slides: null, filings: null };
    byLabel.set(label, {
      slides: docs.slides ?? base.slides,
      filings: docs.filings ?? base.filings,
    });
  }
  return byLabel;
}
