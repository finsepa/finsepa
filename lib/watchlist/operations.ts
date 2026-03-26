import type { SupabaseClient } from "@supabase/supabase-js";
import type { WatchlistRow } from "./types";

const TABLE = "watchlist";

/** Uppercase trimmed symbol; rejects empty / too long input. */
export function normalizeWatchlistTicker(raw: string): string {
  const t = raw.trim().toUpperCase();
  if (!t) {
    throw new WatchlistValidationError("Ticker is required.");
  }
  if (t.length > 32) {
    throw new WatchlistValidationError("Ticker is too long.");
  }
  return t;
}

export class WatchlistValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WatchlistValidationError";
  }
}

export async function listWatchlistForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<WatchlistRow[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("id,user_id,ticker,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as WatchlistRow[];
}

/**
 * Inserts a row or, on unique (user_id, ticker) conflict, returns the existing row.
 */
export async function addWatchlistTicker(
  supabase: SupabaseClient,
  userId: string,
  ticker: string,
): Promise<{ row: WatchlistRow; created: boolean }> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ user_id: userId, ticker })
    .select("id,user_id,ticker,created_at")
    .single();

  if (!error && data) {
    return { row: data as WatchlistRow, created: true };
  }

  if (error?.code === "23505") {
    const { data: existing, error: fetchError } = await supabase
      .from(TABLE)
      .select("id,user_id,ticker,created_at")
      .eq("user_id", userId)
      .eq("ticker", ticker)
      .maybeSingle();

    if (fetchError) {
      throw new Error(fetchError.message);
    }
    if (!existing) {
      throw new Error("Duplicate ticker but row not found.");
    }
    return { row: existing as WatchlistRow, created: false };
  }

  throw new Error(error?.message ?? "Insert failed.");
}

export async function removeWatchlistTicker(
  supabase: SupabaseClient,
  userId: string,
  ticker: string,
): Promise<{ removed: boolean }> {
  const { data, error } = await supabase
    .from(TABLE)
    .delete()
    .eq("user_id", userId)
    .eq("ticker", ticker)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }
  return { removed: (data?.length ?? 0) > 0 };
}
