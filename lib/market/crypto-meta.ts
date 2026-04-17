import type { EodhdRealtimePayload } from "@/lib/market/eodhd-realtime";

/** Normalized upper-case ticker (BTC, ETH, …) — universe includes search-only assets. */
export type SupportedCryptoTicker = string;

export type CryptoMeta = {
  symbol: string;
  name: string;
  /**
   * EODHD expects crypto pairs like BTC-USD.CC for spot crypto.
   * @see https://eodhd.com/financial-apis/real-time-data-api-websockets/
   */
  eodhdSymbol: string;
  /** Optional alternate EODHD symbols (e.g. TON). */
  eodhdAltSymbols?: string[];
};

/** Screener / featured table — keep a tight set for the markets grid. */
export const CRYPTO_TOP10: CryptoMeta[] = [
  { symbol: "BTC", name: "Bitcoin", eodhdSymbol: "BTC-USD.CC" },
  { symbol: "ETH", name: "Ethereum", eodhdSymbol: "ETH-USD.CC" },
  { symbol: "XRP", name: "XRP", eodhdSymbol: "XRP-USD.CC" },
  { symbol: "BNB", name: "BNB", eodhdSymbol: "BNB-USD.CC" },
  { symbol: "SOL", name: "Solana", eodhdSymbol: "SOL-USD.CC" },
  { symbol: "DOGE", name: "Dogecoin", eodhdSymbol: "DOGE-USD.CC" },
  { symbol: "ADA", name: "Cardano", eodhdSymbol: "ADA-USD.CC" },
  { symbol: "TRX", name: "TRON", eodhdSymbol: "TRX-USD.CC" },
  { symbol: "LINK", name: "Chainlink", eodhdSymbol: "LINK-USD.CC" },
  { symbol: "AVAX", name: "Avalanche", eodhdSymbol: "AVAX-USD.CC" },
];

/** Additional liquid names for global search + asset pages (same loaders as TOP10). */
export const CRYPTO_SEARCH_EXTRA: CryptoMeta[] = [
  { symbol: "TON", name: "Toncoin", eodhdSymbol: "TONCOIN-USD.CC", eodhdAltSymbols: ["TON-USD.CC"] },
  { symbol: "POL", name: "Polygon", eodhdSymbol: "POL-USD.CC", eodhdAltSymbols: ["MATIC-USD.CC"] },
  { symbol: "DOT", name: "Polkadot", eodhdSymbol: "DOT-USD.CC" },
  { symbol: "ATOM", name: "Cosmos", eodhdSymbol: "ATOM-USD.CC" },
  { symbol: "LTC", name: "Litecoin", eodhdSymbol: "LTC-USD.CC" },
  { symbol: "BCH", name: "Bitcoin Cash", eodhdSymbol: "BCH-USD.CC" },
  { symbol: "NEAR", name: "NEAR Protocol", eodhdSymbol: "NEAR-USD.CC" },
  { symbol: "UNI", name: "Uniswap", eodhdSymbol: "UNI-USD.CC" },
  { symbol: "XLM", name: "Stellar", eodhdSymbol: "XLM-USD.CC" },
  { symbol: "FIL", name: "Filecoin", eodhdSymbol: "FIL-USD.CC" },
  { symbol: "APT", name: "Aptos", eodhdSymbol: "APT-USD.CC" },
  { symbol: "ARB", name: "Arbitrum", eodhdSymbol: "ARB-USD.CC" },
  { symbol: "OP", name: "Optimism", eodhdSymbol: "OP-USD.CC" },
  { symbol: "INJ", name: "Injective", eodhdSymbol: "INJ-USD.CC" },
  { symbol: "SUI", name: "Sui", eodhdSymbol: "SUI-USD.CC" },
  { symbol: "TIA", name: "Celestia", eodhdSymbol: "TIA-USD.CC" },
  { symbol: "AAVE", name: "Aave", eodhdSymbol: "AAVE-USD.CC" },
  { symbol: "MKR", name: "Maker", eodhdSymbol: "MKR-USD.CC" },
  { symbol: "LDO", name: "Lido DAO", eodhdSymbol: "LDO-USD.CC" },
  { symbol: "STX", name: "Stacks", eodhdSymbol: "STX-USD.CC" },
  { symbol: "IMX", name: "Immutable", eodhdSymbol: "IMX-USD.CC", eodhdAltSymbols: ["IMX-USDT.CC"] },
  { symbol: "GRT", name: "The Graph", eodhdSymbol: "GRT-USD.CC", eodhdAltSymbols: ["GRT-USDT.CC"] },
  { symbol: "FET", name: "Fetch.ai", eodhdSymbol: "FET-USD.CC" },
  { symbol: "RNDR", name: "Render", eodhdSymbol: "RNDR-USD.CC" },
  { symbol: "SNX", name: "Synthetix", eodhdSymbol: "SNX-USD.CC" },
  { symbol: "CRV", name: "Curve", eodhdSymbol: "CRV-USD.CC" },
];

