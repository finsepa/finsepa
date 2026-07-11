import type { WatchlistCollectionsSnapshot } from "@/lib/watchlist/collections";
import type { WatchlistSection } from "@/lib/watchlist/sections";
import { collectionNamesMatch } from "@/lib/watchlist/collection-names";
import type { WatchlistServerSnapshot, WatchlistSyncCollectionInput } from "@/lib/watchlist/types";
import { localSnapshotToSyncInput, localSnapshotToSyncInputWithServer } from "@/lib/watchlist/snapshot";
import { logWatchlistSync } from "@/lib/watchlist/sync-debug";
import { watchlistApiFetch } from "@/lib/watchlist/watchlist-api-fetch";

export async function fetchWatchlistSnapshot(): Promise<{
  snapshot: WatchlistServerSnapshot | null;
  warning: "db_unavailable" | null;
}> {
  try {
    const res = await watchlistApiFetch("/api/watchlist");
    if (!res.ok) return { snapshot: null, warning: null };
    const data = (await res.json()) as WatchlistServerSnapshot & { warning?: string };
    if (data.warning === "db_unavailable") {
      return { snapshot: null, warning: "db_unavailable" };
    }
    if (!Array.isArray(data.collections) || data.collections.length === 0) {
      return { snapshot: null, warning: null };
    }
    const activeCollectionId =
      data.activeCollectionId || data.collections[0]?.id || "";
    return {
      snapshot: {
        collections: data.collections,
        activeCollectionId,
        updatedAt: data.updatedAt ?? null,
      },
      warning: null,
    };
  } catch {
    return { snapshot: null, warning: null };
  }
}

/** @deprecated Normal client flows must not call full sync. Replacement semantics — deletes by omission. */
export async function syncWatchlistSnapshotToServer(input: {
  collections: WatchlistSyncCollectionInput[];
  activeName: string;
}): Promise<WatchlistServerSnapshot | null> {
  try {
    logWatchlistSync("full_sync_post");
    const res = await watchlistApiFetch("/api/watchlist/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      if (res.status === 409) {
        if (process.env.NODE_ENV === "development") {
          const detail = await res.text().catch(() => "");
          console.warn("[watchlist sync] destructive sync blocked", detail);
        }
        return null;
      }
      if (res.status !== 401 && process.env.NODE_ENV === "development") {
        const detail = await res.text().catch(() => "");
        console.warn("[watchlist sync] failed", res.status, detail);
      }
      return null;
    }
    return (await res.json()) as WatchlistServerSnapshot;
  } catch (error) {
    console.error("[watchlist sync] error", error);
    return null;
  }
}

export function findServerCollectionIdByName(
  server: WatchlistServerSnapshot | null | undefined,
  collectionName: string,
): string | null {
  if (!server) return null;
  return (
    server.collections.find((collection) => collectionNamesMatch(collection.name, collectionName))
      ?.id ?? null
  );
}

/** @deprecated Normal client flows must not call full sync. Replacement semantics — deletes by omission. */
export async function syncWatchlistCollectionsToServer(
  local: WatchlistCollectionsSnapshot,
  server?: WatchlistServerSnapshot | null,
): Promise<WatchlistServerSnapshot | null> {
  const knownServer = server ?? (await refreshWatchlistSnapshotFromServer());
  return syncWatchlistSnapshotToServer(localSnapshotToSyncInputWithServer(local, knownServer));
}

export async function postWatchlistTicker(ticker: string, collectionId: string): Promise<boolean> {
  const res = await watchlistApiFetch("/api/watchlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticker, collectionId }),
  });
  return res.ok;
}

export async function deleteWatchlistTicker(
  ticker: string,
  options?: { collectionId?: string; scope?: "all" },
): Promise<boolean> {
  const params = new URLSearchParams({ ticker });
  if (options?.collectionId) params.set("collectionId", options.collectionId);
  if (options?.scope === "all") params.set("scope", "all");

  const res = await watchlistApiFetch(`/api/watchlist?${params.toString()}`, {
    method: "DELETE",
  });
  if (res.ok) return true;
  if (res.status === 401) return false;
  return false;
}

