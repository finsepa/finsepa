import { extraIrHostsForTicker } from "@/lib/market/ir-ticker-host-aliases";
import type { StockEarningsDocumentHub } from "@/lib/market/stock-earnings-types";

function domainFromCompanyWebsite(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const parts = host.split(".").filter(Boolean);
    if (parts.length < 2) return null;
    return parts.slice(-2).join(".");
  } catch {
    return null;
  }
}

/** Investor-relations origins to probe for earnings PDFs / static-files decks. */
export function buildIrSeedUrls(ticker: string, hub: StockEarningsDocumentHub): string[] {
  const out: string[] = [];
  for (const host of extraIrHostsForTicker(ticker)) out.push(host);
  if (hub.irWebsite && /^https?:\/\//i.test(hub.irWebsite)) out.push(hub.irWebsite);
  if (hub.companyWebsite && /^https?:\/\//i.test(hub.companyWebsite)) out.push(hub.companyWebsite);

  const root = domainFromCompanyWebsite(hub.companyWebsite);
  if (root) {
    out.push(`https://investor.${root}/`);
    out.push(`https://ir.${root}/`);
    out.push(`https://investors.${root}/`);
    out.push(`https://${root}/investor-relations/`);
    out.push(`https://${root}/investors/`);
    if (root === "microsoft.com") {
      out.push("https://www.microsoft.com/en-us/investor/earnings/");
    }
  }
  return [...new Set(out)];
}

export function buildCommonQuarterlyEarningsPages(seed: string, preview: boolean): string[] {
  let u: URL | null = null;
  try {
    u = new URL(seed);
  } catch {
    return [];
  }
  const origin = u.origin;
  if (preview) return [seed];
  return [
    seed,
    `${origin}/financial-information/quarterly-earnings/`,
    `${origin}/financials/`,
    `${origin}/quarterly-results/`,
    `${origin}/financial-information/quarterly-results/`,
    `${origin}/events-and-presentations/`,
  ];
}
