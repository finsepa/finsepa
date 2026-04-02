import "server-only";

import { getEodhdApiKey } from "@/lib/env/server";
import { fetchEodhdCryptoFundamentalsMeta } from "@/lib/market/eodhd-crypto-fundamentals-meta";
import type { EodhdDailyBar } from "@/lib/market/eodhd-eod";

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
  { symbol: "POL", name: "Polygon", eodhdSymbol: "POL-USD.CC" },
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
  { symbol: "IMX", name: "Immutable", eodhdSymbol: "IMX-USD.CC" },
  { symbol: "GRT", name: "The Graph", eodhdSymbol: "GRT-USD.CC" },
  { symbol: "FET", name: "Fetch.ai", eodhdSymbol: "FET-USD.CC" },
  { symbol: "RNDR", name: "Render", eodhdSymbol: "RNDR-USD.CC" },
  { symbol: "SNX", name: "Synthetix", eodhdSymbol: "SNX-USD.CC" },
  { symbol: "CRV", name: "Curve", eodhdSymbol: "CRV-USD.CC" },
];

export const ALL_CRYPTO_METAS: CryptoMeta[] = [...CRYPTO_TOP10, ...CRYPTO_SEARCH_EXTRA];

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

export async function fetchEodhdCryptoDailyBars(eodhdCryptoSymbol: string, from: string, to: string): Promise<EodhdDailyBar[] | null> {
  const key = getEodhdApiKey();
  if (!key) return null;

  const params = new URLSearchParams({
    api_token: key,
    fmt: "json",
    period: "d",
    order: "a",
    from,
    to,
  });

  const url = `https://eodhd.com/api/eod/${encodeURIComponent(eodhdCryptoSymbol)}?${params.toString()}`;

  const debugSymbols = new Set(["TONCOIN-USD.CC", "TON-USD.CC"]);
  const shouldDebug = debugSymbols.has(eodhdCryptoSymbol);

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;

    if (shouldDebug) {
      console.log("[crypto daily raw]", eodhdCryptoSymbol, JSON.stringify(data).slice(0, 60000));
    }

    if (!Array.isArray(data)) return null;

    const out: EodhdDailyBar[] = [];
    for (const raw of data) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as Record<string, unknown>;
      const date = row.date;
      if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

      const close =
        (typeof row.adjusted_close === "number" && Number.isFinite(row.adjusted_close) ? row.adjusted_close : null) ??
        (typeof row.close === "number" && Number.isFinite(row.close) ? row.close : null) ??
        (typeof row.adj_close === "number" && Number.isFinite(row.adj_close) ? row.adj_close : null) ??
        (() => {
          for (const [k, v] of Object.entries(row)) {
            const lk = k.toLowerCase();
            if (!lk.includes("close")) continue;
            if (lk.includes("previous")) continue;
            if (typeof v === "number" && Number.isFinite(v)) return v;
            if (typeof v === "string" && v.trim()) {
              const n = Number(v.replace(/,/g, ""));
              if (Number.isFinite(n) && n > 0) return n;
            }
          }
          return null;
        })();

      if (close == null || !Number.isFinite(close)) continue;
      out.push({ date, close });
    }

    out.sort((a, b) => a.date.localeCompare(b.date));
    return out.length ? out : null;
  } catch {
    return null;
  }
}

export type EodhdCryptoHighlights = {
  marketCapUsd: number | null;
};

export async function fetchEodhdCryptoFundamentalsHighlights(eodhdCryptoSymbol: string): Promise<EodhdCryptoHighlights | null> {
  const m = await fetchEodhdCryptoFundamentalsMeta(eodhdCryptoSymbol);
  if (!m) return null;
  return { marketCapUsd: m.marketCapUsd };
}
