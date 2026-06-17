import "server-only";

import { fetchEodhdFundamentalsJson } from "@/lib/market/eodhd-fundamentals";
import {
  earningsDateDisplayFromFundamentalsRoot,
  estimatesDisplayFromFundamentalsRoot,
} from "@/lib/market/earnings-history-estimates";
import { logoUrlFromFundamentalsRoot } from "@/lib/market/stock-logo-url";

export type EarningsPreviewPayload = {
  ticker: string;
  companyName: string;
  logoUrl: string;
  /** Display for the announcement / report date tile */
  earningsDateDisplay: string | null;
  estRevenueDisplay: string | null;
  estEpsDisplay: string | null;
};

function companyNameFromRoot(root: Record<string, unknown>, fallback: string): string {
  const general = root.General && typeof root.General === "object" ? (root.General as Record<string, unknown>) : null;
  const nameRaw = general?.Name ?? general?.CompanyName ?? general?.ShortName;
  if (typeof nameRaw === "string" && nameRaw.trim()) return nameRaw.trim();
  return fallback;
}

/**
 * One fundamentals fetch (cached per ticker) + parse Earnings.History for estimates.
 */
export async function getEarningsPreviewPayload(args: {
  ticker: string;
  /** Calendar column date YYYY-MM-DD (announcement day from earnings calendar). */
  reportDateYmd: string;
  fallbackCompanyName: string;
  fallbackLogoUrl: string;
}): Promise<EarningsPreviewPayload> {
  const root = await fetchEodhdFundamentalsJson(args.ticker);
  if (!root) {
    return {
      ticker: args.ticker,
      companyName: args.fallbackCompanyName,
      logoUrl: args.fallbackLogoUrl,
      earningsDateDisplay: earningsDateDisplayFromFundamentalsRoot({}, args.reportDateYmd),
      estRevenueDisplay: null,
      estEpsDisplay: null,
    };
  }

  const { estRevenueDisplay, estEpsDisplay } = estimatesDisplayFromFundamentalsRoot(root, args.reportDateYmd.trim());
  const earningsDateDisplay = earningsDateDisplayFromFundamentalsRoot(root, args.reportDateYmd.trim());

  const logo = logoUrlFromFundamentalsRoot(root, args.ticker);
  const name = companyNameFromRoot(root, args.fallbackCompanyName);

  return {
    ticker: args.ticker,
    companyName: name,
    logoUrl: logo || args.fallbackLogoUrl,
    earningsDateDisplay,
    estRevenueDisplay,
    estEpsDisplay,
  };
}
