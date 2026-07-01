/**
 * Extra investor-relations hosts beyond fundamentals `companyWebsite` / `irWebsite`.
 * Many listings use `www.{ticker}.com` or `{ticker}.gcs-web.com` (Q4/Business Wire).
 */
const EXTRA_IR_HOSTS_BY_TICKER: Record<string, readonly string[]> = {
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
  INTC: [
    "https://www.intc.com/",
    "https://www.intc.com/financial-info/financial-results",
    "https://www.intc.com/news-events/presentations",
  ],
  PLTR: ["https://investors.palantir.com/"],
};

export function extraIrHostsForTicker(ticker: string): string[] {
  const t = ticker.trim().toUpperCase();
  const extra = EXTRA_IR_HOSTS_BY_TICKER[t];
  const lower = t.toLowerCase();
  const derived = [
    `https://www.${lower}.com/`,
    `https://${lower}.gcs-web.com/`,
    `https://investor.${lower}.com/`,
  ];
  return [...new Set([...(extra ?? []), ...derived])];
}
