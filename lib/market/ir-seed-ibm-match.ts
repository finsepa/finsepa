/** IBM IR: earnings charts as slides, press-release PDF as filings. Never prepared remarks / transcript / annual report. */

export type IbmQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

function att(name: string): string {
  return `https://www.ibm.com/investor/att/pdf/${name}`;
}

function aem(uuid: string, file: string): string {
  return `https://www-api.ibm.com/adobe/assets/urn:aaid:aem:${uuid}/original/as/${file}`;
}

export const IBM_IR_PAGES = [
  "https://www.ibm.com/investor/financial-reporting/quarterly-earnings",
] as const;

export const IBM_KNOWN_QUARTER_DOCS: Readonly<Record<string, IbmQuarterDocs>> = {
  "Q2 2026": {
    slides: aem("3eb11bda-a8d6-4360-8ac1-f4570896ba14", "ibm-2q-26-earnings-charts.pdf"),
    filings: aem("7aef6616-f4ae-4206-81d0-d047ada5a3e2", "ibm-2q-26-earnings-press-release.pdf"),
  },
  "Q1 2026": {
    slides: aem("7259fd9f-7ab1-494e-aac7-de8b65d8e5a9", "ibm-1q-26-earnings-charts.pdf"),
    filings: aem("30738a3b-eebf-4967-9ac7-216070cb87b0", "ibm-1q-26-earnings-press-release.pdf"),
  },
  "Q4 2025": {
    slides: aem("edb6a4de-58f0-41df-ab56-60b1c41ce95c", "4q25-charts.pdf"),
    filings: null,
  },
  "Q3 2025": {
    slides: aem("3bcfd7d6-799a-47af-8949-813f704c766f", "ibm-3q-25-earnings-charts.pdf"),
    filings: aem("390a58b8-45e6-4361-adf2-4f08264d1137", "ibm-3q-25-press-release.pdf"),
  },
  "Q2 2025": {
    slides: aem("c3a95aee-38f7-44c7-b6db-f5ea3f8cb848", "ibm-2q25-earnings-charts.pdf"),
    filings: aem("7395b476-2f10-4d25-9d89-98db409d9499", "ibm-2q25-earnings-press-release.pdf"),
  },
  "Q1 2025": {
    slides: aem("1a65ba08-d1b8-44af-af63-48e6e30c930a", "ibm-1q25-earnings-charts.pdf"),
    filings: aem("a643c1e9-f467-4620-94dc-87994a7849c4", "ibm-1q25-earnings-press-release.pdf"),
  },
  "Q4 2024": {
    slides: aem("f3d9fdd7-a459-472b-b40d-b5c465679779", "ibm-4q24-earnings-charts.pdf"),
    filings: aem("cfead24d-565c-412c-b5fd-9966aeec8608", "ibm-4q24-earnings-press-release.pdf"),
  },
  "Q3 2023": {
    slides: att("IBM-3Q23-Earnings-Charts.pdf"),
    filings: att("IBM-3Q23-Earnings-Press-Release.pdf"),
  },
  "Q2 2023": {
    slides: att("IBM-2Q23-Earnings-Charts.pdf"),
    filings: att("IBM-2Q23-Earnings-Press-Release.pdf"),
  },
  "Q1 2023": {
    slides: att("IBM-1Q23-Earnings-Charts.pdf"),
    filings: att("IBM-1Q23-Earnings-Press-Release.pdf"),
  },
  "Q4 2022": {
    slides: att("IBM-4Q22-Earnings-Charts.pdf"),
    filings: att("IBM-4Q22-Earnings-Press-Release.pdf"),
  },
  "Q3 2022": {
    slides: att("IBM-3Q22-Earnings-Charts.pdf"),
    filings: att("IBM-3Q22-Earnings-Press-Release.pdf"),
  },
  "Q2 2022": {
    slides: att("IBM-2Q22-Earnings-Charts.pdf"),
    filings: att("IBM-2Q22-Earnings-Press-Release.pdf"),
  },
  "Q1 2022": {
    slides: att("IBM-1Q22-Earnings-Charts.pdf"),
    filings: att("IBM-1Q22-Earnings-Press-Release.pdf"),
  },
};

export function isIbmRejected(href: string): boolean {
  const n = decodeURIComponent(href).toLowerCase();
  return /sec\.gov|prepared-remarks|prepared.?remarks|transcript|annual.?report/i.test(n);
}

export function isIbmIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  return (
    (/ibm\.com\/investor\/att\/pdf\/IBM-\dQ\d{2}-Earnings-(Charts|Press-Release)\.pdf/i.test(url) ||
      /www-api\.ibm\.com\/adobe\/assets\/urn:aaid:aem:[a-f0-9-]+\/original\/as\/.+\.pdf/i.test(url)) &&
    !isIbmRejected(url)
  );
}

export function mergeIbmKnownQuarterDocs(): Map<string, IbmQuarterDocs> {
  return new Map(Object.entries(IBM_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