/**
 * Remaining entries to reach ~top 100 by market cap (snapshot) for search + routing.
 * Symbols use EODHD `BASE-USD.CC` unless a known alternate pair exists.
 */
export const CRYPTO_SEARCH_TOP100_REST: CryptoMeta[] = [
  { symbol: "SHIB", name: "Shiba Inu", eodhdSymbol: "SHIB-USD.CC", eodhdAltSymbols: ["SHIB-USDT.CC"] },
  { symbol: "HBAR", name: "Hedera", eodhdSymbol: "HBAR-USD.CC" },
  { symbol: "ETC", name: "Ethereum Classic", eodhdSymbol: "ETC-USD.CC" },
  { symbol: "VET", name: "VeChain", eodhdSymbol: "VET-USD.CC" },
  { symbol: "ICP", name: "Internet Computer", eodhdSymbol: "ICP-USD.CC" },
  { symbol: "ALGO", name: "Algorand", eodhdSymbol: "ALGO-USD.CC" },
  { symbol: "QNT", name: "Quant", eodhdSymbol: "QNT-USD.CC" },
  /** EODHD lists Mantle Network under MANTLE-USD; MNT-USD may be a different asset or empty. */
  { symbol: "MNT", name: "Mantle", eodhdSymbol: "MANTLE-USD.CC", eodhdAltSymbols: ["MNT-USD.CC", "MNT-USDT.CC"] },
  { symbol: "SEI", name: "Sei", eodhdSymbol: "SEI-USD.CC" },
  { symbol: "PYTH", name: "Pyth Network", eodhdSymbol: "PYTH-USD.CC" },
  { symbol: "JUP", name: "Jupiter", eodhdSymbol: "JUP-USD.CC" },
  { symbol: "STRK", name: "Starknet", eodhdSymbol: "STRK-USD.CC" },
  { symbol: "WLD", name: "Worldcoin", eodhdSymbol: "WLD-USD.CC" },
  { symbol: "ONDO", name: "Ondo", eodhdSymbol: "ONDO-USD.CC" },
  { symbol: "PEPE", name: "Pepe", eodhdSymbol: "PEPE-USD.CC" },
  { symbol: "BONK", name: "Bonk", eodhdSymbol: "BONK-USD.CC" },
  { symbol: "WIF", name: "dogwifhat", eodhdSymbol: "WIF-USD.CC" },
  { symbol: "ENS", name: "Ethereum Name Service", eodhdSymbol: "ENS-USD.CC" },
  { symbol: "CHZ", name: "Chiliz", eodhdSymbol: "CHZ-USD.CC" },
  { symbol: "GALA", name: "Gala", eodhdSymbol: "GALA-USD.CC" },
  { symbol: "SAND", name: "The Sandbox", eodhdSymbol: "SAND-USD.CC" },
  { symbol: "MANA", name: "Decentraland", eodhdSymbol: "MANA-USD.CC" },
  { symbol: "AXS", name: "Axie Infinity", eodhdSymbol: "AXS-USD.CC" },
  { symbol: "THETA", name: "Theta Network", eodhdSymbol: "THETA-USD.CC" },
  { symbol: "EOS", name: "EOS", eodhdSymbol: "EOS-USD.CC" },
  { symbol: "FLOW", name: "Flow", eodhdSymbol: "FLOW-USD.CC" },
  { symbol: "XTZ", name: "Tezos", eodhdSymbol: "XTZ-USD.CC" },
  { symbol: "EGLD", name: "MultiversX", eodhdSymbol: "EGLD-USD.CC" },
  { symbol: "KAS", name: "Kaspa", eodhdSymbol: "KAS-USD.CC" },
  { symbol: "RUNE", name: "THORChain", eodhdSymbol: "RUNE-USD.CC" },
  { symbol: "PENDLE", name: "Pendle", eodhdSymbol: "PENDLE-USD.CC" },
  { symbol: "JTO", name: "Jito", eodhdSymbol: "JTO-USD.CC" },
  { symbol: "TWT", name: "Trust Wallet Token", eodhdSymbol: "TWT-USD.CC" },
  { symbol: "ZEC", name: "Zcash", eodhdSymbol: "ZEC-USD.CC" },
  { symbol: "DASH", name: "Dash", eodhdSymbol: "DASH-USD.CC" },
  { symbol: "COMP", name: "Compound", eodhdSymbol: "COMP-USD.CC" },
  { symbol: "YFI", name: "yearn.finance", eodhdSymbol: "YFI-USD.CC" },
  { symbol: "1INCH", name: "1inch", eodhdSymbol: "1INCH-USD.CC" },
  { symbol: "BAT", name: "Basic Attention Token", eodhdSymbol: "BAT-USD.CC" },
  { symbol: "ZRX", name: "0x", eodhdSymbol: "ZRX-USD.CC" },
  { symbol: "CELO", name: "Celo", eodhdSymbol: "CELO-USD.CC" },
  { symbol: "KAVA", name: "Kava", eodhdSymbol: "KAVA-USD.CC" },
  { symbol: "FTM", name: "Fantom", eodhdSymbol: "FTM-USD.CC" },
  { symbol: "MINA", name: "Mina", eodhdSymbol: "MINA-USD.CC" },
  { symbol: "ROSE", name: "Oasis Network", eodhdSymbol: "ROSE-USD.CC" },
  { symbol: "AR", name: "Arweave", eodhdSymbol: "AR-USD.CC" },
  { symbol: "GNO", name: "Gnosis", eodhdSymbol: "GNO-USD.CC" },
  { symbol: "LRC", name: "Loopring", eodhdSymbol: "LRC-USD.CC" },
  { symbol: "ANKR", name: "Ankr", eodhdSymbol: "ANKR-USD.CC" },
  { symbol: "SKL", name: "SKALE", eodhdSymbol: "SKL-USD.CC" },
  { symbol: "CRO", name: "Cronos", eodhdSymbol: "CRO-USD.CC" },
  { symbol: "NEO", name: "NEO", eodhdSymbol: "NEO-USD.CC" },
  { symbol: "QTUM", name: "Qtum", eodhdSymbol: "QTUM-USD.CC" },
  { symbol: "GMX", name: "GMX", eodhdSymbol: "GMX-USD.CC" },
  { symbol: "DYDX", name: "dYdX", eodhdSymbol: "DYDX-USD.CC" },
  { symbol: "CAKE", name: "PancakeSwap", eodhdSymbol: "CAKE-USD.CC" },
  { symbol: "BLUR", name: "Blur", eodhdSymbol: "BLUR-USD.CC" },
  { symbol: "FLR", name: "Flare", eodhdSymbol: "FLR-USD.CC" },
  { symbol: "ENJ", name: "Enjin Coin", eodhdSymbol: "ENJ-USD.CC" },
  { symbol: "ORDI", name: "Ordinals", eodhdSymbol: "ORDI-USD.CC" },
  { symbol: "HNT", name: "Helium", eodhdSymbol: "HNT-USD.CC" },
  { symbol: "JASMY", name: "JasmyCoin", eodhdSymbol: "JASMY-USD.CC" },
  { symbol: "IOTX", name: "IoTeX", eodhdSymbol: "IOTX-USD.CC" },
  { symbol: "W", name: "Wormhole", eodhdSymbol: "W-USD.CC" },
];

