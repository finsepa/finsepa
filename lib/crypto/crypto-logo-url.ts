import "server-only";

import { companyLogoUrlFromDomain } from "@/lib/screener/company-logo-url";

export type SupportedCryptoSymbol =
  | "BTC"
  | "ETH"
  | "XRP"
  | "BNB"
  | "SOL"
  | "DOGE"
  | "ADA"
  | "TRX"
  | "TON"
  | "LINK"
  | "AVAX";

/**
 * Stable logo strategy without API keys.
 * We intentionally use deterministic favicon URLs from well-known domains.
 * The UI already falls back to initials if the image fails.
 */
export function getCryptoLogoUrl(symbol: SupportedCryptoSymbol): string {
  const domainBySymbol: Record<SupportedCryptoSymbol, string> = {
    BTC: "bitcoin.org",
    ETH: "ethereum.org",
    XRP: "ripple.com",
    BNB: "binance.com",
    SOL: "solana.com",
    DOGE: "dogecoin.com",
    ADA: "cardano.org",
    TRX: "tron.network",
    TON: "ton.org",
    LINK: "chain.link",
    AVAX: "avax.network",
  };

  return companyLogoUrlFromDomain(domainBySymbol[symbol]);
}

