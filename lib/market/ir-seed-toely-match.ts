/**
 * Tokyo Electron ADR (TOELY) IR — FY ends 03-31.
 * Slides = English presentations (*presentations-e.pdf);
 * Filings = English tanshin (*tanshin-e.pdf).
 * Never transcript / QA / MSA / SEC HTML. Labels = issuer March FY.
 */

export type ToelyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

/** Tokyo Electron FY ends March 31. */
export const TOELY_FY_END = "03-31";

export const TOELY_IR_PAGES = [
  "https://www.tel.com/ir/",
  "https://www.tel.com/ir/library/report/",
] as const;

/** Catalog Q1 2022 → Q1 2027 (issuer March FY). */
export const TOELY_KNOWN_QUARTER_DOCS: Readonly<Record<string, ToelyQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://www.tel.com/ir/library/report/hq95qj0000002ovm-att/fy22q1presentations-e.pdf",
    filings: "https://www.tel.com/ir/library/report/hq95qj0000002ovm-att/fy22q1tanshin-e.pdf",
  },
  "Q2 2022": {
    slides: "https://www.tel.com/ir/library/report/hq95qj00000007tg-att/fy22q2presentations-e.pdf",
    filings: "https://www.tel.com/ir/library/report/hq95qj00000007tg-att/fy22q2tanshin-e.pdf",
  },
  "Q3 2022": {
    slides: "https://www.tel.com/ir/library/report/hq95qj00000007ri-att/fy22q3presentations-e.pdf",
    filings: "https://www.tel.com/ir/library/report/hq95qj00000007ri-att/fy22q3tanshin-e.pdf",
  },
  "Q4 2022": {
    slides: "https://www.tel.com/ir/library/report/hq95qj00000007nc-att/fy22q4presentations-e.pdf",
    filings: "https://www.tel.com/ir/library/report/hq95qj00000007nc-att/fy22q4tanshin-e.pdf",
  },
  "Q1 2023": {
    slides: "https://www.tel.com/ir/library/report/hq95qj00000007km-att/fy23q1presentations-e.pdf",
    filings: "https://www.tel.com/ir/library/report/hq95qj00000007km-att/fy23q1tanshin-e.pdf",
  },
  "Q2 2023": {
    slides: "https://www.tel.com/ir/library/report/hq95qj00000007ih-att/fy23q2presentations-e_2.pdf",
    filings: "https://www.tel.com/ir/library/report/hq95qj00000007ih-att/fy23q2tanshin-e.pdf",
  },
  "Q3 2023": {
    slides: "https://www.tel.com/ir/library/report/a4fd9v000000007q-att/fy23q3presentations-e.pdf",
    filings: "https://www.tel.com/ir/library/report/a4fd9v000000007q-att/fy23q3tanshin-e.pdf",
  },
  "Q4 2023": {
    slides: "https://www.tel.com/ir/library/report/a4fd9v000000004h-att/fy23q4presentations-e.pdf",
    filings: "https://www.tel.com/ir/library/report/a4fd9v000000004h-att/fy23q4tanshin-e.pdf",
  },
  "Q1 2024": {
    slides: "https://www.tel.com/ir/library/report/ta7l33000000009p-att/fy24q1presentations-e.pdf",
    filings: "https://www.tel.com/ir/library/report/ta7l33000000009p-att/fy24q1tanshin-e.pdf",
  },
  "Q2 2024": {
    slides: "https://www.tel.com/ir/library/report/plgm7r000000003e-att/fy24q2presentations-e.pdf",
    filings: "https://www.tel.com/ir/library/report/plgm7r000000003e-att/fy24q2tanshin-e.pdf",
  },
  "Q3 2024": {
    slides: "https://www.tel.com/ir/library/report/a5hghd00000000bq-att/fy24q3presentations-e.pdf",
    filings: "https://www.tel.com/ir/library/report/a5hghd00000000bq-att/fy24q3tanshin-e.pdf",
  },
  "Q4 2024": {
    slides: "https://www.tel.com/ir/library/report/ll4pka00000000l9-att/fy24q4presentations-e.pdf",
    filings: "https://www.tel.com/ir/library/report/ll4pka00000000l9-att/fy24q4tanshin-e.pdf",
  },
  "Q1 2025": {
    slides: "https://www.tel.com/ir/library/report/tpc8u500000000s3-att/fy25q1presentations-e.pdf",
    filings: "https://www.tel.com/ir/library/report/tpc8u500000000s3-att/fy25q1tanshin-e.pdf",
  },
  "Q2 2025": {
    slides: "https://www.tel.com/ir/library/report/o6kifa00000000nf-att/fy25q2presentations-e.pdf",
    filings: "https://www.tel.com/ir/library/report/o6kifa00000000nf-att/fy25q2tanshin-e.pdf",
  },
  "Q3 2025": {
    slides: "https://www.tel.com/ir/library/report/c2l1qi00000000sj-att/fy25q3presentations-e.pdf",
    filings: "https://www.tel.com/ir/library/report/c2l1qi00000000sj-att/fy25q3tanshin-e.pdf",
  },
  "Q4 2025": {
    slides: "https://www.tel.com/ir/library/report/l8gqgo00000000gl-att/fy25q4presentations-e.pdf",
    filings: "https://www.tel.com/ir/library/report/l8gqgo00000000gl-att/fy25q4tanshin-e.pdf",
  },
  "Q1 2026": {
    slides: "https://www.tel.com/ir/library/report/cpkomu00000000kv-att/fy26q1presentations-e.pdf",
    filings: "https://www.tel.com/ir/library/report/cpkomu00000000kv-att/fy26q1tanshin-e.pdf",
  },
  "Q2 2026": {
    slides: "https://www.tel.com/ir/library/report/n0n82r00000000hl-att/fy26q2presentations-e.pdf",
    filings: "https://www.tel.com/ir/library/report/n0n82r00000000hl-att/fy26q2tanshin-e.pdf",
  },
  "Q3 2026": {
    slides: "https://www.tel.com/ir/library/report/qemr4i00000000dj-att/fy26q3presentations-e.pdf",
    filings: "https://www.tel.com/ir/library/report/qemr4i00000000dj-att/fy26q3tanshin-e.pdf",
  },
  "Q4 2026": {
    slides: "https://www.tel.com/ir/library/report/pjuomj00000000tf-att/fy26q4presentations-e.pdf",
    filings: "https://www.tel.com/ir/library/report/pjuomj00000000tf-att/fy26q4tanshin-e.pdf",
  },
  "Q1 2027": {
    slides: "https://www.tel.com/ir/irta3a00000006g5-att/fy27q1presentations-e.pdf",
    filings: "https://www.tel.com/ir/irta3a00000006g5-att/fy27q1tanshin-e.pdf",
  },
};

export function isToelyRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|earningcall.?qa|_qa_|msa_statement|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(
    n,
  );
}

export function isToelyIrPdf(href: string | null | undefined): boolean {
  if (!href || isToelyRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.tel.com" || host === "tel.com" || host.endsWith(".tel.com"))) return false;
    return /\.(?:pdf)(?:$|[?#])/i.test(u.pathname) && /(presentation|tanshin)/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeToelyKnownQuarterDocs(): Map<string, ToelyQuarterDocs> {
  return new Map(Object.entries(TOELY_KNOWN_QUARTER_DOCS));
}
