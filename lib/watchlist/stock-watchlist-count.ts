import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Counts how many watchlist rows use this exact plain stock ticker (e.g. `AAPL`).
 * Crypto/index entries use `CRYPTO:` / `INDEX:` prefixes and are not included.
 *
 * 1) Prefer service-role count (see `SUPABASE_SERVICE_ROLE_KEY`).
 * 2) Else optional RPC `count_watchlist_for_ticker` (see `supabase/migrations/20260328120000_watchlist_ticker_count.sql`).
 */
export async function countWatchlistEntriesForStockTicker(ticker: string): Promise<number | null> {
  const sym = ticker.trim().toUpperCase();
  if (!sym) return null;

  const admin = getSupabaseAdminClient();
  if (admin) {
    const { count, error } = await admin.from("watchlist").select("*", { count: "exact", head: true }).eq("ticker", sym);

    if (error) {
      console.error("[countWatchlistEntriesForStockTicker]", error.message);
    } else if (typeof count === "number") {
      return count;
    }
  }

  const viaRpc = await countWatchlistViaRpc(sym);
  return viaRpc;
}

async function countWatchlistViaRpc(ticker: string): Promise<number | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) return null;

  const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.rpc("count_watchlist_for_ticker", { p_ticker: ticker });

  if (error) {
    return null;
  }
  if (typeof data === "number" && Number.isFinite(data)) return data;
  if (typeof data === "bigint") return Number(data);
  if (typeof data === "string") {
    const n = Number(data);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