export async function createWatchlistCollectionOnClient(
  name: string,
): Promise<WatchlistServerSnapshot | null> {
  try {
    const res = await watchlistApiFetch("/api/watchlist/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return null;
    return (await res.json()) as WatchlistServerSnapshot;
  } catch {
    return null;
  }
}

/** @deprecated Use createWatchlistCollectionOnClient when the response snapshot is needed. */
export async function createWatchlistOnServer(name: string): Promise<boolean> {
  return (await createWatchlistCollectionOnClient(name)) != null;
}

export async function patchWatchlistCollectionSections(
  collectionId: string,
  sections: WatchlistSection[],
  tickerSections: Record<string, string>,
): Promise<boolean> {
  const res = await watchlistApiFetch(
    `/api/watchlist/collections/${encodeURIComponent(collectionId)}/sections`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sections, tickerSections }),
    },
  );
  return res.ok;
}

export async function reorderWatchlistCollectionItems(
  collectionId: string,
  tickers: string[],
): Promise<boolean> {
  const res = await watchlistApiFetch(
    `/api/watchlist/collections/${encodeURIComponent(collectionId)}/items/reorder`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tickers }),
    },
  );
  return res.ok;
}

export async function reorderWatchlistCollections(collectionIds: string[]): Promise<boolean> {
  const res = await watchlistApiFetch("/api/watchlist/collections/reorder", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ collectionIds }),
  });
  return res.ok;
}

export async function renameWatchlistOnServer(collectionId: string, name: string): Promise<boolean> {
  const res = await watchlistApiFetch(`/api/watchlist/collections/${encodeURIComponent(collectionId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return res.ok;
}

export async function deleteWatchlistCollectionOnClient(
  collectionId: string,
): Promise<WatchlistServerSnapshot | null> {
  try {
    const res = await watchlistApiFetch(`/api/watchlist/collections/${encodeURIComponent(collectionId)}`, {
      method: "DELETE",
    });
    if (!res.ok) return null;
    return (await res.json()) as WatchlistServerSnapshot;
  } catch {
    return null;
  }
}

/** @deprecated Use deleteWatchlistCollectionOnClient when the response snapshot is needed. */
export async function deleteWatchlistOnServer(collectionId: string): Promise<boolean> {
  return (await deleteWatchlistCollectionOnClient(collectionId)) != null;
}

export async function setActiveWatchlistOnServer(
  collectionId: string,
): Promise<WatchlistServerSnapshot | null> {
  try {
    const res = await watchlistApiFetch("/api/watchlist/active", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collectionId }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as WatchlistServerSnapshot;
    if (!Array.isArray(data.collections) || !data.activeCollectionId) return null;
    return data;
  } catch {
    return null;
  }
}

export async function refreshWatchlistSnapshotFromServer(): Promise<WatchlistServerSnapshot | null> {
  const { snapshot } = await fetchWatchlistSnapshot();
  return snapshot;
}

export async function resetNewAccountWatchlistOnServer(): Promise<WatchlistServerSnapshot | null> {
  try {
    const res = await watchlistApiFetch("/api/watchlist/reset", { method: "POST" });
    if (!res.ok) return null;
    return (await res.json()) as WatchlistServerSnapshot;
  } catch {
    return null;
  }
}

/** Resolve a client-only wl_* id to a server collection UUID without full sync. */
export async function resolveServerCollectionId(
  _local: WatchlistCollectionsSnapshot,
  collectionId: string,
  collectionName: string,
): Promise<string | null> {
  if (!collectionId.startsWith("wl_")) return collectionId;

  const server = await refreshWatchlistSnapshotFromServer();
  if (server) {
    const byName = findServerCollectionIdByName(server, collectionName);
    if (byName) return byName;
  }

  const created = await createWatchlistCollectionOnClient(collectionName.trim());
  return created ? findServerCollectionIdByName(created, collectionName) : null;
}
