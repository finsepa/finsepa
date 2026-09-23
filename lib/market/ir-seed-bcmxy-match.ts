/**
 * BCMXY IR seed — 12-31.
 * Bank of Communications Co ADR (BCMXY / 601328 / 3328). Calendar FY; quarterly A+H results (not half-year-only). Filings=English RESULTS ANNOUNCEMENT PDFs via bankcomm.com fileDownload.html|fileDownload.do?fileId= (first-party IR). Slides=none — IR/cninfo have results-briefing convening notices only, no lockable earnings decks. Reject annual/interim full reports as slides; never SEC HTML. Scope Q1 2022→Q2 2026 (0 green / 18 yellow / 0 red). Range-GET %PDF verified.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type BcmxyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const BCMXY_IR_PAGES = [
  "https://www.bankcomm.com/BankCommSite/shtml/jyjr/en/2623/list.shtml?channelId=2623",
] as const;

export const BCMXY_KNOWN_QUARTER_DOCS: Readonly<Record<string, BcmxyQuarterDocs>> = {
  "Q1 2022": {
    slides: null,
    filings: "https://www.bankcomm.com/BankCommSite/fileDownload.do?fileId=98419a1d49a84462bc23629703d318e9",
  },
  "Q2 2022": {
    slides: null,
    filings: "https://www.bankcomm.com/BankCommSite/fileDownload.do?fileId=819bd697218c4867afe67c7ac4b68d8e",
  },
  "Q3 2022": {
    slides: null,
    filings: "https://www.bankcomm.com/BankCommSite/fileDownload.do?fileId=82d09f1b4e0a4afe9613adb06777ebec",
  },
  "Q4 2022": {
    slides: null,
    filings: "https://www.bankcomm.com/BankCommSite/fileDownload.do?fileId=a015b1a21e0e4431ab6d4480d0b5755a",
  },
  "Q1 2023": {
    slides: null,
    filings: "https://www.bankcomm.com/BankCommSite/fileDownload.do?fileId=21ec12fe9769442a9572281e45557e54",
  },
  "Q2 2023": {
    slides: null,
    filings: "https://www.bankcomm.com/BankCommSite/fileDownload.do?fileId=409505bd9d35430d89ef0282abf936f3",
  },
  "Q3 2023": {
    slides: null,
    filings: "https://www.bankcomm.com/BankCommSite/file/fileDownload.html?fileId=db156be8d0504311a1dc472aec0c9809",
  },
  "Q4 2023": {
    slides: null,
    filings: "https://www.bankcomm.com/BankCommSite/file/fileDownload.html?fileId=94a9d0ee4fde41bdaf5c031c98c0d97f",
  },
  "Q1 2024": {
    slides: null,
    filings: "https://www.bankcomm.com/BankCommSite/file/fileDownload.html?fileId=b8aed06309cf40c7a8b4dd0d9d37266f",
  },
  "Q2 2024": {
    slides: null,
    filings: "https://www.bankcomm.com/BankCommSite/file/fileDownload.html?fileId=b70d3292b05344a7892321126e2256fa",
  },
  "Q3 2024": {
    slides: null,
    filings: "https://www.bankcomm.com/BankCommSite/file/fileDownload.html?fileId=f2a75af817314144a824667f6a83a21a",
  },
  "Q4 2024": {
    slides: null,
    filings: "https://www.bankcomm.com/BankCommSite/file/fileDownload.html?fileId=a444dea898c24f128118f97620b6834d",
  },
  "Q1 2025": {
    slides: null,
    filings: "https://www.bankcomm.com/BankCommSite/file/fileDownload.html?fileId=1ff8f0fcaaa848238790063a9d347460",
  },
  "Q2 2025": {
    slides: null,
    filings: "https://www.bankcomm.com/BankCommSite/file/fileDownload.html?fileId=9058240e3c314dc2a757d90bd83a025e",
  },
  "Q3 2025": {
    slides: null,
    filings: "https://www.bankcomm.com/BankCommSite/file/fileDownload.html?fileId=44745b85c15d43feb315278e04bceaa0",
  },
  "Q4 2025": {
    slides: null,
    filings: "https://www.bankcomm.com/BankCommSite/file/fileDownload.html?fileId=94200da8362541739143385d24a50748",
  },
  "Q1 2026": {
    slides: null,
    filings: "https://www.bankcomm.com/BankCommSite/file/fileDownload.html?fileId=049f850036eb47e5b53f9bec05ff82b5",
  },
  "Q2 2026": {
    slides: null,
    filings: "https://www.bankcomm.com/BankCommSite/file/fileDownload.html?fileId=47746ffb0ac44c38ae96a1044318f546",
  },
};

export function isBcmxyRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab|xbrl/i.test(n);
}

export function isBcmxyIrPdf(href: string | null | undefined): boolean {
  if (!href || isBcmxyRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.bankcomm.com" || host.endsWith(".bankcomm.com"))) return false;
    return (
      (/\/fileDownload\.do$/i.test(u.pathname) || /\/file\/fileDownload\.html$/i.test(u.pathname)) &&
      u.searchParams.has("fileId")
    );
  } catch {
    return false;
  }
}

export function mergeBcmxyKnownQuarterDocs(): Map<string, BcmxyQuarterDocs> {
  return new Map(Object.entries(BCMXY_KNOWN_QUARTER_DOCS));
}
