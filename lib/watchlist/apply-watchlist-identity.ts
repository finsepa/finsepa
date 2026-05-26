"use client";

import {
  mergeScreenerCompanyIdentities,
  readScreenerCompanyIdentity,
} from "@/lib/screener/screener-company-identity-storage";
import type { WatchlistEnrichedItem } from "@/lib/watchlist/enriched-types";

/** Overlay 7d screener identity (name + logo) without extra provider calls. */
export function applyWatchlistScreenerIdentity(items: WatchlistEnrichedItem[]): WatchlistEnrichedItem[] {
  return items.map((row) => {
    if (row.kind !== "stock") return row;
    const cached = readScreenerCompanyIdentity(row.symbol);
    if (!cached) return row;
    return {
      ...row,
      name: cached.name || row.name,
      logoUrl: cached.logoUrl || row.logoUrl,
    };
  });
}

/** Persist stock identities from a watchlist enrich response into the shared 7d store. */
export function persistWatchlistStockIdentities(items: readonly WatchlistEnrichedItem[]): void {
  mergeScreenerCompanyIdentities(
    items
      .filter((r) => r.kind === "stock")
      .map((r) => ({ ticker: r.symbol, name: r.name, logoUrl: r.logoUrl })),
  );
}
