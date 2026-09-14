/**
 * Union Pacific (UNP) IR — calendar FY.
 * Slides = quarterly Presentation; Filings = News Release/Financials PDF.
 * Host: investor.unionpacific.com/static-files (GCS). Never Non-GAAP / podcast / conference / SEC HTML.
 */

export type UnpQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const UNP_STATIC = "https://investor.unionpacific.com/static-files";

function staticFiles(uuid: string): string {
  return `${UNP_STATIC}/${uuid}`;
}

export const UNP_IR_PAGES = [
  "https://investor.unionpacific.com/financials/quarterly-results/",
  "https://investor.unionpacific.com/events-presentations/",
] as const;

/** Browser-extracted Presentation (Slides) + News Release/Financials (Filings) UUIDs. */
export const UNP_KNOWN_QUARTER_DOCS: Readonly<Record<string, UnpQuarterDocs>> = {
  "Q2 2026": {
    slides: staticFiles("85443ec4-228c-432e-b9c3-b2fbeab055a4"),
    filings: staticFiles("159497c7-16ed-4720-b04d-1d0fe47808d4"),
  },
  "Q1 2026": {
    slides: staticFiles("bf90c770-972b-428d-9e9d-1b9cf111800a"),
    filings: staticFiles("b39a3327-88e9-408d-a2ff-7f31744a08e0"),
  },
  "Q4 2025": {
    slides: staticFiles("d0993c32-4b73-4285-bc8f-06a3f7f7e312"),
    filings: staticFiles("5e6be23b-f44f-4e1c-b4cd-fb05540dddc7"),
  },
  "Q3 2025": {
    slides: staticFiles("d37d11eb-adb2-450a-9b8b-f78708425034"),
    filings: staticFiles("23bda260-038e-4be2-a253-87ffd491dd5a"),
  },
  "Q2 2025": {
    slides: staticFiles("a43ccbde-9776-4481-8b46-4860ee929f59"),
    filings: staticFiles("9ea1aad9-6bf3-472e-aae3-e64e5c372e9d"),
  },
  "Q1 2025": {
    slides: staticFiles("cb84d268-88ad-463f-8fdf-3853d4e63a57"),
    filings: staticFiles("45d4abd4-94d7-40a1-8774-6c09c1be512b"),
  },
  "Q4 2024": {
    slides: staticFiles("09cfe47a-dee3-45e8-9420-815c1e097f1d"),
    filings: staticFiles("a6c34b93-f703-4667-8ee7-b2fe668c9c90"),
  },
  "Q3 2024": {
    slides: staticFiles("708a8b82-f455-4079-ad8f-4eff88ddfca3"),
    filings: staticFiles("d69284e3-eb13-4cfd-9912-06cffa9296fb"),
  },
  "Q2 2024": {
    slides: staticFiles("666cca98-8779-48df-8e53-adc443e1a7ae"),
    filings: staticFiles("38b18dec-a223-4efd-a3a7-58dda4829e9a"),
  },
  "Q1 2024": {
    slides: staticFiles("9d5fa589-e69f-4817-99d9-ccd1796c293d"),
    filings: staticFiles("09bc923c-8438-4473-bce3-cb1f4bf5460c"),
  },
  "Q4 2023": {
    slides: staticFiles("57cc700f-bc0a-46da-8812-81f4e1d3ed48"),
    filings: staticFiles("2620559a-311d-4c34-bef1-0f1be6f2cf7b"),
  },
  "Q3 2023": {
    slides: staticFiles("b0175aef-3871-400c-b213-a2748919852e"),
    filings: staticFiles("b1695d29-0a73-4f6e-89c3-5f0696eb50aa"),
  },
  "Q2 2023": {
    slides: staticFiles("ac968d6e-9dd8-4b76-9cad-e8cb726c50aa"),
    filings: staticFiles("31c003c4-77bc-470f-8059-2cbe0ebb4e67"),
  },
  "Q1 2023": {
    slides: staticFiles("bbdd207d-da63-4f92-a3f4-cfb26efc0056"),
    filings: staticFiles("8297616e-b71f-47a8-8c9e-34f0709ba593"),
  },
  "Q4 2022": {
    slides: staticFiles("fb17d233-7024-41e0-97bc-bc3ca45e04f7"),
    filings: staticFiles("9232c23f-75e2-41fd-b04f-cba2e410d2b0"),
  },
  "Q3 2022": {
    slides: staticFiles("e6854bbb-b608-4370-9928-953816ee8985"),
    filings: staticFiles("1cc601c5-1182-4730-9533-5e2a28c9f287"),
  },
  "Q2 2022": {
    slides: staticFiles("56305f9e-379a-4c17-afc7-0bb361aaf82e"),
    filings: staticFiles("13b35451-53c5-4ebe-8445-4fccc29882d2"),
  },
  "Q1 2022": {
    slides: staticFiles("2d9e775a-5920-4297-8a68-2b1dad6986b7"),
    filings: staticFiles("7932bc1b-c3e7-47db-b8c4-8e64e5626b1a"),
  },
};

export function isUnpRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|non[-_\s]*gaap|podcast|transcript|investor[-_\s]*day|conference|pitchbook|merger|stb|\.xls/i.test(
    n,
  );
}

export function isUnpIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (
      !(
        host === "investor.unionpacific.com" ||
        host === "unionpacific.gcs-web.com" ||
        host.endsWith(".unionpacific.com")
      )
    ) {
      return false;
    }
    if (!/\/static-files\/[a-f0-9-]{36}/i.test(u.pathname)) return false;
    return !isUnpRejected(url);
  } catch {
    return false;
  }
}

export function mergeUnpKnownQuarterDocs(): Map<string, UnpQuarterDocs> {
  return new Map(Object.entries(UNP_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
