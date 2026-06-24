import type { WatchlistCollectionsSnapshot } from "@/lib/watchlist/collections";
import { collectionNamesMatch } from "@/lib/watchlist/collection-names";
import type { WatchlistServerSnapshot, WatchlistSyncCollectionInput } from "@/lib/watchlist/types";
import { localSnapshotToSyncInput } from "@/lib/watchlist/snapshot";

export async function fetchWatchlistSnapshot(): Promise<{
  snapshot: WatchlistServerSnapshot | null;
  warning: "db_unavailable" | null;
}> {
  try {
    const res = await fetch("/api/watchlist", { credentials: "include", cache: "no-store" });
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
      },
      warning: null,
    };
  } catch {
    return { snapshot: null, warning: null };
  }
}

export async function syncWatchlistSnapshotToServer(input: {
  collections: WatchlistSyncCollectionInput[];
  activeName: string;
}): Promise<WatchlistServerSnapshot | null> {
  try {
    const res = await fetch("/api/watchlist/sync", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return null;
    return (await res.json()) as WatchlistServerSnapshot;
  } catch {
    return null;
  }
}

export async function postWatchlistTicker(ticker: string, collectionId: string): Promise<boolean> {
  const res = await fetch("/api/watchlist", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
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

  const res = await fetch(`/api/watchlist?${params.toString()}`, {
    method: "DELETE",
    credentials: "include",
    cache: "no-store",
  });
  return res.ok || res.status === 404 || res.status === 401;
}

export async function createWatchlistOnServer(name: string): Promise<boolean> {
  const res = await fetch("/api/watchlist/collections", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return res.ok;
}

export async function renameWatchlistOnServer(collectionId: string, name: string): Promise<boolean> {
  const res = await fetch(`/api/watchlist/collections/${encodeURIComponent(collectionId)}`, {
    method: "PATCH",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return res.ok;
}

export async function deleteWatchlistCollectionOnClient(
  collectionId: string,
): Promise<WatchlistServerSnapshot | null> {
  try {
    const res = await fetch(`/api/watchlist/collections/${encodeURIComponent(collectionId)}`, {
      method: "DELETE",
      credentials: "include",
      cache: "no-store",
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
    const res = await fetch("/api/watchlist/active", {
      method: "PUT",
      credentials: "include",
      cache: "no-store",
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

/** Resolve a client-only wl_* id to a server collection UUID (syncs if needed). */
export async function resolveServerCollectionId(
  local: WatchlistCollectionsSnapshot,
  collectionId: string,
  collectionName: string,
): Promise<string | null> {
  if (!collectionId.startsWith("wl_")) return collectionId;

  const server = await refreshWatchlistSnapshotFromServer();
  if (server) {
    const byName = server.collections.find((collection) =>
      collectionNamesMatch(collection.name, collectionName),
    );
    if (byName) return byName.id;
  }

  const uploaded = await syncWatchlistSnapshotToServer(localSnapshotToSyncInput(local));
  if (!uploaded) return null;

  const match = uploaded.collections.find((collection) =>
    collectionNamesMatch(collection.name, collectionName),
  );
  return match?.id ?? null;
}
