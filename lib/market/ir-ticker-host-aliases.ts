/**
 * Curated investor-relations hosts beyond fundamentals `companyWebsite` / `irWebsite`.
 * Prefer real IR domains here — do **not** invent `www.{ticker}.com` (ADBE ≠ adobe.com).
 */
const CURATED_IR_HOSTS_BY_TICKER: Record<string, readonly string[]> = {
  CMCSA: [
    "https://www.cmcsa.com/",
    "https://cmcsa.gcs-web.com/",
    "https://corporate.comcast.com/",
  ],
  PYPL: ["https://investor.pypl.com/"],
  MU: ["https://investors.micron.com/"],
  AMD: ["https://ir.amd.com/"],
  COIN: ["https://investor.coinbase.com/"],
  MAR: ["https://marriott.gcs-web.com/"],
  KO: ["https://investors.coca-colacompany.com/"],
  PG: ["https://www.pginvestor.com/"],
  ORCL: ["https://investor.oracle.com/", "https://www.oracle.com/investor/"],
  WMT: [
    "https://stock.walmart.com/",
    "https://stock.walmart.com/financial-information/financial-results",
    "https://corporate.walmart.com/",
  ],
  ADBE: [
    "https://www.adobe.com/investor-relations.html",
    "https://www.adobe.com/investor-relations/",
    "https://www.adobe.com/investor-relations/financial-documents.html",
  ],
  INTC: [
    "https://www.intc.com/",
    "https://www.intc.com/financial-info/financial-results",
    "https://www.intc.com/news-events/presentations",
  ],
  PLTR: ["https://investors.palantir.com/"],
  MA: [
    "https://investor.mastercard.com/",
    "https://investor.mastercard.com/financials-and-sec-filings/quarterly-results/default.aspx",
    "https://investor.mastercard.com/overview/default.aspx",
  ],
  UNH: [
    "https://www.unitedhealthgroup.com/investors.html",
    "https://www.unitedhealthgroup.com/investors/financial-reports.html",
  ],
  AMAT: ["https://ir.appliedmaterials.com/", "https://investor.appliedmaterials.com/"],
  LRCX: ["https://investor.lamresearch.com/", "https://newsroom.lamresearch.com/"],
  CVX: ["https://www.chevron.com/investors", "https://chevroncorp.gcs-web.com/"],
  COST: ["https://investor.costco.com/"],
  CAT: ["https://investors.caterpillar.com/"],
  HSBC: ["https://www.hsbc.com/investors"],
  MRK: ["https://www.merck.com/investor-relations/"],
  DELL: [
    "https://investors.delltechnologies.com/",
    "https://investors.delltechnologies.com/financial-information/quarterly-results",
    "https://delltechnologies.gcs-web.com/financial-information/quarterly-results",
  ],
  MS: ["https://www.morganstanley.com/about-us-ir", "https://www.morganstanley.com/about-us-ir/earnings-releases"],
  GE: [
    "https://www.geaerospace.com/investor-relations",
    "https://www.geaerospace.com/investor-relations/events-reports",
  ],
  NFLX: ["https://ir.netflix.net/", "https://ir.netflix.net/financials/quarterly-earnings/default.aspx"],
  HD: [
    "https://ir.homedepot.com/",
    "https://ir.homedepot.com/financial-reports/quarterly-earnings/2026",
  ],
  GS: ["https://www.goldmansachs.com/investor-relations"],
  PM: [
    "https://www.pmi.com/investor-relations",
    "https://www.pmi.com/investor-relations/reports-filings",
    "https://philipmorrisinternational.gcs-web.com/",
  ],
  RY: ["https://www.rbc.com/investor-relations/", "https://www.rbc.com/investor-relations/financial-information.html"],
  ARM: ["https://investors.arm.com/", "https://investors.arm.com/financials/quarterly-annual-results"],
  BABA: ["https://www.alibabagroup.com/en-US/ir-financial-reports-quarterly-results"],
  PANW: [
    "https://investors.paloaltonetworks.com/",
    "https://investors.paloaltonetworks.com/financial-information/quarterly-results",
  ],
  SHEL: ["https://www.shell.com/investors/results-and-reporting/quarterly-results.html"],
  WFC: ["https://www.wellsfargo.com/about/investor-relations/quarterly-earnings/"],
  RTX: [
    "https://investors.rtx.com/",
    "https://investors.rtx.com/events-and-presentations",
    "https://investors.rtx.com/financial-information/quarterly-results",
  ],
  NVS: ["https://www.novartis.com/investors/financial-data/quarterly-results"],
  MUFG: [
    "https://www.mufg.jp/english/ir/presentation/index.html",
    "https://www.mufg.jp/english/ir/fs/index.html",
  ],
  SNDK: [
    "https://investor.sandisk.com/",
    "https://investor.sandisk.com/financial-information/quarterly-results",
  ],
  NSRGY: ["https://www.nestle.com/investors/publications"],
  GEV: ["https://www.gevernova.com/investors"],
  AZN: ["https://www.astrazeneca.com/investor-relations.html"],
  ANET: [
    "https://investors.arista.com/",
    "https://investors.arista.com/Financials/Quarterly-Results/default.aspx",
  ],
  SIEGY: [
    "https://www.siemens.com/global/en/company/investor-relations.html",
    "https://www.siemens.com/global/en/company/investor-relations/events-publications.html",
  ],
  SAP: ["https://www.sap.com/investors/en/reports.html"],
  LVMUY: [
    "https://www.lvmh.com/en/financial-calendar",
    "https://www.lvmh.com/en/investors/investors-and-analysts",
  ],
  LRLCY: [
    "https://www.loreal-finance.com/eng/annual-results",
    "https://www.loreal-finance.com/eng/half-year-results",
  ],
  KLAC: [
    "https://ir.kla.com/financial-information/financial-results",
    "https://ir.kla.com/news-events/press-releases",
  ],
  TXN: ["https://investor.ti.com/financial-information/earnings-annual-reports"],
  SFTBY: ["https://group.softbank/en/ir/financials"],
  BHP: ["https://www.bhp.com/investor-hub/reports-and-presentations/financial-results-operational-reviews"],
  C: ["https://www.citigroup.com/global/investors/quarterly-earnings"],
  TM: ["https://global.toyota/en/ir/financial-results/"],
  IBM: ["https://www.ibm.com/investor/financial-reporting/quarterly-earnings"],
  TMO: ["https://ir.thermofisher.com/investors/financial-information/quarterly-results/default.aspx"],
  AXP: [
    "https://ir.americanexpress.com/financials/earnings-and-sec-filings/default.aspx",
    "https://ir.americanexpress.com/",
  ],
  LIN: ["https://www.linde.com/investors/financial-reports"],
  SAN: ["https://www.santander.com/en/shareholders-and-investors/financial-and-economic-information"],
  CRWD: [
    "https://ir.crowdstrike.com/financial-information/quarterly-results",
    "https://ir.crowdstrike.com/events-and-presentations",
  ],
  AMGN: ["https://investors.amgen.com/financials/quarterly-earnings"],
};

/** Hand-maintained IR hosts for tickers whose listing symbol ≠ company domain. */
export function curatedIrHostsForTicker(ticker: string): string[] {
  const extra = CURATED_IR_HOSTS_BY_TICKER[ticker.trim().toUpperCase()];
  return extra ? [...extra] : [];
}

/**
 * Last-resort guesses when fundamentals have no WebURL / IRWebsite.
 * Avoid calling this when a real company domain is already known.
 */
export function derivedIrHostsFromTicker(ticker: string): string[] {
  const lower = ticker.trim().toLowerCase();
  if (!lower || !/^[a-z0-9.-]+$/.test(lower)) return [];
  return [
    `https://www.${lower}.com/`,
    `https://${lower}.gcs-web.com/`,
    `https://investor.${lower}.com/`,
    `https://investors.${lower}.com/`,
    `https://ir.${lower}.com/`,
  ];
}

/** @deprecated Prefer `curatedIrHostsForTicker` + fundamentals via `buildIrSeedUrls`. */
export function extraIrHostsForTicker(ticker: string): string[] {
  return curatedIrHostsForTicker(ticker);
}
