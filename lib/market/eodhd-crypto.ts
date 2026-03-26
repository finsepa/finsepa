import "server-only";

import { getEodhdApiKey } from "@/lib/env/server";
import type { EodhdDailyBar } from "@/lib/market/eodhd-eod";

export type SupportedCryptoTicker =
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

export type CryptoMeta = {
  symbol: SupportedCryptoTicker;
  name: string;
  /**
   * EODHD expects crypto pairs like BTC-USD.CC for spot crypto.
   * See: https://eodhd.com/financial-apis/real-time-data-api-websockets/
   */
  eodhdSymbol: string;
  /**
   * Optional alternate EODHD symbols to try (TON historically has multiple nearby tickers).
   * Used only as a fallback strategy in the crypto loaders.
   */
  eodhdAltSymbols?: string[];
};

export const CRYPTO_TOP10: CryptoMeta[] = [
  { symbol: "BTC", name: "Bitcoin", eodhdSymbol: "BTC-USD.CC" },
  { symbol: "ETH", name: "Ethereum", eodhdSymbol: "ETH-USD.CC" },
  { symbol: "XRP", name: "XRP", eodhdSymbol: "XRP-USD.CC" },
  { symbol: "BNB", name: "BNB", eodhdSymbol: "BNB-USD.CC" },
  { symbol: "SOL", name: "Solana", eodhdSymbol: "SOL-USD.CC" },
  { symbol: "DOGE", name: "Dogecoin", eodhdSymbol: "DOGE-USD.CC" },
  { symbol: "ADA", name: "Cardano", eodhdSymbol: "ADA-USD.CC" },
  { symbol: "TRX", name: "TRON", eodhdSymbol: "TRX-USD.CC" },
  // LINK-USD in EODHD list corresponds to Chainlink.
  { symbol: "LINK", name: "Chainlink", eodhdSymbol: "LINK-USD.CC" },
  { symbol: "AVAX", name: "Avalanche", eodhdSymbol: "AVAX-USD.CC" },
];

const CRYPTO_BY_SYMBOL: Record<SupportedCryptoTicker, CryptoMeta> = CRYPTO_TOP10.reduce((acc, m) => {
  acc[m.symbol] = m;
  return acc;
}, {} as Record<SupportedCryptoTicker, CryptoMeta>);

export function toSupportedCryptoTicker(symbolOrTicker: string): SupportedCryptoTicker | null {
  const s = symbolOrTicker.trim().toUpperCase();
  if (s in CRYPTO_BY_SYMBOL) return s as SupportedCryptoTicker;
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

  // Required debugging: log raw response for TON only.
  const debugSymbols = new Set(["TONCOIN-USD.CC", "TON-USD.CC"]);
  const shouldDebug = debugSymbols.has(eodhdCryptoSymbol);

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;

    if (shouldDebug) {
      // Required debugging: log raw response for BTC + TON.
      console.log("[crypto daily raw]", eodhdCryptoSymbol, JSON.stringify(data).slice(0, 60000));
    }

    if (!Array.isArray(data)) return null;

    const out: EodhdDailyBar[] = [];
    for (const raw of data) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as Record<string, unknown>;
      const date = row.date;
      if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

      // Crypto feeds can vary fields; we try several close-like keys.
      const close =
        (typeof row.adjusted_close === "number" && Number.isFinite(row.adjusted_close) ? row.adjusted_close : null) ??
        (typeof row.close === "number" && Number.isFinite(row.close) ? row.close : null) ??
        (typeof row.adj_close === "number" && Number.isFinite(row.adj_close) ? row.adj_close : null) ??
        // Fallback: first finite numeric field where key includes "close" (but not "previous").
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

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    // Handles cases like "$1,234B" or "1,234B"
    const cleaned = v.replace(/,/g, "").replace(/[^0-9.+-eE]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Fundamentals → Market cap. One call per symbol (batch is handled at call-site).
 */
export async function fetchEodhdCryptoFundamentalsHighlights(eodhdCryptoSymbol: string): Promise<EodhdCryptoHighlights | null> {
  const key = getEodhdApiKey();
  if (!key) return null;

  const url = `https://eodhd.com/api/fundamentals/${encodeURIComponent(eodhdCryptoSymbol)}?api_token=${encodeURIComponent(
    key,
  )}&fmt=json`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const root = (await res.json()) as Record<string, unknown> | null;
    if (!root || typeof root !== "object" || "error" in root) return null;

    // Required debugging: log raw response for TON only.
    const debugSymbols = new Set(["TONCOIN-USD.CC", "TON-USD.CC"]);
    const shouldDebug = debugSymbols.has(eodhdCryptoSymbol);
    if (shouldDebug) {
      // Required debugging: log raw response for BTC + TON.
      console.log("[crypto fundamentals raw]", eodhdCryptoSymbol, JSON.stringify(root).slice(0, 60000));
    }

    // Market cap can appear in different places; we search shallowly + then recursively a few levels.
    const findMarketCap = (obj: unknown, depth: number): number | null => {
      if (obj == null || depth < 0) return null;
      if (typeof obj === "number") return Number.isFinite(obj) ? obj : null;

      if (typeof obj === "string") return num(obj);

      if (Array.isArray(obj)) {
        for (const v of obj) {
          const hit = findMarketCap(v, depth - 1);
          if (hit != null) return hit;
        }
        return null;
      }

      if (typeof obj !== "object") return null;

      const rec = obj as Record<string, unknown>;
      for (const [k, v] of Object.entries(rec)) {
        const nk = k.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (nk.includes("marketcap")) {
          const val = num(v);
          if (val != null) return val;
        }
      }

      // Search nested objects (small depth to avoid huge recursion).
      for (const v of Object.values(rec)) {
        const hit = findMarketCap(v, depth - 1);
        if (hit != null) return hit;
      }
      return null;
    };

    const marketCapUsd = findMarketCap(root, 3);

    return { marketCapUsd };
  } catch {
    return null;
  }
}

