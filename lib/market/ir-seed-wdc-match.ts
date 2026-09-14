/**
 * Western Digital (WDC) IR — FY ends ~06-30 (Q4 FY26 ended 2026-07-03).
 * Slides = Presentation; Filings = Press Release. Host: investor.wdc.com/static-files (GCS).
 * Never Spin / Reconciliations / 10-Q / 10-K / webcast / SEC HTML.
 */

export type WdcQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

/** Issuer FY ends ~June/early July. */
export const WDC_FY_END = "06-30";

const WDC_STATIC = "https://investor.wdc.com/static-files";

function staticFiles(uuid: string): string {
  return `${WDC_STATIC}/${uuid}`;
}

export const WDC_IR_PAGES = [
  "https://investor.wdc.com/financial-information/earnings-documents",
  "https://investor.wdc.com/",
] as const;

/** Browser-extracted Presentation (Slides) + Press Release (Filings) UUIDs; %PDF-probed. */
export const WDC_KNOWN_QUARTER_DOCS: Readonly<Record<string, WdcQuarterDocs>> = {
  "Q4 2026": {
    slides: staticFiles("e1f02f77-4432-42c3-8bd4-024371f40e54"),
    filings: staticFiles("a6470e24-6dec-4fae-9b35-69777f704e3a"),
  },
  "Q3 2026": {
    slides: staticFiles("5b2d41c1-7d45-4575-b9ea-c51424dbffeb"),
    filings: staticFiles("b08457c3-7879-45ca-a512-d30f21832299"),
  },
  "Q2 2026": {
    slides: staticFiles("19cc0ab3-bca3-4107-9100-1bf8d7d51cce"),
    filings: staticFiles("62ff5153-94c5-479d-9611-6cf7ada99099"),
  },
  "Q1 2026": {
    slides: staticFiles("51a6fa63-7805-4674-aa72-2a2c7f3add97"),
    filings: staticFiles("29b0e54d-f37d-4bc6-95ec-6255a8ac6376"),
  },
  "Q4 2025": {
    slides: staticFiles("d9ca6e36-4468-4398-ab00-d55928adf206"),
    filings: staticFiles("13186e61-6895-4f40-aa0c-fc7fe5f698cf"),
  },
  "Q3 2025": {
    slides: staticFiles("b1618882-d03a-4d1c-8cec-4a34f8a4796d"),
    filings: staticFiles("5a4d31c0-c07f-4244-84bc-7ba34f5677cd"),
  },
  "Q2 2025": {
    slides: staticFiles("07f4bb36-f352-4440-8a14-e3cbddb10288"),
    filings: staticFiles("8d344326-4ee2-42e0-adf5-5d8871b8dbde"),
  },
  "Q1 2025": {
    slides: staticFiles("82a27321-029b-46b4-b8b2-1c2e822e8858"),
    filings: staticFiles("0513a22c-2496-4d03-b0a2-90352e72b183"),
  },
  "Q4 2024": {
    slides: staticFiles("2dd32636-fcf0-4377-998e-37816581f5ee"),
    filings: staticFiles("1d7b31d5-688a-43ba-b9b6-c122ff4ca9d7"),
  },
  "Q3 2024": {
    slides: staticFiles("fc6a44ee-b510-4cf3-84a6-0b0ba60babb9"),
    filings: staticFiles("fcd40eb3-c187-41a1-94b5-9262605493ab"),
  },
  "Q2 2024": {
    slides: staticFiles("8bbba734-0c81-463e-a70d-d90f22e0aaee"),
    filings: staticFiles("19e5cd0c-1c7a-454b-944a-e3827bd9d8e4"),
  },
  "Q1 2024": {
    slides: staticFiles("6af81dec-ba22-41b3-aaf3-6b7465a7a87f"),
    filings: staticFiles("f5b0cd3a-9584-4ae7-af9a-c6950b7a5c06"),
  },
  "Q4 2023": {
    slides: staticFiles("98ffd9ca-25c1-4e99-bd80-7048708e5762"),
    filings: staticFiles("4f1c38e1-408e-4637-8bad-854313168411"),
  },
  "Q3 2023": {
    slides: staticFiles("7b25f055-78ea-4290-88cf-448006a0f56e"),
    filings: staticFiles("827ee61c-d750-4956-bbc6-450613d7f0b9"),
  },
  "Q2 2023": {
    slides: staticFiles("a4a4790a-fe82-42dd-86c3-d43cb8091581"),
    filings: staticFiles("5c73f7fb-869a-4850-bd26-22a626d0176f"),
  },
  "Q1 2023": {
    slides: staticFiles("f94722a3-3445-44bf-bf1e-e7707a54a1b2"),
    filings: staticFiles("cb6a0c8d-9f1b-400e-b776-51deaac3648b"),
  },
  "Q4 2022": {
    slides: staticFiles("7a02a646-b769-442b-885c-c62cf97ced6e"),
    filings: staticFiles("9f226314-f49e-4d65-99d9-41dd727498b8"),
  },
  "Q3 2022": {
    slides: staticFiles("5a732408-2804-4c59-b7bb-444c4dc6ce0e"),
    filings: staticFiles("3babdde3-3c08-43b2-8214-cfa64dfed4da"),
  },
  "Q2 2022": {
    slides: null,
    filings: staticFiles("7a9c19d8-97de-45e3-8e25-7945a953adbb"),
  },
  "Q1 2022": {
    slides: null,
    filings: staticFiles("694b459f-f483-497b-bc28-41294d95a279"),
  },
};

export function isWdcRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|spin|reconcil|webcast|transcript|investor[-_\s]?day|guidance[-_\s]?summary|fact[-_\s]?sheet/i.test(
    n,
  );
}

export function isWdcIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (
      !(
        host === "investor.wdc.com" ||
        host === "wdc.gcs-web.com" ||
        host.endsWith(".wdc.com")
      )
    ) {
      return false;
    }
    if (!/\/static-files\/[a-f0-9-]{36}/i.test(u.pathname)) return false;
    return !isWdcRejected(url);
  } catch {
    return false;
  }
}

export function mergeWdcKnownQuarterDocs(): Map<string, WdcQuarterDocs> {
  return new Map(Object.entries(WDC_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
