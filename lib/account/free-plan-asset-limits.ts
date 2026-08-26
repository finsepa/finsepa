/**
 * Free plan per-entity asset caps (holdings / watchlist tickers).
 * Policy: over-cap data from Pro→Free is kept; growth past the cap is blocked.
 * Manual portfolios only — demo / combined / brokerage are excluded.
 */

import {
  FREE_MAX_HOLDINGS_PER_PORTFOLIO,
  FREE_MAX_WATCHLIST_ASSETS,
} from "@/lib/account/plan-entitlements";
import { isManualPortfolioForFreeQuota } from "@/lib/account/free-plan-quota";

export const FREE_HOLDINGS_LIMIT_CODE = "FREE_HOLDINGS_LIMIT" as const;
export const FREE_WATCHLIST_ASSET_LIMIT_CODE = "FREE_WATCHLIST_ASSET_LIMIT" as const;

export type HoldingLike = { symbol?: string | null; shares?: number | null };

/** Unique open symbols (shares &gt; 0). Closed lots do not consume the Free slot. */
export function countUniqueOpenHoldingSymbols(
  holdings: readonly HoldingLike[] | null | undefined,
): number {
  if (!holdings?.length) return 0;
  const set = new Set<string>();
  for (const h of holdings) {
    const sym = typeof h.symbol === "string" ? h.symbol.trim().toUpperCase() : "";
    if (!sym) continue;
    const shares = typeof h.shares === "number" && Number.isFinite(h.shares) ? h.shares : 0;
    if (shares > 1e-12) set.add(sym);
  }
  return set.size;
}

export function uniqueOpenHoldingSymbols(
  holdings: readonly HoldingLike[] | null | undefined,
): Set<string> {
  const set = new Set<string>();
  if (!holdings?.length) return set;
  for (const h of holdings) {
    const sym = typeof h.symbol === "string" ? h.symbol.trim().toUpperCase() : "";
    if (!sym) continue;
    const shares = typeof h.shares === "number" && Number.isFinite(h.shares) ? h.shares : 0;
    if (shares > 1e-12) set.add(sym);
  }
  return set;
}

/** True when adding `symbol` would create a new open holding past Free cap. */
export function wouldExceedFreeHoldingsCap(args: {
  holdings: readonly HoldingLike[] | null | undefined;
  symbol: string;
  /** Omit for Free default (15). Pass `null` for Pro (unlimited). */
  maxHoldings?: number | null;
}): boolean {
  const max =
    args.maxHoldings === undefined ? FREE_MAX_HOLDINGS_PER_PORTFOLIO : args.maxHoldings;
  if (max == null) return false;
  const sym = args.symbol.trim().toUpperCase();
  if (!sym) return false;
  const open = uniqueOpenHoldingSymbols(args.holdings);
  if (open.has(sym)) return false;
  return open.size >= max;
}

export type FreeHoldingsPersistViolation = {
  portfolioId: string;
  portfolioName?: string;
  nextCount: number;
  prevCount: number;
  max: number;
};

/**
 * Free workspace PUT: allow ≤max, or grandfather over-cap if count does not increase.
 * Reject when a manual portfolio’s open-symbol count grows past the Free max.
 */
export function findFreeHoldingsPersistViolation(args: {
  portfolios: readonly {
    id: string;
    name?: string;
    kind?: string | null;
    isDemo?: boolean | null;
    snaptrade?: unknown;
  }[];
  nextHoldingsByPortfolioId: Record<string, readonly HoldingLike[] | undefined>;
  previousHoldingsByPortfolioId?: Record<string, readonly HoldingLike[] | undefined> | null;
  maxHoldings?: number | null;
}): FreeHoldingsPersistViolation | null {
  const max =
    args.maxHoldings === undefined ? FREE_MAX_HOLDINGS_PER_PORTFOLIO : args.maxHoldings;
  if (max == null) return null;

  for (const p of args.portfolios) {
    if (!isManualPortfolioForFreeQuota(p)) continue;
    const nextCount = countUniqueOpenHoldingSymbols(args.nextHoldingsByPortfolioId[p.id]);
    const prevCount = countUniqueOpenHoldingSymbols(
      args.previousHoldingsByPortfolioId?.[p.id],
    );
    if (nextCount > max && nextCount > prevCount) {
      return {
        portfolioId: p.id,
        portfolioName: p.name,
        nextCount,
        prevCount,
        max,
      };
    }
  }
  return null;
}

export function wouldExceedFreeWatchlistAssetCap(args: {
  currentTickerCount: number;
  tickerAlreadyPresent: boolean;
  /** Omit for Free default (15). Pass `null` for Pro (unlimited). */
  maxAssets?: number | null;
}): boolean {
  const max =
    args.maxAssets === undefined ? FREE_MAX_WATCHLIST_ASSETS : args.maxAssets;
  if (max == null) return false;
  if (args.tickerAlreadyPresent) return false;
  return args.currentTickerCount >= max;
}

export function freeHoldingsLimitMessage(max = FREE_MAX_HOLDINGS_PER_PORTFOLIO): string {
  return `Free includes up to ${max} assets per portfolio. Upgrade to Pro for unlimited holdings.`;
}

export function freeWatchlistAssetLimitMessage(max = FREE_MAX_WATCHLIST_ASSETS): string {
  return `Free includes up to ${max} assets per watchlist. Upgrade to Pro for unlimited assets.`;
}
