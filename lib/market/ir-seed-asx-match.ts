/**
 * ASE Technology Holding (ASX) IR — calendar FY (not the Australian exchange).
 * Slides = Presentation; Filings = Press Release on media-aseholdco.todayir.com.
 * Never SEC HTML.
 */

export type AsxQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const ASX_IR_PAGES = [
  "https://ir.aseglobal.com/",
  "https://www.aseglobal.com/en/investor/",
] as const;

/** Catalog Q1 2022 → Q2 2026. */
export const ASX_KNOWN_QUARTER_DOCS: Readonly<Record<string, AsxQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://media-aseholdco.todayir.com/20220428160908765187166_en.pdf",
    filings: "https://media-aseholdco.todayir.com/202204281447411709465664_en.pdf",
  },
  "Q2 2022": {
    slides: "https://media-aseholdco.todayir.com/20220728160941764830409_en.pdf",
    filings: "https://media-aseholdco.todayir.com/202207281444591791353087_en.pdf",
  },
  "Q3 2022": {
    slides: "https://media-aseholdco.todayir.com/20221027155609779763779_en.pdf",
    filings: "https://media-aseholdco.todayir.com/202210271447211782968513_en.pdf",
  },
  "Q4 2022": {
    slides: "https://media-aseholdco.todayir.com/20230209161530704821857_en.pdf",
    filings: "https://media-aseholdco.todayir.com/202302091442171741673768_en.pdf",
  },
  "Q1 2023": {
    slides: "https://media-aseholdco.todayir.com/20230427160333778589571_en.pdf",
    filings: "https://media-aseholdco.todayir.com/202304271441301775196972_en.pdf",
  },
  "Q2 2023": {
    slides: "https://media-aseholdco.todayir.com/20230727161538713109248_en.pdf",
    filings: "https://media-aseholdco.todayir.com/202307271444571793570423_en.pdf",
  },
  "Q3 2023": {
    slides: "https://media-aseholdco.todayir.com/20231026160839701837380_en.pdf",
    filings: "https://media-aseholdco.todayir.com/202310261446371753140118_en.pdf",
  },
  "Q4 2023": {
    slides: "https://media-aseholdco.todayir.com/20240201162355758080059_en.pdf",
    filings: "https://media-aseholdco.todayir.com/202402011440341789020138_en.pdf",
  },
  "Q1 2024": {
    slides: "https://media-aseholdco.todayir.com/20240425155559733640307_en.pdf",
    filings: "https://media-aseholdco.todayir.com/202404251443031790872902_en.pdf",
  },
  "Q2 2024": {
    slides: "https://media-aseholdco.todayir.com/20240725144259745056193_en.pdf",
    filings: "https://media-aseholdco.todayir.com/202407251442591745056193_en.pdf",
  },
  "Q3 2024": {
    slides: "https://media-aseholdco.todayir.com/20241031161906721312367_en.pdf",
    filings: "https://media-aseholdco.todayir.com/202410311445401737773539_en.pdf",
  },
  "Q4 2024": {
    slides: "https://media-aseholdco.todayir.com/20250213163857711055466_en.pdf",
    filings: "https://media-aseholdco.todayir.com/202502131433591761248081_en.pdf",
  },
  "Q1 2025": {
    slides: "https://media-aseholdco.todayir.com/20250430152919716398489_en.pdf",
    filings: "https://media-aseholdco.todayir.com/202504301339281743431795_en.pdf",
  },
  "Q2 2025": {
    slides: "https://media-aseholdco.todayir.com/20250731165805793386696_en.pdf",
    filings: "https://media-aseholdco.todayir.com/202507311438421773330302_en.pdf",
  },
  "Q3 2025": {
    slides: "https://media-aseholdco.todayir.com/20251030163311732454005_en.pdf",
    filings: "https://media-aseholdco.todayir.com/202510301433521761772578_en.pdf",
  },
  "Q4 2025": {
    slides: "https://media-aseholdco.todayir.com/20260205162004792436503_en.pdf",
    filings: "https://media-aseholdco.todayir.com/202602051429461703861031_en.pdf",
  },
  "Q1 2026": {
    slides: "https://media-aseholdco.todayir.com/20260429161930751951703_en.pdf",
    filings: "https://media-aseholdco.todayir.com/202604291442241788960399_en.pdf",
  },
  "Q2 2026": {
    slides: "https://media-aseholdco.todayir.com/20260730160934748430568_en.pdf",
    filings: "https://media-aseholdco.todayir.com/202607301424321791420294_en.pdf",
  }
};

export function isAsxRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|webcast|supplement|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(n);
}

export function isAsxIrPdf(href: string | null | undefined): boolean {
  if (!href || isAsxRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "media-aseholdco.todayir.com" || host.endsWith(".todayir.com"))) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeAsxKnownQuarterDocs(): Map<string, AsxQuarterDocs> {
  return new Map(Object.entries(ASX_KNOWN_QUARTER_DOCS));
}
