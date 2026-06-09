import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { parsePersistedPortfolioUnknown } from "@/lib/portfolio/portfolio-storage";
import {
  canonicalNotifyTicker,
  isEarningsNotifiableTicker,
} from "@/lib/notifications/ticker-notify-eligibility";

export type TickerInterestMap = Map<string, Set<string>>;

function addInterest(map: TickerInterestMap, rawTicker: string, userId: string): void {
  if (!isEarningsNotifiableTicker(rawTicker)) return;
  const key = canonicalNotifyTicker(rawTicker);
  if (!key) return;
  let set = map.get(key);
  if (!set) {
    set = new Set();
    map.set(key, set);
  }
  set.add(userId);
}

/**
 * Union of watchlist + portfolio holdings symbols → canonical ticker → interested user ids.
 * One EODHD calendar batch per unique ticker (not per user).
 */
export async function buildEarningsNotifyInterestMap(
  admin: SupabaseClient,
): Promise<TickerInterestMap> {
  const map: TickerInterestMap = new Map();

  const { data: watchRows, error: watchErr } = await admin.from("watchlist").select("user_id,ticker");
  if (watchErr) {
    throw new Error(`watchlist_load_failed: ${watchErr.message}`);
  }
  for (const row of watchRows ?? []) {
    if (typeof row.user_id !== "string" || typeof row.ticker !== "string") continue;
    addInterest(map, row.ticker, row.user_id);
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
        addInterest(map, h.symbol, row.user_id);
      }
    }
  }

  return map;
}

export function interestMapTickers(map: TickerInterestMap): string[] {
  return [...map.keys()].sort((a, b) => a.localeCompare(b));
}
