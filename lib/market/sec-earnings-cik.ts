import { normalizeSecCik } from "@/lib/market/earnings-report-external-links";

/**
 * Explicit CIK map for issuers where SEC company_tickers.json (or a stale
 * fundamentals CIK) points at the wrong legal entity.
 *
 * XOM: company_tickers.json currently maps to ExxonMobil Holdings Corp
 * (0002115436, almost empty) instead of EXXON MOBIL CORP (0000034088).
 */
export const SEC_EARNINGS_CIK_OVERRIDE: Readonly<Record<string, string>> = {
  XOM: "0000034088",
};

/** Canonical 10-digit CIK for earnings SEC matching. Never use company_tickers.json. */
export function resolveSecEarningsCik(
  listingTicker: string,
  fundamentalsCik: string | null | undefined,
): string | null {
  const sym = listingTicker.trim().toUpperCase();
  const override = SEC_EARNINGS_CIK_OVERRIDE[sym];
  if (override) return normalizeSecCik(override);
  return normalizeSecCik(fundamentalsCik);
}