/**
 * Screener Crypto tab page 2 — 40 names after {@link CRYPTO_TOP10} (50 screener assets = 5 pages × 10).
 * Prefix matches {@link CRYPTO_SEARCH_EXTRA}; tail from {@link CRYPTO_SEARCH_TOP100_REST} (no duplicate symbols).
 */
export const CRYPTO_SCREENER_PAGE2: CryptoMeta[] = [
  ...CRYPTO_SEARCH_EXTRA.slice(0, 26),
  ...CRYPTO_SEARCH_TOP100_REST.slice(0, 14),
];

/** Full screener crypto grid (page 1 + page 2). */
export const CRYPTO_SCREENER_ALL: CryptoMeta[] = [...CRYPTO_TOP10, ...CRYPTO_SCREENER_PAGE2];

/** Global search + `/crypto/[symbol]` — 100 largest liquid names (approx. top market cap). */
export const ALL_CRYPTO_METAS: CryptoMeta[] = [
  ...CRYPTO_TOP10,
  ...CRYPTO_SEARCH_EXTRA,
  ...CRYPTO_SEARCH_TOP100_REST,
];

const CRYPTO_BY_SYMBOL: Record<string, CryptoMeta> = ALL_CRYPTO_METAS.reduce(
  (acc, m) => {
    acc[m.symbol.toUpperCase()] = m;
    return acc;
  },
  {} as Record<string, CryptoMeta>,
);

