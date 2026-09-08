/**
 * TSMC earnings materials as SEC 6-K Exhibit HTML.
 *
 * investor.tsmc.com encrypt_file PDFs are Cloudflare-walled for server-side
 * `/api/ir-pdf` fetches ("Upstream not OK"). The same Presentation (EX-99.2) and
 * Earnings Release (EX-99.1) documents are filed on EDGAR and preview via
 * `/api/sec-exhibit`.
 */

export type TsmcSecQuarterDocs = {
  fiscalPeriodEnd: string;
  slides: string;
  filings: string;
};

export const TSMC_SEC_QUARTER_DOCS: readonly TsmcSecQuarterDocs[] = [
  {
    fiscalPeriodEnd: "2026-06-30",
    slides: "https://www.sec.gov/Archives/edgar/data/1046179/000104617926000451/a2q26presentatione.htm",
    filings: "https://www.sec.gov/Archives/edgar/data/1046179/000104617926000451/a2q26e_withguidancexfinal.htm",
  },
  {
    fiscalPeriodEnd: "2026-03-31",
    slides: "https://www.sec.gov/Archives/edgar/data/1046179/000104617926000199/a1q26presentatione.htm",
    filings: "https://www.sec.gov/Archives/edgar/data/1046179/000104617926000199/a1q26e_withguidancexfinal.htm",
  },
  {
    fiscalPeriodEnd: "2025-12-31",
    slides: "https://www.sec.gov/Archives/edgar/data/1046179/000104617926000008/a4q25presentatione.htm",
    filings: "https://www.sec.gov/Archives/edgar/data/1046179/000104617926000008/a4q25e_withguidancexfinal.htm",
  },
  {
    fiscalPeriodEnd: "2025-09-30",
    slides: "https://www.sec.gov/Archives/edgar/data/1046179/000104617925000116/a3q25presentatione.htm",
    filings: "https://www.sec.gov/Archives/edgar/data/1046179/000104617925000116/a3q25e_withguidancexfinal.htm",
  },
  {
    fiscalPeriodEnd: "2025-06-30",
    slides: "https://www.sec.gov/Archives/edgar/data/1046179/000104617925000082/a2q25presentatione_6kxwm.htm",
    filings: "https://www.sec.gov/Archives/edgar/data/1046179/000104617925000082/a2q25e_withguidancexfinal.htm",
  },
  {
    fiscalPeriodEnd: "2025-03-31",
    slides: "https://www.sec.gov/Archives/edgar/data/1046179/000104617925000035/a1q25presentatione_for6k.htm",
    filings: "https://www.sec.gov/Archives/edgar/data/1046179/000104617925000035/a1q25e_withguidancexfinal.htm",
  },
  {
    fiscalPeriodEnd: "2024-12-31",
    slides: "https://www.sec.gov/Archives/edgar/data/1046179/000104617925000004/a4q24presentatione.htm",
    filings: "https://www.sec.gov/Archives/edgar/data/1046179/000104617925000004/a4q24e_withguidancexfinal.htm",
  },
  {
    fiscalPeriodEnd: "2024-09-30",
    slides: "https://www.sec.gov/Archives/edgar/data/1046179/000104617924000116/a3q24presentatione.htm",
    filings: "https://www.sec.gov/Archives/edgar/data/1046179/000104617924000116/a3q24e_withguidancexfinal.htm",
  },
  {
    fiscalPeriodEnd: "2024-06-30",
    slides: "https://www.sec.gov/Archives/edgar/data/1046179/000104617924000083/a2q24presentatione.htm",
    filings: "https://www.sec.gov/Archives/edgar/data/1046179/000104617924000083/a2q24e_withguidancexfinal.htm",
  },
  {
    fiscalPeriodEnd: "2024-03-31",
    slides: "https://www.sec.gov/Archives/edgar/data/1046179/000104617924000046/a1q24presentatione_x.htm",
    filings: "https://www.sec.gov/Archives/edgar/data/1046179/000104617924000046/a1q24e_withguidancexfinal.htm",
  },
  {
    fiscalPeriodEnd: "2023-12-31",
    slides: "https://www.sec.gov/Archives/edgar/data/1046179/000104617924000005/a4q23presentatione.htm",
    // SEC filename says a4q24; body is Q4 2023 results (filed Jan 18, 2024).
    filings: "https://www.sec.gov/Archives/edgar/data/1046179/000104617924000005/a4q24e_withguidancexfinal.htm",
  },
  {
    fiscalPeriodEnd: "2023-09-30",
    slides: "https://www.sec.gov/Archives/edgar/data/1046179/000104617923000014/a3q23presentatione.htm",
    filings: "https://www.sec.gov/Archives/edgar/data/1046179/000104617923000014/a3q23e_withguidancexfinal.htm",
  },
  {
    fiscalPeriodEnd: "2023-06-30",
    slides: "https://www.sec.gov/Archives/edgar/data/1046179/000162828023025146/a2q23presentatione.htm",
    filings: "https://www.sec.gov/Archives/edgar/data/1046179/000162828023025146/a2q23e_withguidancexfinalx.htm",
  },
  {
    fiscalPeriodEnd: "2023-03-31",
    slides: "https://www.sec.gov/Archives/edgar/data/1046179/000162828023012121/a1q23presentatione.htm",
    filings: "https://www.sec.gov/Archives/edgar/data/1046179/000162828023012121/a1q23e_withguidancexfinal.htm",
  },
  {
    fiscalPeriodEnd: "2022-12-31",
    slides: "https://www.sec.gov/Archives/edgar/data/1046179/000156459023000363/tsm-ex992_8.htm",
    filings: "https://www.sec.gov/Archives/edgar/data/1046179/000156459023000363/tsm-ex991_38.htm",
  },
  {
    fiscalPeriodEnd: "2022-09-30",
    slides: "https://www.sec.gov/Archives/edgar/data/1046179/000156459022034145/tsm-ex992_7.htm",
    filings: "https://www.sec.gov/Archives/edgar/data/1046179/000156459022034145/tsm-ex991_104.htm",
  },
  {
    fiscalPeriodEnd: "2022-06-30",
    slides: "https://www.sec.gov/Archives/edgar/data/1046179/000156459022025726/tsm-ex992_7.htm",
    filings: "https://www.sec.gov/Archives/edgar/data/1046179/000156459022025726/tsm-ex991_6.htm",
  },
  {
    fiscalPeriodEnd: "2022-03-31",
    slides: "https://www.sec.gov/Archives/edgar/data/1046179/000156459022014381/tsm-ex992_7.htm",
    filings: "https://www.sec.gov/Archives/edgar/data/1046179/000156459022014381/tsm-ex991_6.htm",
  },
];

export function tsmcSecDocsByFiscalPeriodEnd(): Map<string, TsmcSecQuarterDocs> {
  const m = new Map<string, TsmcSecQuarterDocs>();
  for (const d of TSMC_SEC_QUARTER_DOCS) m.set(d.fiscalPeriodEnd, d);
  return m;
}
