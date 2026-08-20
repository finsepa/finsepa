import "server-only";

import type { PortfolioHolding } from "@/components/portfolio/portfolio-types";
import { applyLivePricesToHoldings } from "@/lib/portfolio/apply-live-prices-to-holdings";
import { cryptoRouteBase } from "@/lib/crypto/crypto-symbol-base";
import { isSupportedCryptoAssetSymbol } from "@/lib/crypto/crypto-logo-url";
import { getCryptoLiveSpotPriceUsd } from "@/lib/market/crypto-live-price";
import { toSupportedCryptoTicker } from "@/lib/market/crypto-meta";
import { loadEodhdRealtimeQuotes } from "@/lib/market/eodhd-realtime-quotes";
import { toEodhdUsSymbol } from "@/lib/market/eodhd-symbol";

function realtimeClose(payload: { close?: number } | undefined): number | null {
  const c = payload?.close;
  return typeof c === "number" && Number.isFinite(c) && c > 0 ? c : null;
}

function isPortfolioCryptoSymbol(sym: string): boolean {
  if (toSupportedCryptoTicker(sym)) return true;
  return isSupportedCryptoAssetSymbol(cryptoRouteBase(sym));
}

/**
 * Batch live USD marks for portfolio holdings — EODHD realtime (1 credit/symbol per request chunk),
 * not per-holding intraday chart attempts (5 credits each).
 */
export async function fetchPortfolioLivePricesUsd(symbols: string[]): Promise<Record<string, number | null>> {
  const out: Record<string, number | null> = {};
  const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
  if (!unique.length) return out;

  const stockEodhd: string[] = [];
  const cryptoRoute: string[] = [];

  for (const sym of unique) {
    if (isPortfolioCryptoSymbol(sym)) {
      cryptoRoute.push(sym);
    } else {
      stockEodhd.push(toEodhdUsSymbol(sym));
    }
  }

  if (stockEodhd.length) {
    const map = await loadEodhdRealtimeQuotes(stockEodhd);
    for (const sym of unique) {
      if (isPortfolioCryptoSymbol(sym)) continue;
      const eodhd = toEodhdUsSymbol(sym);
      const p = realtimeClose(map.get(eodhd) ?? map.get(eodhd.split(".")[0] ?? ""));
      if (p != null) out[sym] = p;
    }
  }

  await Promise.all(
    cryptoRoute.map(async (sym) => {
      try {
        const p = await getCryptoLiveSpotPriceUsd(sym);
        out[sym.toUpperCase()] = p;
      } catch {
        out[sym.toUpperCase()] = null;
      }
    }),
  );

  for (const sym of unique) {
    if (!(sym in out)) out[sym] = null;
  }

  return out;
}

/** Per-symbol cache lives in {@link loadEodhdRealtimeQuotes} — no extra full-set key. */
export async function fetchPortfolioLivePricesUsdCached(
  symbols: string[],
): Promise<Record<string, number | null>> {
  return fetchPortfolioLivePricesUsd(symbols);
}

export async function quoteHoldingsToMarketServer(
  holdings: PortfolioHolding[],
): Promise<PortfolioHolding[]> {
  if (!holdings.length) return holdings;
  const symbols = [...new Set(holdings.map((h) => h.symbol.trim().toUpperCase()).filter(Boolean))];
  const prices = await fetchPortfolioLivePricesUsdCached(symbols);
  return applyLivePricesToHoldings(holdings, prices);
}