/**
 * Resolves a route or provider symbol (e.g. `BTC`, `BTC-USD`, `BTC-USD.CC`) to a supported ticker key.
 */
export function toSupportedCryptoTicker(symbolOrTicker: string): SupportedCryptoTicker | null {
  const raw = symbolOrTicker.trim();
  if (!raw) return null;
  let s = raw.toUpperCase();
  if (CRYPTO_BY_SYMBOL[s]) return s;

  s = s.replace(/\.CC$/i, "");
  if (CRYPTO_BY_SYMBOL[s]) return s;

  const pair = /^([A-Z0-9]+)-(USD|USDT|EUR|GBP)$/i.exec(s);
  if (pair) {
    const base = pair[1]!.toUpperCase();
    if (CRYPTO_BY_SYMBOL[base]) return base;
  }

  return null;
}

export function toEodhdCryptoSymbol(symbolOrTicker: string): string | null {
  const s = toSupportedCryptoTicker(symbolOrTicker);
  return s ? CRYPTO_BY_SYMBOL[s]!.eodhdSymbol : null;
}

function realtimePayloadHasUsableQuote(p: EodhdRealtimePayload): boolean {
  return (
    (typeof p.close === "number" && Number.isFinite(p.close) && p.close > 0) ||
    (typeof p.change_p === "number" && Number.isFinite(p.change_p)) ||
    (typeof p.previousClose === "number" && Number.isFinite(p.previousClose) && p.previousClose > 0)
  );
}

/**
 * EODHD realtime batches map rows by `code`, which may differ from the requested symbol
 * (e.g. TON-USD.CC vs TONCOIN-USD.CC).
 */
export function pickCryptoRealtimePayload(
  map: Map<string, EodhdRealtimePayload>,
  meta: CryptoMeta,
): EodhdRealtimePayload | undefined {
  const keys = [meta.eodhdSymbol, ...(meta.eodhdAltSymbols ?? [])];
  for (const k of keys) {
    const p = map.get(k.toUpperCase());
    if (p && realtimePayloadHasUsableQuote(p)) return p;
  }
  return undefined;
}

/** Primary + alternate pair symbols to include in `fetchEodhdRealtimeSymbolsRaw`. */
export function cryptoRealtimeRequestSymbols(metas: readonly CryptoMeta[]): string[] {
  const out: string[] = [];
  for (const c of metas) {
    out.push(c.eodhdSymbol);
    for (const a of c.eodhdAltSymbols ?? []) out.push(a);
  }
  return out;
}
