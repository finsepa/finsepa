/**
 * PSTVY IR seed — 12-31.
 * PSBC ADR calendar FY. Slides=Results Presentations (Interim→Q2, Annual→Q4); Filings=quarterly/interim/annual reports on psbc.com. Latest Q2 2026. Scope stats: 9 green / 9 yellow / 0 red quarter(s). Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type PstvyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const PSTVY_IR_PAGES = [
  "https://www.psbc.com/en/investor_relations/",
] as const;

export const PSTVY_KNOWN_QUARTER_DOCS: Readonly<Record<string, PstvyQuarterDocs>> = {
  "Q1 2022": {
    slides: null,
    filings: "https://www.psbc.com/en/investor_relations/finance/financial_reports/202204/P020220429658247180648.pdf",
  },
  "Q2 2022": {
    slides: "https://www.psbc.com/en/investor_relations/result_Presenta/202209/P020220908622883523772.pdf",
    filings: "https://www.psbc.com/en/investor_relations/finance/financial_reports/202209/P020220915344288552050.pdf",
  },
  "Q3 2022": {
    slides: null,
    filings: "https://www.psbc.com/en/investor_relations/finance/financial_reports/202304/P020230425351879567222.pdf",
  },
  "Q4 2022": {
    slides: "https://www.psbc.com/en/investor_relations/result_Presenta/202304/P020230414666560740064.pdf",
    filings: "https://www.psbc.com/en/investor_relations/finance/financial_reports/202304/P020230425349814170031.pdf",
  },
  "Q1 2023": {
    slides: null,
    filings: "https://www.psbc.com/en/investor_relations/announcement/202304/P020230427684063336052.pdf",
  },
  "Q2 2023": {
    slides: "https://www.psbc.com/en/investor_relations/result_Presenta/202309/P020230911684057929951.pdf",
    filings: "https://www.psbc.com/en/investor_relations/announcement/202309/P020230915292151455226.pdf",
  },
  "Q3 2023": {
    slides: null,
    filings: "https://www.psbc.com/en/investor_relations/announcement/202310/P020231027659537508245.pdf",
  },
  "Q4 2023": {
    slides: "https://www.psbc.com/en/investor_relations/result_Presenta/202404/P020240418370531810456.pdf",
    filings: "https://www.psbc.com/en/investor_relations/finance/financial_reports/202404/P020240418319327969537.pdf",
  },
  "Q1 2024": {
    slides: null,
    filings: "https://www.psbc.com/en/investor_relations/finance/financial_reports/202404/P020240430411833206822.pdf",
  },
  "Q2 2024": {
    slides: "https://www.psbc.com/en/investor_relations/result_Presenta/202409/P020240927708046884881.pdf",
    filings: "https://www.psbc.com/en/investor_relations/finance/financial_reports/202409/P020240913266242151379.pdf",
  },
  "Q3 2024": {
    slides: null,
    filings: "https://www.psbc.com/en/investor_relations/finance/financial_reports/202410/P020241030634725041318.pdf",
  },
  "Q4 2024": {
    slides: "https://www.psbc.com/en/investor_relations/result_Presenta/202504/P020250428617043619607.pdf",
    filings: "https://www.psbc.com/en/investor_relations/finance/financial_reports/202503/P020250327809149171009.pdf",
  },
  "Q1 2025": {
    slides: null,
    filings: "https://www.psbc.com/en/investor_relations/finance/financial_reports/202504/P020250429627702148715.pdf",
  },
  "Q2 2025": {
    slides: "https://www.psbc.com/en/investor_relations/result_Presenta/202509/P020250917560125045381.pdf",
    filings: "https://www.psbc.com/en/investor_relations/finance/financial_reports/202509/P020250911241592234226.pdf",
  },
  "Q3 2025": {
    slides: null,
    filings: "https://www.psbc.com/en/investor_relations/finance/financial_reports/202510/P020251030622246533848.pdf",
  },
  "Q4 2025": {
    slides: "https://www.psbc.com/en/investor_relations/result_Presenta/202604/P020260914399352225181.pdf",
    filings: "https://www.psbc.com/en/investor_relations/finance/financial_reports/202604/P020260415322721338496.pdf",
  },
  "Q1 2026": {
    slides: null,
    filings: "https://www.psbc.com/en/investor_relations/finance/financial_reports/202604/P020260429622933539310.pdf",
  },
  "Q2 2026": {
    slides: "https://www.psbc.com/en/investor_relations/result_Presenta/202609/P020260911639407292871.pdf",
    filings: "https://www.psbc.com/en/investor_relations/finance/financial_reports/202609/P020260911315523824589.pdf",
  },
};

export function isPstvyRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab/i.test(n);
}

export function isPstvyIrPdf(href: string | null | undefined): boolean {
  if (!href || isPstvyRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.psbc.com" || host.endsWith(".psbc.com"))) return false;
    if (!u.pathname.includes("/investor_relations/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(href);
  } catch {
    return false;
  }
}

export function mergePstvyKnownQuarterDocs(): Map<string, PstvyQuarterDocs> {
  return new Map(Object.entries(PSTVY_KNOWN_QUARTER_DOCS));
}
