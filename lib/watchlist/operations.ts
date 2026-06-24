import type { SupabaseClient } from "@supabase/supabase-js";

import { DEFAULT_WATCHLIST_DISPLAY_NAME } from "@/lib/watchlist/display-name";
import { collectionNamesMatch } from "@/lib/watchlist/collection-names";
import {
  normalizeWatchlistStorageKey,
  watchlistRemovalCandidateKeys,
} from "@/lib/watchlist/normalize-storage-key";
import {
  emptyWatchlistSectionLayout,
  parseSectionsLayout,
  serializeSectionsLayout,
} from "@/lib/watchlist/sections";
import type {
  WatchlistCollectionRow,
  WatchlistRow,
  WatchlistServerCollection,
  WatchlistServerSnapshot,
  WatchlistSyncCollectionInput,
} from "@/lib/watchlist/types";

const COLLECTIONS_TABLE = "watchlist_collections";
const ITEMS_TABLE = "watchlist";
const STATE_TABLE = "watchlist_user_state";

/** Uppercase trimmed symbol; rejects empty / too long input. */
export function normalizeWatchlistTicker(raw: string): string {
  const t = normalizeWatchlistStorageKey(raw);
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

function normalizeCollectionName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new WatchlistValidationError("Watchlist name is required.");
  }
  if (trimmed.length > 64) {
    throw new WatchlistValidationError("Watchlist name is too long.");
  }
  return trimmed;
}

function pickCanonicalCollection(
  matches: WatchlistCollectionRow[],
  preferredName: string,
): WatchlistCollectionRow {
  return (
    matches.find((collection) => collection.name.toLowerCase() === preferredName.toLowerCase()) ??
    matches.find((collection) => collection.name === DEFAULT_WATCHLIST_DISPLAY_NAME) ??
    matches[0]!
  );
}

async function deleteAliasDuplicateCollections(
  supabase: SupabaseClient,
  userId: string,
  collections: WatchlistSyncCollectionInput[],
  existing: WatchlistCollectionRow[],
): Promise<void> {
  const deleted = new Set<string>();

  for (const input of collections) {
    const name = normalizeCollectionName(input.name);
    const matches = existing.filter((collection) =>
      collectionNamesMatch(name, collection.name),
    );
    if (matches.length <= 1) continue;

    const canonical = pickCanonicalCollection(matches, name);
    for (const collection of matches) {
      if (collection.id === canonical.id || deleted.has(collection.id)) continue;
      await deleteWatchlistCollectionOnServer(supabase, userId, collection.id);
      deleted.add(collection.id);
    }
  }
}

async function listCollectionsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<WatchlistCollectionRow[]> {
  const { data, error } = await supabase
    .from(COLLECTIONS_TABLE)
    .select("id,user_id,name,sort_order,created_at,sections_layout")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as WatchlistCollectionRow[];
}

async function listItemsForUser(supabase: SupabaseClient, userId: string): Promise<WatchlistRow[]> {
  const { data, error } = await supabase
    .from(ITEMS_TABLE)
    .select("id,user_id,collection_id,ticker,sort_order,created_at")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as WatchlistRow[];
}

