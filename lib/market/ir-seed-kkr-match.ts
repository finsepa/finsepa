/**
 * KKR IR seed — 12-31.
 * KKR calendar FY. Slides=Investor Presentation; Filings=Earnings Release on ir.kkr.com EQS. Latest Q2 2026. Scope stats: 15 green / 3 yellow / 0 red quarter(s). Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type KkrQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const KKR_IR_PAGES = [
  "https://ir.kkr.com/",
  "https://ir.kkr.com/financial-information/financial-document-library",
] as const;

export const KKR_KNOWN_QUARTER_DOCS: Readonly<Record<string, KkrQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://ir.kkr.com/media/document/be532d64-eaa7-41fc-b217-641b37276087/assets/KKR-Investor-Presentation-May-2022.pdf",
    filings: "https://ir.kkr.com/media/document/f00c7b62-0429-4665-a619-54c53d14b8e0/assets/Q122-KKR-Earnings-Release.pdf",
  },
  "Q2 2022": {
    slides: "https://ir.kkr.com/media/document/81a4e655-c6ce-4a08-8bdc-9ef18f40f0a0/assets/KKR-Investor-Presentation-September-2022-Long-Form.pdf",
    filings: "https://ir.kkr.com/media/document/72bdb2c9-6ecb-4141-b3c9-450efc454014/assets/KKR-Q222-Earnings-Release.pdf",
  },
  "Q3 2022": {
    slides: null,
    filings: "https://ir.kkr.com/media/document/525e67f2-3d50-46ab-8c0d-5eee2b9132e6/assets/KKR-Q322-Earnings-Release.pdf",
  },
  "Q4 2022": {
    slides: "https://ir.kkr.com/media/document/b3cdde94-b466-4418-8a4a-ea443a569706/assets/February-2023-KKR-Investor-Presentation.pdf",
    filings: "https://ir.kkr.com/media/document/620d9b51-5279-40b7-9646-80d6544e3e28/assets/KKR-Q422-Earnings-Release.pdf",
  },
  "Q1 2023": {
    slides: "https://ir.kkr.com/media/document/73be1bd1-a323-495d-b446-41f7e5904a39/assets/KKR-Investor-Presentation-June-2023.pdf",
    filings: "https://ir.kkr.com/media/document/c037fbf5-2174-4a48-95d2-835150ec188b/assets/KKR-Q123-Earnings-Release.pdf",
  },
  "Q2 2023": {
    slides: "https://ir.kkr.com/media/document/58a5b7d3-e471-4280-bfc1-45f4015f0ca1/assets/KKR-Investor-Presentation-September-2023.pdf",
    filings: "https://ir.kkr.com/media/document/ec1ad358-96bc-40b7-baa0-0954223c5e55/assets/KKR%20Q223%20Earnings%20Release.pdf",
  },
  "Q3 2023": {
    slides: null,
    filings: "https://ir.kkr.com/media/document/c6682701-e870-4fae-b1ed-e735c8dcd509/assets/KKR-Q323-Earnings-Release.pdf",
  },
  "Q4 2023": {
    slides: null,
    filings: "https://ir.kkr.com/media/document/b18aa046-42b5-4f8c-8b4a-b206555487e5/assets/KKR-Q423-Earnings-Release.pdf",
  },
  "Q1 2024": {
    slides: "https://ir.kkr.com/media/document/041a2cb4-bc34-47c8-86ad-79573c4b0914/assets/KKR-Investor-Presentation-June-2024.pdf",
    filings: "https://ir.kkr.com/media/document/41be63c4-89c8-43d3-9f2f-8a5ea867fe44/assets/KKR-Q124-Earnings-Release.pdf",
  },
  "Q2 2024": {
    slides: "https://ir.kkr.com/media/document/eb65be80-405c-439f-b5ba-724daf98e89b/assets/KKR-Investor-Presentation-September-2024.pdf",
    filings: "https://ir.kkr.com/media/document/bb5d72b6-937c-4be8-93d6-6d7319b52d6a/assets/KKR-Q224-Earnings-Release.pdf",
  },
  "Q3 2024": {
    slides: "https://ir.kkr.com/media/document/ed874da1-2739-47aa-abab-07336f6dc1e3/assets/KKR-Investor-Presentation-December-2023.pdf",
    filings: "https://ir.kkr.com/media/document/015ec421-e08b-4aeb-b430-b8cb0a58fda5/assets/KKR-Q324-Earnings-Release.pdf",
  },
  "Q4 2024": {
    slides: "https://ir.kkr.com/media/document/04d4009a-0747-4e92-b65d-dab34d93d981/assets/KKR_Investor_Presentation_-_February_2025.pdf",
    filings: "https://ir.kkr.com/media/document/303ebb79-89b5-4026-8422-130803394f8d/assets/KKR-Q424-Earnings-Release.pdf",
  },
  "Q1 2025": {
    slides: "https://ir.kkr.com/media/document/db93e117-b10b-406d-891a-55a563e13e9b/assets/KKR_Investor_Presentation_-_May_2025.pdf",
    filings: "https://ir.kkr.com/media/document/adc82b4e-6ee3-42f4-a4b8-8c3332ba84c3/assets/KKR_Q125_Earnings_Release_1.pdf",
  },
  "Q2 2025": {
    slides: "https://ir.kkr.com/media/document/8851bb2e-7131-49d2-88fb-4acbfe846a9e/assets/KKR_Investor_Presentation_-_August_2025.pdf",
    filings: "https://ir.kkr.com/media/document/7e33e19b-aae2-4c8b-a9b2-42c019b20d2c/assets/KKR_Q225_Earnings_Release.pdf",
  },
  "Q3 2025": {
    slides: "https://ir.kkr.com/media/document/b01a1083-81d8-4efb-9fa8-72300eba03cd/assets/KKR_Investor_Presentation_-_November_2025.pdf",
    filings: "https://ir.kkr.com/media/document/d5a1745d-7f75-4d4e-b0ad-a4a02ef6ffee/assets/KKR_Q325_Earnings_Release.pdf",
  },
  "Q4 2025": {
    slides: "https://ir.kkr.com/media/document/58513ecd-9a82-4fcc-9d2f-a954b7039665/assets/KKR_Investor_Presentation_-_February_2026.pdf",
    filings: "https://ir.kkr.com/media/document/e3d1dd24-a3a9-4c7d-8466-d0a53595081e/assets/KKR_Q425_Earnings_Release.pdf",
  },
  "Q1 2026": {
    slides: "https://ir.kkr.com/media/document/caef3665-ef35-4ef4-bd42-2f51c040b8a4/assets/KKR_Investor_Presentation_-_May_2026.pdf",
    filings: "https://ir.kkr.com/media/document/97877ef9-66da-4d11-8742-d76f2fc04354/assets/KKR_Q126_Earnings_Release.pdf",
  },
  "Q2 2026": {
    slides: "https://ir.kkr.com/media/document/ecf43357-e2a7-4abd-bd6f-933dd0e62501/assets/KKR_Investor_Presentation_-_August_2026.pdf",
    filings: "https://ir.kkr.com/media/document/15a25fa9-8226-4da1-9ff3-027b9803d436/assets/KKR_Q226_Earnings_Release.pdf",
  },
};

export function isKkrRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab|strategic.?update/i.test(n);
}

export function isKkrIrPdf(href: string | null | undefined): boolean {
  if (!href || isKkrRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "ir.kkr.com" || host.endsWith(".kkr.com"))) return false;
    if (!u.pathname.includes("/media/document/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeKkrKnownQuarterDocs(): Map<string, KkrQuarterDocs> {
  return new Map(Object.entries(KKR_KNOWN_QUARTER_DOCS));
}
