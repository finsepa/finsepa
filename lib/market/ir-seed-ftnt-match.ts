/**
 * Fortinet (FTNT) IR — calendar FY.
 * Slides = earnings presentation static-files UUID; Filings = EX 99.1 static-files when published.
 * Older quarters often filings-null (HTML press only). Never prepared remarks / 10-Q / SEC HTML.
 */

export type FtntQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const FTNT_IR_PAGES = [
  "https://investor.fortinet.com/",
  "https://investor.fortinet.com/events-and-presentations",
  "https://investor.fortinet.com/financial-releases",
] as const;

/** Catalog Q1 2022 → Q2 2026. */
export const FTNT_KNOWN_QUARTER_DOCS: Readonly<Record<string, FtntQuarterDocs>> = {
  "Q2 2026": {
    slides: "https://investor.fortinet.com/static-files/657dfcda-7367-4c36-8259-b0b43a535da1",
    filings: "https://investor.fortinet.com/static-files/e4ffcc79-194e-4ca3-9a69-8a51bd0a6314",
  },
  "Q1 2026": {
    slides: "https://investor.fortinet.com/static-files/9dc7117a-d2dc-4d9f-b151-c2eea950a0e4",
    filings: "https://investor.fortinet.com/static-files/98008e24-af31-46aa-a962-375e653af2a3",
  },
  "Q4 2025": {
    slides: "https://investor.fortinet.com/static-files/38d0dd08-09e6-4426-ae20-6e4c0e1ad992",
    filings: "https://investor.fortinet.com/static-files/31153c1c-400c-4af8-b978-35d4bece7128",
  },
  "Q3 2025": {
    slides: "https://investor.fortinet.com/static-files/b9f68751-242f-4090-8434-fa34680302ba",
    filings: "https://investor.fortinet.com/static-files/23528d89-ce1c-4251-8ccc-29f34c7cb73d",
  },
  "Q2 2025": {
    slides: "https://investor.fortinet.com/static-files/be2cd17e-9338-4ad0-8b4a-d2141c8bf8ca",
    filings: "https://investor.fortinet.com/static-files/c9e8d750-4437-4ba1-931c-e520f19b1b0e",
  },
  "Q1 2025": {
    slides: "https://investor.fortinet.com/static-files/4fe7d294-0134-4847-ae4f-a6ebd4914273",
    filings: null,
  },
  "Q4 2024": {
    slides: "https://investor.fortinet.com/static-files/037f65fc-0c2b-4f4f-b334-30c58205e0f5",
    filings: null,
  },
  "Q3 2024": {
    slides: "https://investor.fortinet.com/static-files/fc1a91b9-2f08-4c61-8d59-5637432d8878",
    filings: null,
  },
  "Q2 2024": {
    slides: "https://investor.fortinet.com/static-files/0c273d08-3270-446d-9a3b-17d65d18506a",
    filings: "https://investor.fortinet.com/static-files/5e53c743-d9d6-466c-b2ba-38800f47fb13",
  },
  "Q1 2024": {
    slides: "https://investor.fortinet.com/static-files/a28eeae0-6f81-4ab0-a155-b0de2b73c146",
    filings: null,
  },
  "Q4 2023": {
    slides: "https://investor.fortinet.com/static-files/7a458f34-8c89-43e6-b806-0ef941ce54fe",
    filings: null,
  },
  "Q3 2023": {
    slides: "https://investor.fortinet.com/static-files/026c2424-7bf8-4766-970d-ab84cbeebec5",
    filings: null,
  },
  "Q2 2023": {
    slides: "https://investor.fortinet.com/static-files/10ea2195-7288-4dd1-bc6d-bade629bf26e",
    filings: null,
  },
  "Q1 2023": {
    slides: "https://investor.fortinet.com/static-files/f980ac27-60fc-467f-b154-899c2698311b",
    filings: null,
  },
  "Q4 2022": {
    slides: "https://investor.fortinet.com/static-files/451e63be-9e73-41ad-a90b-e64490b7c645",
    filings: null,
  },
  "Q3 2022": {
    slides: "https://investor.fortinet.com/static-files/da142bc6-5549-4e7b-9a91-8762cebebeb4",
    filings: null,
  },
  "Q2 2022": {
    slides: "https://investor.fortinet.com/static-files/70db2f7e-4f0e-4eae-ac79-bd830e8f2b76",
    filings: null,
  },
  "Q1 2022": {
    slides: "https://investor.fortinet.com/static-files/fe99200a-14bb-48b5-9204-911b6855efc6",
    filings: null,
  },
};

export function isFtntRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|proxy|transcript|prepared[-_\s]*remarks|investor[-_\s]*day|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(
    n,
  );
}

export function isFtntIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (
      !(
        host === "investor.fortinet.com" ||
        host === "fortinet.gcs-web.com" ||
        host.endsWith(".fortinet.com")
      )
    ) {
      return false;
    }
    if (!/\/static-files\/[a-f0-9-]{36}/i.test(u.pathname)) return false;
    return !isFtntRejected(url);
  } catch {
    return false;
  }
}

export function mergeFtntKnownQuarterDocs(): Map<string, FtntQuarterDocs> {
  return new Map(Object.entries(FTNT_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
