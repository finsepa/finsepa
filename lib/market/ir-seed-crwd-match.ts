/** CrowdStrike IR: earnings presentation as slides, earnings-release PDF as filings. Never 8-K / Fal.Con / transcript / 10-Q. */

export type CrwdQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

/** Issuer FY ends January 31. */
export const CRWD_FY_END = "01-31";

const GCS = "https://ir.crowdstrike.com/static-files";

function gcs(uuid: string): string {
  return `${GCS}/${uuid}`;
}

export const CRWD_IR_PAGES = [
  "https://ir.crowdstrike.com/financial-information/quarterly-results",
] as const;

/**
 * Labels are issuer FY (Q4 = Jan 31). Q2 FY2027 not published as of 2026-09-10.
 * Q1 FY2027 press is an 8-K wrapper — filings stay empty.
 */
export const CRWD_KNOWN_QUARTER_DOCS: Readonly<Record<string, CrwdQuarterDocs>> = {
  "Q1 2027": { slides: gcs("f774ef12-cf94-48bf-ace2-c7f3dcf8ec97"), filings: null },
  "Q4 2026": {
    slides: gcs("d87beb11-6d88-4dfb-9cc0-00da1c92ccd1"),
    filings: gcs("47f7568f-9409-4dde-b981-ba3693762e6d"),
  },
  "Q3 2026": {
    slides: gcs("1e06e0bb-28f0-4b12-a2f7-1b808c4c665a"),
    filings: gcs("86cbc0d2-d1c0-4ee6-8231-d7b616c87691"),
  },
  "Q2 2026": {
    slides: gcs("57fff258-8e8b-4e90-b8c6-d4b11faa3d5b"),
    filings: gcs("152d899b-27c3-4d95-9f24-5b301c7911df"),
  },
  "Q1 2026": {
    slides: gcs("7fbbeb91-b0fa-4fe7-9891-832d96959b89"),
    filings: gcs("dfc20022-ce03-4ad2-bf89-f0ef4a5344b0"),
  },
  "Q4 2025": { slides: gcs("74d1ad6a-8301-40f3-836f-7948a3a31f1c"), filings: null },
  "Q3 2025": {
    slides: gcs("eb8f3a76-caf8-49ff-b7b1-796fa520ef30"),
    filings: gcs("3f510d36-47b7-445d-8cac-d3163afac9b1"),
  },
  "Q2 2025": { slides: gcs("0c958310-3ea9-4df7-b113-826a7f34df98"), filings: null },
};

export function isCrwdRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|8-?k|fal\.?con|transcript|10-?q|10-?k|investor[-_\s]*briefing|conference/i.test(n);
}

export function isCrwdIrStaticFiles(url: string | null | undefined): boolean {
  if (!url) return false;
  return /ir\.crowdstrike\.com\/static-files\/[a-f0-9-]{36}/i.test(url) && !isCrwdRejected(url);
}

export function mergeCrwdKnownQuarterDocs(): Map<string, CrwdQuarterDocs> {
  return new Map(Object.entries(CRWD_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
