/**
 * Analog Devices (ADI) IR — issuer FY ends ~29 Oct (`ADI_FY_END`).
 * Slides = Web Schedule PDF; Filings = Earnings Release PDF on investor.analog.com/static-files.
 * Never transcript / 10-Q / 10-K / Investor Day / SEC HTML.
 */

export type AdiQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

/** Approximate fiscal year-end (ADI FY22 10-K dated 10.29.2022). */
export const ADI_FY_END = "10-29";

const ADI_HOST = "https://investor.analog.com";

function sf(uuid: string): string {
  return `${ADI_HOST}/static-files/${uuid}`;
}

export const ADI_IR_PAGES = [
  "https://investor.analog.com/financial-info/quarterly-results",
  "https://investor.analog.com/events",
] as const;

/**
 * Catalog from quarterly-results table (Web Schedules + Earnings Releases)
 * plus FY2022 event-detail pages. Keys are issuer fiscal labels.
 */
export const ADI_KNOWN_QUARTER_DOCS: Readonly<Record<string, AdiQuarterDocs>> = {
  "Q3 2026": {
    slides: sf("e2a80d76-fbf1-4d7c-8160-b542025af322"),
    filings: sf("d23cd824-f375-471a-a592-9255347c40ee"),
  },
  "Q2 2026": {
    slides: sf("aeb5b54a-53a4-4f81-9bc4-b98ba7efdd24"),
    filings: sf("23d426f9-1ce4-468a-ae3b-e8041b6e856f"),
  },
  "Q1 2026": {
    slides: sf("9e35f824-28fd-41b3-bcf7-a21b95e3f384"),
    filings: sf("3ebfdc7f-b046-475c-93a0-f5e8b165293a"),
  },
  "Q4 2025": {
    slides: sf("0796cc35-c9d8-4802-a56a-7ce36c569f5f"),
    filings: sf("3362df04-da3f-4c85-8523-9e9690375790"),
  },
  "Q3 2025": {
    slides: sf("7750a2f6-1a86-49cc-9712-274404a3b4ba"),
    filings: sf("5f0a810c-9b4f-40f9-9484-3e98594326b6"),
  },
  "Q2 2025": {
    slides: sf("f679871d-28b5-4a26-98ae-a608c2dc005b"),
    filings: sf("a866d298-7fd2-488c-878b-627426a1f9d8"),
  },
  "Q1 2025": {
    slides: sf("d72ed80b-66b3-4f1c-a9bc-26acf35e4af3"),
    filings: sf("92b3524a-2130-4cc6-bf9f-e1b9f2fa55dc"),
  },
  "Q4 2024": {
    slides: sf("fbf33498-4ea0-44c7-8a52-10dffa5eece9"),
    filings: sf("3eed8bbc-284e-4e2c-a91c-250e7857a5f3"),
  },
  "Q3 2024": {
    slides: sf("37a42f08-bcbc-4b71-81b5-5ef5fc4c91e8"),
    filings: sf("6c0b0626-55ee-4837-b559-7d70b82af550"),
  },
  "Q2 2024": {
    slides: sf("3b7f12b2-d4b4-4694-8107-020e77317640"),
    filings: sf("f46ef85b-3b0e-470a-b90f-b26644e6c039"),
  },
  "Q1 2024": {
    slides: sf("efd60201-3d9d-49d6-a083-5d49764d4896"),
    filings: sf("e67bf675-5e12-42ec-b45e-82e3c0b7954e"),
  },
  "Q4 2023": {
    slides: sf("01c7ebd0-ba1f-4c74-8925-648c9a912efe"),
    filings: sf("01536d94-aa80-4d26-9761-b6ae3d11ab8e"),
  },
  "Q3 2023": {
    slides: sf("f9849ad9-0e03-4021-b497-01e46a76e805"),
    filings: sf("a0d78b51-986d-4ba6-a38d-6543237512fd"),
  },
  "Q2 2023": {
    slides: sf("787ac324-f38a-4c73-872d-60729ec6dd0d"),
    filings: sf("49b9bd59-3544-4c43-88cd-8052e5f7367b"),
  },
  "Q1 2023": {
    slides: sf("d56514e3-d932-412e-9429-66a55bc03fc6"),
    filings: sf("97412766-776a-4e87-afe1-4338b30c71cb"),
  },
  "Q4 2022": {
    slides: sf("5e36e4bb-5ec3-4e51-b62e-4b38e4b7ca66"),
    filings: sf("710d49bb-ca25-4c23-beb2-8ed630b8e2c0"),
  },
  "Q3 2022": {
    slides: sf("3189c493-278b-4872-b982-5256a767a1d6"),
    filings: sf("fcb74302-5329-4951-a4f6-588773843a8d"),
  },
  "Q2 2022": {
    slides: sf("a25fba97-f7ec-406f-ac26-ac2ef7700e92"),
    filings: sf("f19a24bf-dd72-4086-9a77-11102719fba0"),
  },
  "Q1 2022": {
    slides: sf("95c74fe1-ed1d-4222-887e-24acaa60af82"),
    filings: sf("a06cb28d-5f54-4239-8b33-96894a4c7a9a"),
  },
};

export function isAdiRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return (
    /sec\.gov|10-?q|10-?k|8-?k|transcript|investor[-_\s]*day|form\s*sd|irs\s*form|conference/i.test(
      n,
    )
  );
}

export function isAdiIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (
      !(
        u.hostname === "investor.analog.com" ||
        u.hostname === "analogdevices.gcs-web.com" ||
        u.hostname.endsWith(".analog.com")
      )
    ) {
      return false;
    }
    return /\/static-files\/[a-f0-9-]{36}/i.test(u.pathname) && !isAdiRejected(url);
  } catch {
    return false;
  }
}

export function mergeAdiKnownQuarterDocs(): Map<string, AdiQuarterDocs> {
  return new Map(Object.entries(ADI_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
