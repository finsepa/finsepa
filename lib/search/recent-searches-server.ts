import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  MAX_RECENT_SEARCHES,
  mergeRecentSearchLists,
  normalizeRecentSearchItems,
  type RecentSearchStoredItem,
} from "@/lib/search/recent-searches-storage";

export type UserRecentSearchesSnapshot = {
  items: RecentSearchStoredItem[];
  /** ISO timestamp when the user last cleared the full list (authoritative empty). */
  clearedAt: string | null;
  updatedAt: string | null;
};

function recordedAtMs(item: RecentSearchStoredItem): number {
  if (typeof item.recordedAt === "number" && Number.isFinite(item.recordedAt)) {
    return item.recordedAt;
  }
  return 0;
}

function filterAfterClearedAt(
  items: RecentSearchStoredItem[],
  clearedAtIso: string | null | undefined,
): RecentSearchStoredItem[] {
  if (!clearedAtIso) return items;
  const clearedMs = Date.parse(clearedAtIso);
  if (!Number.isFinite(clearedMs)) return items;
  return items.filter((item) => recordedAtMs(item) >= clearedMs);
}

export async function getUserRecentSearchesSnapshot(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserRecentSearchesSnapshot> {
  const { data, error } = await supabase
    .from("user_recent_searches")
    .select("items, cleared_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const clearedAt =
    typeof data?.cleared_at === "string" && data.cleared_at.trim() ? data.cleared_at : null;
  const updatedAt =
    typeof data?.updated_at === "string" && data.updated_at.trim() ? data.updated_at : null;
  const items = filterAfterClearedAt(
    normalizeRecentSearchItems(data?.items).slice(0, MAX_RECENT_SEARCHES),
    clearedAt,
  );

  return { items, clearedAt, updatedAt };
}

export async function getUserRecentSearches(
  supabase: SupabaseClient,
  userId: string,
): Promise<RecentSearchStoredItem[]> {
  const snapshot = await getUserRecentSearchesSnapshot(supabase, userId);
  return snapshot.items;
}

export type UpsertUserRecentSearchesOptions = {
  /** Replace the row with [] and bump cleared_at — cross-device clear. */
  clear?: boolean;
};

/**
 * Upserts the client's list after merging with the server copy so concurrent
 * local/prod edits do not drop items. Pass `removedIds` so deletions stick.
 * Pass `clear: true` (or empty items + removedIds covering the server list) for
 * an authoritative clear that other devices must not resurrect from stale local.
 */
export async function upsertUserRecentSearches(
  supabase: SupabaseClient,
  userId: string,
  clientItems: unknown,
  removedIds: readonly string[] = [],
  options?: UpsertUserRecentSearchesOptions,
): Promise<RecentSearchStoredItem[]> {
  const snapshot = await getUserRecentSearchesSnapshot(supabase, userId);
  const existing = snapshot.items;
  const incoming = normalizeRecentSearchItems(clientItems);
  const drop = new Set(removedIds.filter((id) => typeof id === "string" && id.length > 0));

  const clearAll =
    options?.clear === true ||
    (incoming.length === 0 &&
      drop.size > 0 &&
      existing.length > 0 &&
      existing.every((item) => drop.has(item.id)));

  const nowIso = new Date().toISOString();

  if (clearAll) {
    const { error } = await supabase.from("user_recent_searches").upsert(
      {
        user_id: userId,
        items: [],
        cleared_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return [];
  }

  const merged = filterAfterClearedAt(
    mergeRecentSearchLists(incoming, existing)
      .filter((item) => !drop.has(item.id))
      .slice(0, MAX_RECENT_SEARCHES),
    snapshot.clearedAt,
  );

  const { error } = await supabase.from("user_recent_searches").upsert(
    {
      user_id: userId,
      items: merged,
      updated_at: nowIso,
      // Keep prior cleared_at so stale clients cannot reintroduce pre-clear rows.
      cleared_at: snapshot.clearedAt,
    },
    { onConflict: "user_id" },
  );

  if (error) throw new Error(error.message);
  return merged;
}
