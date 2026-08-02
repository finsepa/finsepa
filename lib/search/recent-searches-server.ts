import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  MAX_RECENT_SEARCHES,
  mergeRecentSearchLists,
  normalizeRecentSearchItems,
  type RecentSearchStoredItem,
} from "@/lib/search/recent-searches-storage";

export async function getUserRecentSearches(
  supabase: SupabaseClient,
  userId: string,
): Promise<RecentSearchStoredItem[]> {
  const { data, error } = await supabase
    .from("user_recent_searches")
    .select("items")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return normalizeRecentSearchItems(data?.items).slice(0, MAX_RECENT_SEARCHES);
}

/**
 * Upserts the client's list after merging with the server copy so concurrent
 * local/prod edits do not drop items. Pass `removedIds` so deletions stick.
 */
export async function upsertUserRecentSearches(
  supabase: SupabaseClient,
  userId: string,
  clientItems: unknown,
  removedIds: readonly string[] = [],
): Promise<RecentSearchStoredItem[]> {
  const existing = await getUserRecentSearches(supabase, userId);
  const incoming = normalizeRecentSearchItems(clientItems);
  const drop = new Set(removedIds.filter((id) => typeof id === "string" && id.length > 0));
  const merged = mergeRecentSearchLists(incoming, existing)
    .filter((item) => !drop.has(item.id))
    .slice(0, MAX_RECENT_SEARCHES);

  const { error } = await supabase.from("user_recent_searches").upsert(
    {
      user_id: userId,
      items: merged,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) throw new Error(error.message);
  return merged;
}
