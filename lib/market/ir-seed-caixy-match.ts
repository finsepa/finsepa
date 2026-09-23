/**
 * CAIXY IR seed — 12-31.
 * CaixaBank SA ADR (CAIXY) calendar FY. Slides=Webcast_*_en presentation; Filings=Informe Financiero / IF_* ENG. Latest Q2 2026. Scope stats: 18 green / 0 yellow / 0 red quarter(s). Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type CaixyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const CAIXY_IR_PAGES = [
  "https://www.caixabank.com/en/shareholders-investors/economic-financial-information.html",
] as const;

export const CAIXY_KNOWN_QUARTER_DOCS: Readonly<Record<string, CaixyQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://www.caixabank.com/deployedfiles/caixabank_com/Estaticos/PDFs/Accionistasinversores/Informacion_economico_financiera/220429_Webcast_1T22_en.pdf",
    filings: "https://www.caixabank.com/deployedfiles/caixabank_com/Estaticos/PDFs/Accionistasinversores/Informacion_economico_financiera/Informe-Financiero-1T22-ENG.pdf",
  },
  "Q2 2022": {
    slides: "https://www.caixabank.com/deployedfiles/caixabank_com/Estaticos/PDFs/Accionistasinversores/Informacion_economico_financiera/220729_Webcast_1S22_en.pdf",
    filings: "https://www.caixabank.com/deployedfiles/caixabank_com/Estaticos/PDFs/Accionistasinversores/Informacion_economico_financiera/InformeFinanciero2T22_ENG.pdf",
  },
  "Q3 2022": {
    slides: "https://www.caixabank.com/deployedfiles/caixabank_com/Estaticos/PDFs/Accionistasinversores/Informacion_economico_financiera/221028_Webcast_3T22_en.pdf",
    filings: "https://www.caixabank.com/deployedfiles/caixabank_com/Estaticos/PDFs/Accionistasinversores/Informacion_economico_financiera/InformeFinanciero3T22ENG.pdf",
  },
  "Q4 2022": {
    slides: "https://www.caixabank.com/deployedfiles/caixabank_com/Estaticos/PDFs/Accionistasinversores/caixabank_com/Estaticos/PDFs/Accionistasinversores/Informacion_economico_financiera/220203_Webcast_4T22_en.pdf",
    filings: "https://www.caixabank.com/deployedfiles/caixabank_com/Estaticos/PDFs/Accionistasinversores/caixabank_com/Estaticos/PDFs/Accionistasinversores/Informacion_economico_financiera/Informe_Financiero_4T22_ENG.pdf",
  },
  "Q1 2023": {
    slides: "https://www.caixabank.com/deployedfiles/caixabank_com/Estaticos/PDFs/Accionistasinversores/Informacion_economico_financiera/230505_Webcast_1T23_en.pdf",
    filings: "https://www.caixabank.com/deployedfiles/caixabank_com/Estaticos/PDFs/Accionistasinversores/Informacion_economico_financiera/Informe_Financiero_1T23_ENG.pdf",
  },
  "Q2 2023": {
    slides: "https://www.caixabank.com/deployedfiles/caixabank_com/Estaticos/PDFs/Accionistasinversores/Informacion_economico_financiera/230728_Webcast_1S23_en.pdf",
    filings: "https://www.caixabank.com/deployedfiles/caixabank_com/Estaticos/PDFs/Accionistasinversores/Informacion_economico_financiera/IF_2T23_ENG.pdf",
  },
  "Q3 2023": {
    slides: "https://www.caixabank.com/deployedfiles/caixabank_com/Estaticos/PDFs/Accionistasinversores/Informacion_economico_financiera/231027_Webcast_3T23_en.pdf",
    filings: "https://www.caixabank.com/deployedfiles/caixabank_com/Estaticos/PDFs/Accionistasinversores/Informacion_economico_financiera/IF3T23_EN.pdf",
  },
  "Q4 2023": {
    slides: "https://www.caixabank.com/deployedfiles/caixabank_com/Estaticos/PDFs/Accionistasinversores/Informacion_economico_financiera/240202_Webcast_2023_en.pdf",
    filings: "https://www.caixabank.com/deployedfiles/caixabank_com/Estaticos/PDFs/Accionistasinversores/Informacion_economico_financiera/IF4T23_ENG.pdf",
  },
  "Q1 2024": {
    slides: "https://www.caixabank.com/deployedfiles/caixabank_com/Estaticos/PDFs/Accionistasinversores/Informacion_economico_financiera/240430_Webcast_1T24_en.pdf",
    filings: "https://www.caixabank.com/deployedfiles/caixabank_com/Estaticos/PDFs/Accionistasinversores/Informacion_economico_financiera/IF_ENG_1T24.pdf",
  },
  "Q2 2024": {
    slides: "https://www.caixabank.com/deployedfiles/caixabank_com/Estaticos/PDFs/Accionistasinversores/Informacion_economico_financiera/230731_Webcast_1S24_en.pdf",
    filings: "https://www.caixabank.com/deployedfiles/caixabank_com/Estaticos/PDFs/Accionistasinversores/Informacion_economico_financiera/IF_ENG_2T24.pdf",
  },
  "Q3 2024": {
    slides: "https://www.caixabank.com/deployedfiles/caixabank_com/Estaticos/PDFs/Accionistasinversores/Informacion_economico_financiera/241031_Webcast_3T24_en.pdf",
    filings: "https://www.caixabank.com/deployedfiles/caixabank_com/Estaticos/PDFs/Accionistasinversores/Informacion_economico_financiera/IFENG3T24.pdf",
  },
  "Q4 2024": {
    slides: "https://www.caixabank.com/deployedfiles/caixabank_com/Estaticos/PDFs/Accionistasinversores/Informacion_economico_financiera/250130_OIR_Webcast_2024_en.pdf",
    filings: "https://www.caixabank.com/deployedfiles/caixabank_com/Estaticos/PDFs/Accionistasinversores/Informacion_economico_financiera/IF_4T24_ENG.pdf",
  },
  "Q1 2025": {
    slides: "https://www.caixabank.com/deployedfiles/caixabank_com/Estaticos/PDFs/Accionistasinversores/Informacion_economico_financiera/250430_Webcast_1T25_en.pdf",
    filings: "https://www.caixabank.com/deployedfiles/caixabank_com/Estaticos/PDFs/Accionistasinversores/Informacion_economico_financiera/IF_1T_25_ENG.pdf",
  },
  "Q2 2025": {
    slides: "https://www.caixabank.com/deployedfiles/caixabank_com/Estaticos/PDFs/Accionistasinversores/Informacion_economico_financiera/250730_Webcast_1S25_en.pdf",
    filings: "https://www.caixabank.com/deployedfiles/caixabank_com/Estaticos/PDFs/Accionistasinversores/Informacion_economico_financiera/IF_2T25_ENG.pdf",
  },
  "Q3 2025": {
    slides: "https://www.caixabank.com/deployedfiles/caixabank_com/Estaticos/PDFs/Accionistasinversores/Informacion_economico_financiera/251031_Webcast_3T25_en.pdf",
    filings: "https://www.caixabank.com/deployedfiles/caixabank_com/Estaticos/PDFs/Accionistasinversores/Informacion_economico_financiera/IF_ENG_3T25.pdf",
  },
  "Q4 2025": {
    slides: "https://www.caixabank.com/deployedfiles/caixabank_com/Estaticos/PDFs/Accionistasinversores/Informacion_economico_financiera/Webcast_FY2025_en.pdf",
    filings: "https://www.caixabank.com/deployedfiles/caixabank_com/Estaticos/PDFs/Accionistasinversores/Informacion_economico_financiera/IF_4T25_ENG.pdf",
  },
  "Q1 2026": {
    slides: "https://www.caixabank.com/deployedfiles/caixabank_com/Estaticos/PDFs/Accionistasinversores/Informacion_economico_financiera/Webcast_1T26_en.pdf",
    filings: "https://www.caixabank.com/deployedfiles/caixabank_com/Estaticos/PDFs/Accionistasinversores/Informacion_economico_financiera/IF_1T26_ENG.pdf",
  },
  "Q2 2026": {
    slides: "https://www.caixabank.com/deployedfiles/caixabank_com/Estaticos/PDFs/Accionistasinversores/Informacion_economico_financiera/Webcast_2T26_en.pdf",
    filings: "https://www.caixabank.com/deployedfiles/caixabank_com/Estaticos/PDFs/Accionistasinversores/Informacion_economico_financiera/IF_2T26_ENG.pdf",
  },
};

export function isCaixyRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|informe.?anual|sustainab|esg|climate/i.test(n);
}

export function isCaixyIrPdf(href: string | null | undefined): boolean {
  if (!href || isCaixyRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.caixabank.com" || host.endsWith(".caixabank.com"))) return false;
    if (!(u.pathname.includes("/Accionistasinversores/") || u.pathname.includes("/PDFs/") || u.pathname.includes("/deployedfiles/"))) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeCaixyKnownQuarterDocs(): Map<string, CaixyQuarterDocs> {
  return new Map(Object.entries(CAIXY_KNOWN_QUARTER_DOCS));
}
