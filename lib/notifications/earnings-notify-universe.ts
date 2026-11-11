import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { toSupportedCryptoTicker } from "@/lib/market/crypto-meta";
import { isCustomPortfolioSymbol } from "@/lib/portfolio/custom-asset-symbol";
import { parsePersistedPortfolioUnknown } from "@/lib/portfolio/portfolio-storage";
import {
  canonicalNotifyTicker,
  isEarningsNotifiableTicker,
} from "@/lib/notifications/ticker-notify-eligibility";
import { WATCHLIST_CRYPTO_PREFIX } from "@/lib/watchlist/constants";

export type TickerInterestMap = Map<string, Set<string>>;

type FollowedSymbol = { raw: string; userId: string };

function addToMap(map: TickerInterestMap, key: string, userId: string): void {
  let set = map.get(key);
  if (!set) {
    set = new Set();
    map.set(key, set);
  }
  set.add(userId);
}

/** Watchlist rows + portfolio holdings with shares > 0, as stored (any asset kind). */
async function loadFollowedSymbols(admin: SupabaseClient): Promise<FollowedSymbol[]> {
  const out: FollowedSymbol[] = [];

  const { data: watchRows, error: watchErr } = await admin.from("watchlist").select("user_id,ticker");
  if (watchErr) {
    throw new Error(`watchlist_load_failed: ${watchErr.message}`);
  }
  for (const row of watchRows ?? []) {
    if (typeof row.user_id !== "string" || typeof row.ticker !== "string") continue;
    out.push({ raw: row.ticker, userId: row.user_id });
  }

  const { data: portfolioRows, error: portErr } = await admin
    .from("portfolio_workspace")
    .select("user_id,state");
  if (portErr) {
    throw new Error(`portfolio_workspace_load_failed: ${portErr.message}`);
  }

  for (const row of portfolioRows ?? []) {
    if (typeof row.user_id !== "string") continue;
    const state = parsePersistedPortfolioUnknown(row.state);
    if (!state) continue;
    for (const holdings of Object.values(state.holdingsByPortfolioId)) {
      for (const h of holdings) {
        if (h.shares <= 0) continue;
        out.push({ raw: h.symbol, userId: row.user_id });
      }
    }
  }

  return out;
}

function stockInterest(followed: readonly FollowedSymbol[]): TickerInterestMap {
  const map: TickerInterestMap = new Map();
  for (const { raw, userId } of followed) {
    if (!isEarningsNotifiableTicker(raw)) continue;
    const key = canonicalNotifyTicker(raw);
    if (key) addToMap(map, key, userId);
  }
  return map;
}

/** `CRYPTO:BTC` (watchlist) / `BTC-USD`, `BTC` (holdings) → `BTC`; null for stocks and custom assets. */
export function followedCryptoBase(raw: string): string | null {
  const s = raw.trim();
  if (!s || isCustomPortfolioSymbol(s)) return null;
  const upper = s.toUpperCase();
  const prefixed = upper.startsWith(WATCHLIST_CRYPTO_PREFIX);
  if (!prefixed && isEarningsNotifiableTicker(s)) return null;
  return toSupportedCryptoTicker(prefixed ? upper.slice(WATCHLIST_CRYPTO_PREFIX.length) : upper);
}

function cryptoInterest(followed: readonly FollowedSymbol[]): TickerInterestMap {
  const map: TickerInterestMap = new Map();
  for (const { raw, userId } of followed) {
    const base = followedCryptoBase(raw);
    if (base) addToMap(map, base, userId);
  }
  return map;
}

/**
 * Union of watchlist + portfolio holdings symbols → canonical ticker → interested user ids.
 * One EODHD calendar batch per unique ticker (not per user).
 */
export async function buildEarningsNotifyInterestMap(admin: SupabaseClient): Promise<TickerInterestMap> {
  return stockInterest(await loadFollowedSymbols(admin));
}

/** Stocks keyed like {@link buildEarningsNotifyInterestMap}; crypto keyed by base (`BTC`). One read for both. */
export async function buildMarketNotifyInterestMaps(
  admin: SupabaseClient,
): Promise<{ stocks: TickerInterestMap; crypto: TickerInterestMap }> {
  const followed = await loadFollowedSymbols(admin);
  return { stocks: stockInterest(followed), crypto: cryptoInterest(followed) };
}

export function interestMapTickers(map: TickerInterestMap): string[] {
  return [...map.keys()].sort((a, b) => a.localeCompare(b));
}