async function getUserState(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from(STATE_TABLE)
    .select("active_collection_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.active_collection_id ?? null;
}

async function setActiveCollectionId(
  supabase: SupabaseClient,
  userId: string,
  collectionId: string,
): Promise<void> {
  const { error } = await supabase.from(STATE_TABLE).upsert(
    {
      user_id: userId,
      active_collection_id: collectionId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) throw new Error(error.message);
}

function buildSnapshot(
  collections: WatchlistCollectionRow[],
  items: WatchlistRow[],
  activeCollectionId: string | null,
): WatchlistServerSnapshot {
  const lists: WatchlistServerCollection[] = collections.map((collection) => {
    const layout = parseSectionsLayout(collection.sections_layout ?? emptyWatchlistSectionLayout());
    return {
      id: collection.id,
      name: collection.name,
      sortOrder: collection.sort_order,
      tickers: items
        .filter((item) => item.collection_id === collection.id)
        .map((item) => item.ticker),
      sections: layout.sections,
      tickerSections: layout.tickerSections,
    };
  });

  const activeId =
    activeCollectionId && collections.some((c) => c.id === activeCollectionId)
      ? activeCollectionId
      : (collections[0]?.id ?? "");

  return { collections: lists, activeCollectionId: activeId };
}

export async function ensureDefaultWatchlistCollection(
  supabase: SupabaseClient,
  userId: string,
): Promise<WatchlistCollectionRow> {
  const existing = await listCollectionsForUser(supabase, userId);
  if (existing.length > 0) return existing[0]!;

  const { data, error } = await supabase
    .from(COLLECTIONS_TABLE)
    .insert({
      user_id: userId,
      name: DEFAULT_WATCHLIST_DISPLAY_NAME,
      sort_order: 0,
      sections_layout: serializeSectionsLayout(emptyWatchlistSectionLayout()),
    })
    .select("id,user_id,name,sort_order,created_at,sections_layout")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Failed to create default watchlist collection.");

  const row = data as WatchlistCollectionRow;
  await setActiveCollectionId(supabase, userId, row.id);
  return row;
}

export async function getWatchlistSnapshot(
  supabase: SupabaseClient,
  userId: string,
): Promise<WatchlistServerSnapshot> {
  let collections = await listCollectionsForUser(supabase, userId);
  if (!collections.length) {
    await ensureDefaultWatchlistCollection(supabase, userId);
    collections = await listCollectionsForUser(supabase, userId);
  }

  const [items, activeCollectionId] = await Promise.all([
    listItemsForUser(supabase, userId),
    getUserState(supabase, userId),
  ]);

  const snapshot = buildSnapshot(collections, items, activeCollectionId);
  if (!snapshot.activeCollectionId && snapshot.collections[0]) {
    await setActiveCollectionId(supabase, userId, snapshot.collections[0].id);
    snapshot.activeCollectionId = snapshot.collections[0].id;
  }
  return snapshot;
}

/** @deprecated Use getWatchlistSnapshot. Kept for callers expecting a flat list. */
export async function listWatchlistForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<WatchlistRow[]> {
  return listItemsForUser(supabase, userId);
}

export async function createWatchlistCollectionOnServer(
  supabase: SupabaseClient,
  userId: string,
  name: string,
  options?: { activate?: boolean },
): Promise<WatchlistCollectionRow> {
  const trimmed = normalizeCollectionName(name);
  const collections = await listCollectionsForUser(supabase, userId);
  const sortOrder = collections.length;

  const { data, error } = await supabase
    .from(COLLECTIONS_TABLE)
    .insert({
      user_id: userId,
      name: trimmed,
      sort_order: sortOrder,
      sections_layout: serializeSectionsLayout(emptyWatchlistSectionLayout()),
    })
    .select("id,user_id,name,sort_order,created_at,sections_layout")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      throw new WatchlistValidationError("A watchlist with this name already exists.");
    }
    throw new Error(error.message);
  }
  if (!data) throw new Error("Failed to create watchlist collection.");

  const row = data as WatchlistCollectionRow;
  if (options?.activate !== false) {
    await setActiveCollectionId(supabase, userId, row.id);
  }
  return row;
}

export async function renameWatchlistCollectionOnServer(
  supabase: SupabaseClient,
  userId: string,
  collectionId: string,
  name: string,
): Promise<WatchlistCollectionRow> {
  const trimmed = normalizeCollectionName(name);

  const { data, error } = await supabase
    .from(COLLECTIONS_TABLE)
    .update({ name: trimmed })
    .eq("id", collectionId)
    .eq("user_id", userId)
    .select("id,user_id,name,sort_order,created_at,sections_layout")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      throw new WatchlistValidationError("A watchlist with this name already exists.");
    }
    throw new Error(error.message);
  }
  if (!data) throw new WatchlistValidationError("Watchlist not found.");
  return data as WatchlistCollectionRow;
}

