import { CRYPTO_CC_EXTRA_PLAIN_BASES } from "@/lib/crypto/crypto-cc-extra-bases";
import { cryptoRouteBase, cryptoUsdPairBase } from "@/lib/crypto/crypto-symbol-base";
import { ALL_CRYPTO_METAS } from "@/lib/market/crypto-meta";
import {
  companyLogoUrlFromDomain,
  logoDevCryptoLogoUrl,
  logoDevDomainLogoUrl,
} from "@/lib/screener/company-logo-url";

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

/** Symbols that use crypto Logo.dev / curated domains in portfolio and search (uppercase keys). */
export const CRYPTO_ASSET_SYMBOLS = new Set(Object.keys(DOMAIN_BY_SYMBOL));

const GLOBAL_CRYPTO_SYMBOLS = new Set([
  ...ALL_CRYPTO_METAS.map((m) => m.symbol.toUpperCase()),
  ...Object.keys(DOMAIN_BY_SYMBOL).map((k) => k.toUpperCase()),
]);

export function isSupportedCryptoAssetSymbol(symbol: string): boolean {
  const u = symbol.trim().toUpperCase();
  if (!u) return false;
  if (GLOBAL_CRYPTO_SYMBOLS.has(u)) return true;
  if (cryptoUsdPairBase(u)) return true;
  if (CRYPTO_CC_EXTRA_PLAIN_BASES.has(u)) return true;
  return false;
}

/**
 * Host for Google favicon fallback when `/api/media/logo` cannot use Logo.dev (missing key, budget, etc.).
 * Must match {@link getCryptoLogoUrl} domain logic — never use `{symbol}.com` (e.g. btc.com is wrong for Bitcoin).
 */
export function googleFaviconHostForCryptoSymbol(symbol: string): string {
  const u = cryptoRouteBase(symbol.trim().toUpperCase());
  const domain = DOMAIN_BY_SYMBOL[u];
  if (domain) return domain;
  return `${u.toLowerCase()}.org`;
}

/**
 * Logo.dev crypto CDN when configured; otherwise deterministic favicon domains / generic fallback.
 */
export function getCryptoLogoUrl(symbol: string): string {
  const u = cryptoRouteBase(symbol.trim().toUpperCase());
  const dev = logoDevCryptoLogoUrl(u);
  if (dev) return dev;
  const domain = DOMAIN_BY_SYMBOL[u];
  if (domain) return logoDevDomainLogoUrl(domain) ?? companyLogoUrlFromDomain(domain);
  return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(`${u.toLowerCase()}.org`)}`;
}
