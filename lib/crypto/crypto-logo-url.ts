import { companyLogoUrlFromDomain } from "@/lib/screener/company-logo-url";

const DOMAIN_BY_SYMBOL: Record<string, string> = {
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
  POL: "polygon.technology",
  DOT: "polkadot.network",
  ATOM: "cosmos.network",
  LTC: "litecoin.org",
  BCH: "bitcoincash.org",
  NEAR: "near.org",
  UNI: "uniswap.org",
  XLM: "stellar.org",
  FIL: "filecoin.io",
  APT: "aptoslabs.com",
  ARB: "arbitrum.io",
  OP: "optimism.io",
  INJ: "injective.com",
  SUI: "sui.io",
  TIA: "celestia.org",
  AAVE: "aave.com",
  MKR: "makerdao.com",
  LDO: "lido.fi",
  STX: "stacks.co",
  IMX: "immutable.com",
  GRT: "thegraph.com",
  FET: "fetch.ai",
  RNDR: "rendernetwork.com",
  SNX: "synthetix.io",
  CRV: "curve.fi",
};

/**
 * Deterministic favicon URLs from known domains; falls back to a generic icon service.
 */
export function getCryptoLogoUrl(symbol: string): string {
  const u = symbol.trim().toUpperCase();
  const domain = DOMAIN_BY_SYMBOL[u];
  if (domain) return companyLogoUrlFromDomain(domain);
  return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(`${u.toLowerCase()}.org`)}`;
}
