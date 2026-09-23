/**
 * CEG IR seed — 12-31.
 * Constellation Energy calendar FY. Slides=Earnings Call Presentation; Filings=Release on investors.constellationenergy.com (static-files + /node/N/pdf). Latest Q2 2026. Scope stats: 16 green / 2 yellow / 0 red quarter(s). Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type CegQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const CEG_IR_PAGES = [
  "https://investors.constellationenergy.com/",
] as const;

export const CEG_KNOWN_QUARTER_DOCS: Readonly<Record<string, CegQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://investors.constellationenergy.com/static-files/04597544-dd29-47cc-baab-13aaf3127d4a",
    filings: "https://investors.constellationenergy.com/static-files/56f9726f-ac9f-4fe4-b5c9-2476107a944a",
  },
  "Q2 2022": {
    slides: "https://investors.constellationenergy.com/static-files/505f773e-ecb2-4deb-a8d8-0a03e38e020a",
    filings: "https://investors.constellationenergy.com/static-files/e0e4535a-2bbf-4c35-9fcf-22dd4819528f",
  },
  "Q3 2022": {
    slides: "https://investors.constellationenergy.com/static-files/630a7f9b-7b4b-498b-b949-951ed4ecc3f9",
    filings: "https://investors.constellationenergy.com/static-files/bdaade49-88be-498b-87dd-9683b60b00a9",
  },
  "Q4 2022": {
    slides: "https://investors.constellationenergy.com/static-files/6d7e2f0b-56e5-4f49-8c3f-b0f83b218f25",
    filings: "https://investors.constellationenergy.com/static-files/e761bf7d-1d48-4e92-9e66-038614554cfe",
  },
  "Q1 2023": {
    slides: "https://investors.constellationenergy.com/static-files/7fff0db0-2a03-4b30-917d-a8148c094d12",
    filings: "https://investors.constellationenergy.com/static-files/10ed05fa-6cd5-4bc6-8c97-7515a930c01a",
  },
  "Q2 2023": {
    slides: "https://investors.constellationenergy.com/static-files/b02c172e-daee-4499-9266-3dd8c463ae16",
    filings: "https://investors.constellationenergy.com/static-files/7a124209-56fd-46ef-b4b4-5ae19a68fed2",
  },
  "Q3 2023": {
    slides: "https://investors.constellationenergy.com/static-files/f9cd63ec-65b1-4859-841b-d2e5dddb370d",
    filings: "https://investors.constellationenergy.com/static-files/caeba60b-5591-4678-a2a8-9a243e0ded4f",
  },
  "Q4 2023": {
    slides: "https://investors.constellationenergy.com/static-files/6426042e-4ff0-404a-8543-122ffbfbec66",
    filings: "https://investors.constellationenergy.com/node/8326/pdf",
  },
  "Q1 2024": {
    slides: "https://investors.constellationenergy.com/static-files/674d5ef4-0276-4848-a9fc-11732a94276b",
    filings: "https://investors.constellationenergy.com/static-files/ae2f6342-ec9d-40e4-b0c7-f7bc713376ef",
  },
  "Q2 2024": {
    slides: "https://investors.constellationenergy.com/static-files/f1f592f5-7c1e-4278-904f-dfd03653f87c",
    filings: "https://investors.constellationenergy.com/static-files/fee7ed8c-4435-4cce-bf07-b8f2f5d78289",
  },
  "Q3 2024": {
    slides: "https://investors.constellationenergy.com/static-files/90b959a3-d63b-4ffa-8176-8c81518a1caf",
    filings: "https://investors.constellationenergy.com/static-files/ca196aa7-3c18-4fa2-b192-42ee4ff27f04",
  },
  "Q4 2024": {
    slides: null,
    filings: "https://investors.constellationenergy.com/static-files/6d2bac6a-6dd6-496a-b421-7279a9142dc4",
  },
  "Q1 2025": {
    slides: "https://investors.constellationenergy.com/static-files/639e4f87-3efd-4ef7-b215-b73d3594a6b9",
    filings: "https://investors.constellationenergy.com/static-files/2c8d1c7a-9cc5-475e-a7de-9e81f5378917",
  },
  "Q2 2025": {
    slides: "https://investors.constellationenergy.com/static-files/67764d7b-4977-45ab-86e7-f4f9637a254c",
    filings: "https://investors.constellationenergy.com/static-files/77ba2964-2605-4374-8474-5831f41730da",
  },
  "Q3 2025": {
    slides: "https://investors.constellationenergy.com/static-files/cd6491eb-893f-453f-9747-dd3b4746d0c3",
    filings: "https://investors.constellationenergy.com/static-files/d54d15da-2af8-4378-a523-72a26fa584a6",
  },
  "Q4 2025": {
    slides: null,
    filings: "https://investors.constellationenergy.com/static-files/3d52a2dd-4d08-4e61-a03e-20c1a7b22a77",
  },
  "Q1 2026": {
    slides: "https://investors.constellationenergy.com/static-files/e5a93793-71b7-453f-a5d3-6a8acb420282",
    filings: "https://investors.constellationenergy.com/static-files/b2f33c27-11f6-49d4-982f-6c5b54609f07",
  },
  "Q2 2026": {
    slides: "https://investors.constellationenergy.com/static-files/354c0998-964f-4f86-b294-1d3fc965d839",
    filings: "https://investors.constellationenergy.com/static-files/980078c9-ab31-49ce-8498-8044c0794cd7",
  },
};

export function isCegRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab|calpine|acquisition|factbook|securities.?report/i.test(n);
}

export function isCegIrPdf(href: string | null | undefined): boolean {
  if (!href || isCegRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "investors.constellationenergy.com" || host.endsWith(".constellationenergy.com"))) return false;
    return /\/static-files\/[a-f0-9-]{36}/i.test(u.pathname) || /\/node\/\d+\/pdf\/?$/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeCegKnownQuarterDocs(): Map<string, CegQuarterDocs> {
  return new Map(Object.entries(CEG_KNOWN_QUARTER_DOCS));
}
