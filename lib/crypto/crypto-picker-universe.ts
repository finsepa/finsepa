import { CRYPTO_CC_EXTRA_PLAIN_BASES } from "@/lib/crypto/crypto-cc-extra-bases";
import { cryptoRouteBase, cryptoUsdPairBase } from "@/lib/crypto/crypto-symbol-base";
import { ALL_CRYPTO_METAS } from "@/lib/market/crypto-meta";
import { isCustomPortfolioSymbol } from "@/lib/portfolio/custom-asset-symbol";

/**
 * Featured crypto for picker UIs (New Transaction, Charting, …).
 * Keep in sync with `CRYPTO_TOP10` in `lib/market/crypto-meta.ts`.
 */
export const CRYPTO_PICKER_TOP: readonly { symbol: string; name: string }[] = [
  { symbol: "BTC", name: "Bitcoin" },
  { symbol: "ETH", name: "Ethereum" },
  { symbol: "XRP", name: "XRP" },
  { symbol: "BNB", name: "BNB" },
  { symbol: "SOL", name: "Solana" },
  { symbol: "DOGE", name: "Dogecoin" },
  { symbol: "ADA", name: "Cardano" },
  { symbol: "TRX", name: "TRON" },
  { symbol: "LINK", name: "Chainlink" },
  { symbol: "AVAX", name: "Avalanche" },
];

const CRYPTO_ASSET_PAGE_SYMBOLS = new Set(ALL_CRYPTO_METAS.map((m) => m.symbol.toUpperCase()));

/** Portfolio / picker: `/crypto/BTC` vs `/stock/AAPL`. Custom assets have no detail page → `null`. */
export function portfolioHoldingAssetHref(symbol: string): string | null {
  const s = symbol.trim().toUpperCase();
  if (!s) return "/portfolio";
  if (isCustomPortfolioSymbol(s)) return null;
  const base = cryptoRouteBase(s);
  const holdingsTab = "?tab=holdings";
  if (CRYPTO_ASSET_PAGE_SYMBOLS.has(base)) return `/crypto/${encodeURIComponent(base)}${holdingsTab}`;
  if (CRYPTO_CC_EXTRA_PLAIN_BASES.has(base)) return `/crypto/${encodeURIComponent(base)}${holdingsTab}`;
  if (cryptoUsdPairBase(s)) return `/crypto/${encodeURIComponent(base)}${holdingsTab}`;
  return `/stock/${encodeURIComponent(s)}${holdingsTab}`;
}
