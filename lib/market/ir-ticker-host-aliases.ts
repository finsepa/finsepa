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
