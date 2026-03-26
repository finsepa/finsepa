import { TOP10_META, type Top10Ticker } from "@/lib/screener/top10-config";
import { companyLogoUrlFromDomain } from "@/lib/screener/company-logo-url";

export type StockDetailMeta = {
  ticker: string;
  name: string;
  logoUrl: string | null;
};

function isTop10Ticker(t: string): t is Top10Ticker {
  return Object.prototype.hasOwnProperty.call(TOP10_META, t);
}

export function getStockDetailMetaFromTicker(ticker: string): StockDetailMeta {
  const sym = ticker.trim().toUpperCase();
  if (isTop10Ticker(sym)) {
    const meta = TOP10_META[sym];
    return {
      ticker: sym,
      name: meta.name,
      logoUrl: companyLogoUrlFromDomain(meta.domain),
    };
  }
  return {
    ticker: sym || "?",
    name: sym || "Unknown",
    logoUrl: null,
  };
}

