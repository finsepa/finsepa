"use client";

import { useEffect, useMemo, useState } from "react";

import type { PortfolioHolding } from "@/components/portfolio/portfolio-types";
import { isCustomPortfolioSymbol } from "@/lib/portfolio/custom-asset-symbol";
import { eodhdCryptoSpotTickerDisplay } from "@/lib/crypto/eodhd-crypto-ticker-display";
import { cryptoRouteBase } from "@/lib/crypto/crypto-symbol-base";
import { isSupportedCryptoAssetSymbol } from "@/lib/crypto/crypto-logo-url";
import { getStockDetailMetaFromTicker } from "@/lib/market/stock-detail-meta";

export function portfolioHoldingDisplayName(
  h: PortfolioHolding,
  resolvedNames: Readonly<Record<string, string>>,
): string {
  const sym = h.symbol.trim().toUpperCase();
  const stored = h.name.trim();
  if (stored && stored.toUpperCase() !== sym) return stored;

  const resolved = resolvedNames[sym]?.trim();
  if (resolved) return resolved;

  const cryptoKey = cryptoRouteBase(h.symbol);
  if (isSupportedCryptoAssetSymbol(cryptoKey)) {
    const label = eodhdCryptoSpotTickerDisplay(h.symbol).trim();
    if (label && label.toUpperCase() !== sym) return label;
  }

  const top10 = getStockDetailMetaFromTicker(sym);
  if (top10.name.toUpperCase() !== sym) return top10.name;

  return stored || sym;
}

export function usePortfolioHoldingDisplayNames(holdings: readonly PortfolioHolding[]) {
  const [resolvedNames, setResolvedNames] = useState<Record<string, string>>({});

  const symbolsToFetch = useMemo(() => {
    const out = new Set<string>();
    for (const h of holdings) {
      if (isCustomPortfolioSymbol(h.symbol)) continue;
      const sym = h.symbol.trim().toUpperCase();
      if (!sym) continue;
      if (isSupportedCryptoAssetSymbol(cryptoRouteBase(h.symbol))) continue;
      const stored = h.name.trim();
      if (!stored || stored.toUpperCase() === sym) {
        const top10 = getStockDetailMetaFromTicker(sym);
        if (top10.name.toUpperCase() === sym) out.add(sym);
      }
    }
    return [...out].sort();
  }, [holdings]);

  const fetchKey = symbolsToFetch.join(",");

  useEffect(() => {
    if (!symbolsToFetch.length) return;
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        symbolsToFetch.map(async (sym) => {
          try {
            const res = await fetch(`/api/stocks/${encodeURIComponent(sym)}/header-meta`, {
              credentials: "include",
            });
            if (!res.ok) return [sym, null] as const;
            const json = (await res.json()) as { fullName?: string | null };
            const name = typeof json.fullName === "string" ? json.fullName.trim() : "";
            return [sym, name || null] as const;
          } catch {
            return [sym, null] as const;
          }
        }),
      );
      if (cancelled) return;
      setResolvedNames((prev) => {
        const next = { ...prev };
        for (const [sym, name] of entries) {
          if (name) next[sym] = name;
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchKey, symbolsToFetch]);

  return resolvedNames;
}
