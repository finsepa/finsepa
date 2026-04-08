/**
 * Featured crypto for picker UIs (New Transaction, Charting, …).
 * Keep in sync with `CRYPTO_TOP10` in `lib/market/eodhd-crypto.ts`.
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

/** Same coverage as `CRYPTO_SEARCH_EXTRA` in `eodhd-crypto` — used for `/crypto/[symbol]` links from portfolio. */
const CRYPTO_ROUTE_EXTRA: readonly string[] = [
  "TON",
  "POL",
  "DOT",
  "ATOM",
  "LTC",
  "BCH",
  "NEAR",
  "UNI",
  "XLM",
  "FIL",
  "APT",
  "ARB",
  "OP",
  "INJ",
  "SUI",
  "TIA",
  "AAVE",
  "MKR",
  "LDO",
  "STX",
  "IMX",
  "GRT",
  "FET",
  "RNDR",
  "SNX",
  "CRV",
];

const CRYPTO_ASSET_PAGE_SYMBOLS = new Set<string>([
  ...CRYPTO_PICKER_TOP.map((c) => c.symbol.toUpperCase()),
  ...CRYPTO_ROUTE_EXTRA.map((s) => s.toUpperCase()),
]);

/** Portfolio / picker: `/crypto/BTC` vs `/stock/AAPL`. */
export function portfolioHoldingAssetHref(symbol: string): string {
  const s = symbol.trim().toUpperCase();
  if (!s) return "/portfolio";
  if (CRYPTO_ASSET_PAGE_SYMBOLS.has(s)) return `/crypto/${encodeURIComponent(s)}`;
  return `/stock/${encodeURIComponent(s)}`;
}
