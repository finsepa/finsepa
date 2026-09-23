/**
 * ITOCY IR seed — 03-31.
 * ITOCHU March FY (folder year = FY end / Finsepa label; Q1 YYYY = Apr–Jun YYYY-1). Slides=Presentation Materials with Script when published, else Business Results Summary (*_02*). Filings=Consolidated Financial Statements/Results (*_01*). Reject Q&A, appendix, exposure, management-plan-only, supplementary. Latest Q1 2027 (Apr–Jun 2026). Never SEC HTML. Scope stats: 21 green / 0 yellow / 0 red quarter(s). All locked URLs Range-GET %PDF.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type ItocyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const ITOCY_IR_PAGES = [
  "https://www.itochu.co.jp/en/ir/financial_statements/index.html",
] as const;

export const ITOCY_KNOWN_QUARTER_DOCS: Readonly<Record<string, ItocyQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://www.itochu.co.jp/en/ir/financial_statements/2022/__icsFiles/afieldfile/2021/08/04/22_1st_02_e_2.pdf",
    filings: "https://www.itochu.co.jp/en/ir/financial_statements/2022/__icsFiles/afieldfile/2021/08/04/22_1st_01_e.pdf",
  },
  "Q2 2022": {
    slides: "https://www.itochu.co.jp/en/ir/financial_statements/2022/__icsFiles/afieldfile/2021/11/05/22_2nd_02_e.pdf",
    filings: "https://www.itochu.co.jp/en/ir/financial_statements/2022/__icsFiles/afieldfile/2021/11/05/22_2nd_01_e.pdf",
  },
  "Q3 2022": {
    slides: "https://www.itochu.co.jp/en/ir/financial_statements/2022/__icsFiles/afieldfile/2022/02/03/22_3rd_02_e_1.pdf",
    filings: "https://www.itochu.co.jp/en/ir/financial_statements/2022/__icsFiles/afieldfile/2022/02/03/22_3rd_01_e_1.pdf",
  },
  "Q4 2022": {
    slides: "https://www.itochu.co.jp/en/ir/financial_statements/2022/__icsFiles/afieldfile/2022/08/04/22_ended_02_e_1.pdf",
    filings: "https://www.itochu.co.jp/en/ir/financial_statements/2022/__icsFiles/afieldfile/2022/05/10/22_ended_01_e.pdf",
  },
  "Q1 2023": {
    slides: "https://www.itochu.co.jp/en/ir/financial_statements/2023/__icsFiles/afieldfile/2022/08/05/23_1st_02_e.pdf",
    filings: "https://www.itochu.co.jp/en/ir/financial_statements/2023/__icsFiles/afieldfile/2022/08/05/23_1st_01_e.pdf",
  },
  "Q2 2023": {
    slides: "https://www.itochu.co.jp/en/ir/financial_statements/2023/__icsFiles/afieldfile/2022/11/04/23_2nd_02_e.pdf",
    filings: "https://www.itochu.co.jp/en/ir/financial_statements/2023/__icsFiles/afieldfile/2022/11/04/23_2nd_01_e.pdf",
  },
  "Q3 2023": {
    slides: "https://www.itochu.co.jp/en/ir/financial_statements/2023/__icsFiles/afieldfile/2023/02/03/23_3rd_02_e.pdf",
    filings: "https://www.itochu.co.jp/en/ir/financial_statements/2023/__icsFiles/afieldfile/2023/02/03/23_3rd_01_e.pdf",
  },
  "Q4 2023": {
    slides: "https://www.itochu.co.jp/en/ir/financial_statements/2023/__icsFiles/afieldfile/2023/05/11/23_ended_02_e.pdf",
    filings: "https://www.itochu.co.jp/en/ir/financial_statements/2023/__icsFiles/afieldfile/2023/05/09/23_ended_01_e.pdf",
  },
  "Q1 2024": {
    slides: "https://www.itochu.co.jp/en/ir/financial_statements/2024/__icsFiles/afieldfile/2024/06/06/24_1st_02_e.pdf",
    filings: "https://www.itochu.co.jp/en/ir/financial_statements/2024/__icsFiles/afieldfile/2023/08/04/24_1st_01_e.pdf",
  },
  "Q2 2024": {
    slides: "https://www.itochu.co.jp/en/ir/financial_statements/2024/__icsFiles/afieldfile/2024/06/06/24_2nd_02_e.pdf",
    filings: "https://www.itochu.co.jp/en/ir/financial_statements/2024/__icsFiles/afieldfile/2023/11/06/24_2nd_01_e_1.pdf",
  },
  "Q3 2024": {
    slides: "https://www.itochu.co.jp/en/ir/financial_statements/2024/__icsFiles/afieldfile/2024/06/06/24_3rd_02_e_1.pdf",
    filings: "https://www.itochu.co.jp/en/ir/financial_statements/2024/__icsFiles/afieldfile/2024/02/05/24_3rd_01_e_1.pdf",
  },
  "Q4 2024": {
    slides: "https://www.itochu.co.jp/en/ir/financial_statements/2024/__icsFiles/afieldfile/2024/06/06/24_ended_02_e.pdf",
    filings: "https://www.itochu.co.jp/en/ir/financial_statements/2024/__icsFiles/afieldfile/2024/05/08/24_ended_01_e_2.pdf",
  },
  "Q1 2025": {
    slides: "https://www.itochu.co.jp/en/ir/financial_statements/2025/__icsFiles/afieldfile/2024/08/09/25_1st_02_e_2.pdf",
    filings: "https://www.itochu.co.jp/en/ir/financial_statements/2025/__icsFiles/afieldfile/2024/09/30/25_1st_01_e.pdf",
  },
  "Q2 2025": {
    slides: "https://www.itochu.co.jp/en/ir/financial_statements/2025/__icsFiles/afieldfile/2024/11/11/25_2nd_02_e_2.pdf",
    filings: "https://www.itochu.co.jp/en/ir/financial_statements/2025/__icsFiles/afieldfile/2024/11/06/25_2nd_01_e.pdf",
  },
  "Q3 2025": {
    slides: "https://www.itochu.co.jp/en/ir/financial_statements/2025/__icsFiles/afieldfile/2025/02/10/25_3rd_02_e.pdf",
    filings: "https://www.itochu.co.jp/en/ir/financial_statements/2025/__icsFiles/afieldfile/2025/02/12/25_3rd_01_e.pdf",
  },
  "Q4 2025": {
    slides: "https://www.itochu.co.jp/en/ir/financial_statements/2025/__icsFiles/afieldfile/2026/02/09/25_ended_02_e.pdf",
    filings: "https://www.itochu.co.jp/en/ir/financial_statements/2025/__icsFiles/afieldfile/2025/05/02/25_ended_01_e_1.pdf",
  },
  "Q1 2026": {
    slides: "https://www.itochu.co.jp/en/ir/financial_statements/2026/__icsFiles/afieldfile/2025/11/19/26_1st_02_e_2.pdf",
    filings: "https://www.itochu.co.jp/en/ir/financial_statements/2026/__icsFiles/afieldfile/2025/08/06/26_1st_01_e.pdf",
  },
  "Q2 2026": {
    slides: "https://www.itochu.co.jp/en/ir/financial_statements/2026/__icsFiles/afieldfile/2026/02/13/26_2nd_02_e.pdf",
    filings: "https://www.itochu.co.jp/en/ir/financial_statements/2026/__icsFiles/afieldfile/2025/11/05/26_2nd_01_e.pdf",
  },
  "Q3 2026": {
    slides: "https://www.itochu.co.jp/en/ir/financial_statements/2026/__icsFiles/afieldfile/2026/02/13/26_3rd_02_e.pdf",
    filings: "https://www.itochu.co.jp/en/ir/financial_statements/2026/__icsFiles/afieldfile/2026/02/13/26_3rd_01_e.pdf",
  },
  "Q4 2026": {
    slides: "https://www.itochu.co.jp/en/ir/financial_statements/2026/__icsFiles/afieldfile/2026/05/14/26_ended_02_e_1.pdf",
    filings: "https://www.itochu.co.jp/en/ir/financial_statements/2026/__icsFiles/afieldfile/2026/05/01/26_ended_01_e.pdf",
  },
  "Q1 2027": {
    slides: "https://www.itochu.co.jp/en/ir/financial_statements/2027/__icsFiles/afieldfile/2026/08/07/27_1st_02_e.pdf",
    filings: "https://www.itochu.co.jp/en/ir/financial_statements/2027/__icsFiles/afieldfile/2026/08/06/27_1st_01_e.pdf",
  },
};

export function isItocyRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  // Slides use *_02_e / *_04_e…*_07_e / ended_0[4-7]_e; filings use *_01_e. Reject Q&A (*_03_e), plans, work-style, appendices.
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(n) || /work.?style|_03_e|_plan_e|qa.?summary|appendix|exposure/i.test(n);
}

export function isItocyIrPdf(href: string | null | undefined): boolean {
  if (!href || isItocyRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.itochu.co.jp" || host.endsWith(".itochu.co.jp"))) return false;
    if (!(u.pathname.includes("/financial_statements/") || u.pathname.includes("/ir/"))) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeItocyKnownQuarterDocs(): Map<string, ItocyQuarterDocs> {
  return new Map(Object.entries(ITOCY_KNOWN_QUARTER_DOCS));
}