async function updateCollectionSectionsLayout(
  supabase: SupabaseClient,
  userId: string,
  collectionId: string,
  input: WatchlistSyncCollectionInput,
): Promise<void> {
  const layout = parseSectionsLayout({
    sections: input.sections ?? [],
    tickerSections: input.tickerSections ?? {},
  });
  const { error } = await supabase
    .from(COLLECTIONS_TABLE)
    .update({ sections_layout: serializeSectionsLayout(layout) })
    .eq("id", collectionId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function deleteWatchlistCollectionOnServer(
  supabase: SupabaseClient,
  userId: string,
  collectionId: string,
): Promise<{ deletedId: string; nextActiveId: string }> {
  const collections = await listCollectionsForUser(supabase, userId);
  if (!collections.some((c) => c.id === collectionId)) {
    throw new WatchlistValidationError("Watchlist not found.");
  }

  const remaining = collections.filter((c) => c.id !== collectionId);

  const { error } = await supabase
    .from(COLLECTIONS_TABLE)
    .delete()
    .eq("id", collectionId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);

  if (!remaining.length) {
    const created = await ensureDefaultWatchlistCollection(supabase, userId);
    return { deletedId: collectionId, nextActiveId: created.id };
  }

  const activeCollectionId = await getUserState(supabase, userId);
  const nextActiveId =
    activeCollectionId && remaining.some((c) => c.id === activeCollectionId)
      ? activeCollectionId
      : remaining[0]!.id;
  await setActiveCollectionId(supabase, userId, nextActiveId);
  return { deletedId: collectionId, nextActiveId };
}

export async function setActiveWatchlistCollectionOnServer(
  supabase: SupabaseClient,
  userId: string,
  collectionId: string,
): Promise<void> {
  const collections = await listCollectionsForUser(supabase, userId);
  if (!collections.some((c) => c.id === collectionId)) {
    throw new WatchlistValidationError("Watchlist not found.");
  }
  await setActiveCollectionId(supabase, userId, collectionId);
}

export async function addWatchlistTicker(
  supabase: SupabaseClient,
  userId: string,
  collectionId: string,
  ticker: string,
  options?: { sortOrder?: number },
): Promise<{ row: WatchlistRow; created: boolean }> {
  const collections = await listCollectionsForUser(supabase, userId);
  if (!collections.some((c) => c.id === collectionId)) {
    throw new WatchlistValidationError("Watchlist not found.");
  }

  let sortOrder = options?.sortOrder;
  if (sortOrder == null) {
    const { data: lastRow, error: lastError } = await supabase
      .from(ITEMS_TABLE)
      .select("sort_order")
      .eq("collection_id", collectionId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastError) throw new Error(lastError.message);
    sortOrder = (lastRow?.sort_order ?? -1) + 1;
  }

  const { data, error } = await supabase
    .from(ITEMS_TABLE)
    .insert({ user_id: userId, collection_id: collectionId, ticker, sort_order: sortOrder })
    .select("id,user_id,collection_id,ticker,sort_order,created_at")
    .maybeSingle();

  if (!error && data) {
    return { row: data as WatchlistRow, created: true };
  }

  if (error?.code === "23505") {
    const { data: existing, error: fetchError } = await supabase
      .from(ITEMS_TABLE)
      .select("id,user_id,collection_id,ticker,sort_order,created_at")
      .eq("collection_id", collectionId)
      .eq("ticker", ticker)
      .maybeSingle();

    if (fetchError) throw new Error(fetchError.message);
    if (!existing) throw new Error("Duplicate ticker but row not found.");
    if (options?.sortOrder != null && existing.sort_order !== options.sortOrder) {
      const { data: updated, error: updateError } = await supabase
        .from(ITEMS_TABLE)
        .update({ sort_order: options.sortOrder })
        .eq("id", existing.id)
        .select("id,user_id,collection_id,ticker,sort_order,created_at")
        .maybeSingle();
      if (updateError) throw new Error(updateError.message);
      if (updated) return { row: updated as WatchlistRow, created: false };
    }
    return { row: existing as WatchlistRow, created: false };
  }

  throw new Error(error?.message ?? "Insert failed.");
}

export async function removeWatchlistTicker(
  supabase: SupabaseClient,
  userId: string,
  ticker: string,
  collectionId?: string,
): Promise<{ removed: boolean }> {
  const candidates = watchlistRemovalCandidateKeys(ticker);

  if (collectionId) {
    for (const candidate of candidates) {
      const { data: deletedRows, error } = await supabase
        .from(ITEMS_TABLE)
        .delete()
        .eq("user_id", userId)
        .eq("collection_id", collectionId)
        .eq("ticker", candidate)
        .select("id");

      if (error) throw new Error(error.message);
      if ((deletedRows?.length ?? 0) > 0) return { removed: true };
    }
    return { removed: false };
  }

  for (const candidate of candidates) {
    const { data: deletedRows, error } = await supabase
      .from(ITEMS_TABLE)
      .delete()
      .eq("user_id", userId)
      .eq("ticker", candidate)
      .select("id");

    if (error) throw new Error(error.message);
    if ((deletedRows?.length ?? 0) > 0) return { removed: true };
  }

  return { removed: false };
}

export async function syncWatchlistFromClient(
  supabase: SupabaseClient,
  userId: string,
  collections: WatchlistSyncCollectionInput[],
  activeName?: string,
): Promise<WatchlistServerSnapshot> {
  if (!collections.length) {
    return getWatchlistSnapshot(supabase, userId);
  }

  const existing = await listCollectionsForUser(supabase, userId);

  for (const orphan of existing) {
    const hasLocalMatch = collections.some((input) =>
      collectionNamesMatch(input.name, orphan.name),
    );
    if (!hasLocalMatch) {
      await deleteWatchlistCollectionOnServer(supabase, userId, orphan.id);
    }
  }

  let refreshed = await listCollectionsForUser(supabase, userId);
  await deleteAliasDuplicateCollections(supabase, userId, collections, refreshed);
  refreshed = await listCollectionsForUser(supabase, userId);
  const byName = new Map(refreshed.map((c) => [c.name.toLowerCase(), c]));
  const resolved: WatchlistCollectionRow[] = [];
  const usedServerIds = new Set<string>();

  for (let i = 0; i < collections.length; i++) {
    const input = collections[i]!;
    const name = normalizeCollectionName(input.name);
    const aliasMatch = refreshed.find(
      (collection) =>
        !usedServerIds.has(collection.id) && collectionNamesMatch(name, collection.name),
    );
    const exactMatch = byName.get(name.toLowerCase());
    const found =
      aliasMatch ??
      (exactMatch && !usedServerIds.has(exactMatch.id) ? exactMatch : undefined);
    if (found) {
      const desiredName = normalizeCollectionName(input.name);
      let resolvedRow = found;
      if (found.name !== desiredName) {
        try {
          resolvedRow = await renameWatchlistCollectionOnServer(
            supabase,
            userId,
            found.id,
            desiredName,
          );
        } catch {
          resolvedRow = found;
        }
      }
      usedServerIds.add(resolvedRow.id);
      resolved.push(resolvedRow);
      continue;
    }
    const created = await createWatchlistCollectionOnServer(supabase, userId, name, { activate: false });
    usedServerIds.add(created.id);
    byName.set(name.toLowerCase(), created);
    resolved.push(created);
  }

  const items = await listItemsForUser(supabase, userId);

  for (const collection of resolved) {
    const input = collections.find((entry) =>
      collectionNamesMatch(entry.name, collection.name),
    );
    const desiredOrder = (input?.tickers ?? []).map(normalizeWatchlistTicker);
    const desiredSet = new Set(desiredOrder);

    const current = items.filter((item) => item.collection_id === collection.id);
    for (const item of current) {
      if (!desiredSet.has(item.ticker)) {
        await supabase.from(ITEMS_TABLE).delete().eq("id", item.id);
      }
    }

    for (let index = 0; index < desiredOrder.length; index++) {
      const ticker = desiredOrder[index]!;
      await addWatchlistTicker(supabase, userId, collection.id, ticker, { sortOrder: index });
    }

    if (input) {
      await updateCollectionSectionsLayout(supabase, userId, collection.id, input);
    }
  }

  const active =
    resolved.find((c) => collectionNamesMatch(c.name, activeName?.trim() ?? "")) ??
    resolved.find((c) => collectionNamesMatch(c.name, DEFAULT_WATCHLIST_DISPLAY_NAME)) ??
    resolved[0];
  if (active) {
    await setActiveCollectionId(supabase, userId, active.id);
  }

  return getWatchlistSnapshot(supabase, userId);
}
