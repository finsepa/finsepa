import type { WatchlistCollection, WatchlistCollectionsSnapshot } from "@/lib/watchlist/collections";
import { collectionNamesMatch } from "@/lib/watchlist/collection-names";
import {
  emptyWatchlistSectionLayout,
  sectionsLayoutsEqual,
  serverHasSectionsLayout,
} from "@/lib/watchlist/sections";
import {
  clearDuplicateWatchlistTickerCopies,
  ensureSnapshotActiveId,
  getActiveWatchlistCollection,
  isPlaceholderWatchlistId,
  preferPopulatedActiveWatchlist,
  unionWatchlistTickers,
  writeWatchlistCollections,
} from "@/lib/watchlist/collections";
import type { WatchlistServerSnapshot, WatchlistSyncCollectionInput } from "@/lib/watchlist/types";
import { normalizeWatchlistStorageKey } from "@/lib/watchlist/normalize-storage-key";

function findServerCollectionForLocalList(
  localList: WatchlistCollection,
  server: WatchlistServerSnapshot,
) {
  return server.collections.find((collection) =>
    collectionNamesMatch(collection.name, localList.name),
  );
}

function mergeListTickers(localTickers: string[], serverTickers: string[]): string[] {
  if (localTickers.length === 0) return [...serverTickers];
  if (serverTickers.length === 0) return [...localTickers];
  const localSet = new Set(localTickers);
  const merged = [...localTickers];
  for (const ticker of serverTickers) {
    if (!localSet.has(ticker)) merged.push(ticker);
  }
  return merged;
}

function isTickerSuperset(superset: string[], subset: string[]): boolean {
  if (subset.length === 0 || superset.length <= subset.length) return false;
  const supersetKeys = new Set(superset);
  return subset.every((ticker) => supersetKeys.has(ticker));
}

/** True when this browser has an old flat superset and the server already has a curated layout. */
export function localIsStaleSupersetOfServer(
  local: WatchlistCollectionsSnapshot,
  server: WatchlistServerSnapshot,
): boolean {
  return local.lists.some((localList) => {
    const serverList = findServerCollectionForLocalList(localList, server);
    if (!serverList) return false;

    const localLayout = {
      sections: localList.sections,
      tickerSections: localList.tickerSections,
    };
    const serverLayout = {
      sections: serverList.sections,
      tickerSections: serverList.tickerSections,
    };

    if (!serverHasSectionsLayout(serverLayout)) return false;
    if (
      serverHasSectionsLayout(localLayout) &&
      sectionsLayoutsEqual(localLayout, serverLayout)
    ) {
      return false;
    }
    if (serverHasSectionsLayout(localLayout)) return false;

    return isTickerSuperset(localList.tickers, serverList.tickers);
  });
}

function localTickerOrderDiffersFromServer(
  local: WatchlistCollectionsSnapshot,
  server: WatchlistServerSnapshot,
): boolean {
  return local.lists.some((localList) => {
    const serverList = findServerCollectionForLocalList(localList, server);
    if (!serverList) return false;
    if (localList.tickers.length !== serverList.tickers.length) return false;
    return localList.tickers.some((ticker, index) => ticker !== serverList.tickers[index]);
  });
}

/** Apply the server snapshot but keep local display names (e.g. Main vs Watchlist). */
export function applyServerSnapshotPreservingLocalNames(
  server: WatchlistServerSnapshot,
  local: WatchlistCollectionsSnapshot,
  options?: { preferServerNames?: boolean },
): WatchlistCollectionsSnapshot {
  const activeLocalName = getActiveWatchlistCollection(local).name;
  const lists: WatchlistCollection[] = server.collections.map((serverCollection) => {
    const localList = local.lists.find((list) =>
      collectionNamesMatch(list.name, serverCollection.name),
    );
    const name =
      options?.preferServerNames || !localList
        ? serverCollection.name
        : localList.name;
    return {
      id: serverCollection.id,
      name,
      tickers:
        localList
          ? mergeListTickers(localList.tickers, serverCollection.tickers)
          : [...serverCollection.tickers],
      sections: [...serverCollection.sections],
      tickerSections: { ...serverCollection.tickerSections },
    };
  });

  for (const localList of local.lists) {
    if (lists.some((list) => collectionNamesMatch(list.name, localList.name))) continue;
    lists.push({
      id: localList.id,
      name: localList.name,
      tickers: [...localList.tickers],
      sections: [...localList.sections],
      tickerSections: { ...localList.tickerSections },
    });
  }

  const draft: WatchlistCollectionsSnapshot = {
    v: 2,
    activeId: "",
    lists,
    pendingRemoval: [],
  };
  const activeName = options?.preferServerNames
    ? (server.collections.find((collection) => collection.id === server.activeCollectionId)?.name ??
      activeLocalName)
    : activeLocalName;
  const activeId = findCollectionIdByName(draft, activeName) ?? lists[0]?.id ?? "";
  return clearDuplicateWatchlistTickerCopies(ensureSnapshotActiveId({ ...draft, activeId }));
}

/**
 * Download-only bootstrap: server tickers/lists are authoritative.
 * Local names may be preserved for display; local-only lists/tickers are not merged in.
 */
export function adoptCanonicalServerSnapshot(
  server: WatchlistServerSnapshot,
  local: WatchlistCollectionsSnapshot,
  options?: { preferServerNames?: boolean; preferPopulatedActive?: boolean },
): WatchlistCollectionsSnapshot {
  const activeLocalName = getActiveWatchlistCollection(local).name;
  const lists: WatchlistCollection[] = server.collections.map((serverCollection) => {
    const localList = local.lists.find((list) =>
      collectionNamesMatch(list.name, serverCollection.name),
    );
    const name =
      options?.preferServerNames || !localList
        ? serverCollection.name
        : localList.name;
    return {
      id: serverCollection.id,
      name,
      tickers: [...serverCollection.tickers],
      sections: [...serverCollection.sections],
      tickerSections: { ...serverCollection.tickerSections },
    };
  });

  const draft: WatchlistCollectionsSnapshot = {
    v: 2,
    activeId: "",
    lists,
    pendingRemoval: [],
  };
  const activeName = options?.preferServerNames
    ? (server.collections.find((collection) => collection.id === server.activeCollectionId)?.name ??
      activeLocalName)
    : activeLocalName;
  const activeId =
    findCollectionIdByName(draft, activeName) ??
    server.activeCollectionId ??
    lists[0]?.id ??
    "";

  let snapshot = clearDuplicateWatchlistTickerCopies(
    ensureSnapshotActiveId({ ...draft, activeId }),
  );
  if (options?.preferPopulatedActive) {
    snapshot = preferPopulatedActiveWatchlist(snapshot);
  }
  return snapshot;
}

function localHasRemovalsPendingSync(
  local: WatchlistCollectionsSnapshot,
  server: WatchlistServerSnapshot,
): boolean {
  let foundRemoval = false;

  for (const localList of local.lists) {
    const serverList = findServerCollectionForLocalList(localList, server);
    if (!serverList) continue;

    const localKeys = new Set(localList.tickers.map(normalizeWatchlistStorageKey));
    const serverKeys = serverList.tickers.map(normalizeWatchlistStorageKey);
    const serverKeySet = new Set(serverKeys);

    if (localList.tickers.some((ticker) => !serverKeySet.has(normalizeWatchlistStorageKey(ticker)))) {
      return false;
    }

    if (serverKeys.some((ticker) => !localKeys.has(ticker))) {
      foundRemoval = true;
    }

    const localLayout = {
      sections: localList.sections,
      tickerSections: localList.tickerSections,
    };
    const serverLayout = {
      sections: serverList.sections,
      tickerSections: serverList.tickerSections,
    };
    if (
      serverHasSectionsLayout(serverLayout) &&
      serverHasSectionsLayout(localLayout) &&
      !sectionsLayoutsEqual(localLayout, serverLayout)
    ) {
      return false;
    }
  }

  return foundRemoval;
}

/** True when local removed tickers that still exist on the server. */
export function localSnapshotHasRemovalsPendingSync(
  local: WatchlistCollectionsSnapshot,
  server: WatchlistServerSnapshot,
): boolean {
  return localHasRemovalsPendingSync(local, server);
}

/** Local edits not yet confirmed by a successful server sync. */
export function localHasUnsyncedChanges(local: WatchlistCollectionsSnapshot): boolean {
  return (local.lastModifiedAt ?? 0) > (local.lastSyncedAt ?? 0);
}

export function localSnapshotShouldUploadFirst(
  local: WatchlistCollectionsSnapshot,
  server: WatchlistServerSnapshot,
): boolean {
  if (shouldAdoptServerSnapshot(local, server)) return false;
  if (unionWatchlistTickers(local).length > 0 && serverSnapshotHasNoTickers(server)) {
    return true;
  }
  if (localHasUnsyncedChanges(local)) {
    if (
      localHasTickersAheadOfServer(local, server) &&
      !localHasTickersBehindServer(local, server)
    ) {
      return true;
    }
    if (serverChangedSinceLocalSync(local, server) && serverIsStrictlyNewerThanLocal(local, server)) {
      return false;
    }
    return true;
  }
  if (localHasRemovalsPendingSync(local, server)) return true;
  return localSnapshotNeedsServerUpload(local, server);
}

function localHasTickersBehindServer(
  local: WatchlistCollectionsSnapshot,
  server: WatchlistServerSnapshot,
): boolean {
  return local.lists.some((localList) => {
    const serverList = findServerCollectionForLocalList(localList, server);
    if (!serverList) return false;
    const localTickers = new Set(localList.tickers);
    return serverList.tickers.some((ticker) => !localTickers.has(ticker));
  });
}

export function serverSnapshotToCollections(
  server: WatchlistServerSnapshot,
  userId: string | null,
): WatchlistCollectionsSnapshot {
  return {
    v: 2,
    activeId: server.activeCollectionId,
    lists: server.collections.map((collection) => ({
      id: collection.id,
      name: collection.name,
      tickers: [...collection.tickers],
      sections: [...collection.sections],
      tickerSections: { ...collection.tickerSections },
    })),
    pendingRemoval: [],
  };
}

export function applyServerSnapshotToLocal(
  userId: string | null,
  server: WatchlistServerSnapshot,
): WatchlistCollectionsSnapshot {
  const snapshot = serverSnapshotToCollections(server, userId);
  writeWatchlistCollections(userId, snapshot);
  return snapshot;
}

export function hasClientOnlyWatchlistIds(snapshot: WatchlistCollectionsSnapshot): boolean {
  return snapshot.lists.some((list) => list.id.startsWith("wl_"));
}

export function findCollectionIdByName(
  snapshot: WatchlistCollectionsSnapshot,
  name: string,
): string | null {
  return snapshot.lists.find((list) => collectionNamesMatch(list.name, name))?.id ?? null;
}

/** Map server UUIDs onto local lists by name. Local defines membership — server-only lists are ignored. */
export function mergeServerIdsWithLocalSnapshot(
  server: WatchlistServerSnapshot,
  local: WatchlistCollectionsSnapshot,
  activeCollectionName: string,
  options?: { preferServerSections?: boolean; preferLocalTickers?: boolean },
): WatchlistCollectionsSnapshot | null {
  if (!local.lists.length) return null;

  const serverByName = new Map(
    server.collections.map((collection) => [collection.name.toLowerCase(), collection]),
  );

  const lists = local.lists.map((localList) => {
    const serverList =
      server.collections.find((collection) =>
        collectionNamesMatch(collection.name, localList.name),
      ) ?? serverByName.get(localList.name.toLowerCase());
    const localLayout = {
      sections: localList.sections,
      tickerSections: localList.tickerSections,
    };
    const serverLayout = serverList
      ? { sections: serverList.sections, tickerSections: serverList.tickerSections }
      : emptyWatchlistSectionLayout();
    const layout =
      options?.preferServerSections && serverHasSectionsLayout(serverLayout)
        ? serverLayout
        : !serverHasSectionsLayout(localLayout) && serverHasSectionsLayout(serverLayout)
          ? serverLayout
          : localLayout;

    return {
      id: serverList?.id ?? localList.id,
      name: localList.name,
      tickers:
        options?.preferLocalTickers
          ? [...localList.tickers]
          : mergeListTickers(localList.tickers, serverList?.tickers ?? []),
      sections: [...layout.sections],
      tickerSections: { ...layout.tickerSections },
    };
  });

  for (const serverList of server.collections) {
    if (lists.some((list) => collectionNamesMatch(list.name, serverList.name))) continue;
    lists.push({
      id: serverList.id,
      name: serverList.name,
      tickers: [...serverList.tickers],
      sections: [...serverList.sections],
      tickerSections: { ...serverList.tickerSections },
    });
  }

  const draft: WatchlistCollectionsSnapshot = {
    v: 2,
    activeId: "",
    lists,
    pendingRemoval: [],
  };
  const activeId =
    findCollectionIdByName(draft, activeCollectionName) ?? lists[0]?.id ?? null;
  if (!activeId) return null;

  return { ...draft, activeId };
}

function localHasTickersAheadOfServer(
  local: WatchlistCollectionsSnapshot,
  server: WatchlistServerSnapshot,
): boolean {
  return local.lists.some((localList) => {
    const serverList = findServerCollectionForLocalList(localList, server);
    if (!serverList) return localList.tickers.length > 0;
    const serverTickers = new Set(serverList.tickers.map(normalizeWatchlistStorageKey));
    return localList.tickers.some(
      (ticker) => !serverTickers.has(normalizeWatchlistStorageKey(ticker)),
    );
  });
}

/** True when local still has tickers that have not reached the server yet. */
export function localSnapshotHasTickersAheadOfServer(
  local: WatchlistCollectionsSnapshot,
  server: WatchlistServerSnapshot,
): boolean {
  return localHasTickersAheadOfServer(local, server);
}

function tickerSetsEqual(a: string[], b: string[]): boolean {
  const left = new Set(a);
  const right = new Set(b);
  if (left.size !== right.size) return false;
  for (const ticker of left) {
    if (!right.has(ticker)) return false;
  }
  return true;
}

export function serverUpdatedAtMs(server: WatchlistServerSnapshot): number {
  const raw = server.updatedAt;
  if (typeof raw !== "string" || !raw) return 0;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function localTickerMembershipMatchesServer(
  local: WatchlistCollectionsSnapshot,
  server: WatchlistServerSnapshot,
): boolean {
  if (local.lists.length !== server.collections.length) return false;
  for (const localList of local.lists) {
    const serverList = findServerCollectionForLocalList(localList, server);
    if (!serverList) return false;
    if (!tickerSetsEqual(localList.tickers, serverList.tickers)) return false;
  }
  return true;
}

function serverChangedSinceLocalSync(
  local: WatchlistCollectionsSnapshot,
  server: WatchlistServerSnapshot,
): boolean {
  const serverTime = serverUpdatedAtMs(server);
  if (serverTime <= 0) return false;
  return serverTime > (local.lastSyncedAt ?? 0);
}

function localIsNewerThanServer(
  local: WatchlistCollectionsSnapshot,
  server: WatchlistServerSnapshot,
): boolean {
  const serverTime = serverUpdatedAtMs(server);
  const localTime = local.lastModifiedAt ?? 0;
  if (serverTime <= 0) return localTime > 0;
  return localTime > serverTime;
}

function serverIsStrictlyNewerThanLocal(
  local: WatchlistCollectionsSnapshot,
  server: WatchlistServerSnapshot,
): boolean {
  const serverTime = serverUpdatedAtMs(server);
  const localTime = local.lastModifiedAt ?? 0;
  if (serverTime <= 0) return false;
  return serverTime > localTime;
}

export function localListsHaveDistinctTickerSets(local: WatchlistCollectionsSnapshot): boolean {
  const signatures = local.lists.map((list) => [...list.tickers].sort().join("|"));
  return new Set(signatures).size > 1;
}

function serverListsHaveDuplicateTickerSets(server: WatchlistServerSnapshot): boolean {
  const signatures = server.collections
    .map((collection) => [...collection.tickers].sort().join("|"))
    .filter((signature) => signature.length > 0);
  return signatures.length > 1 && new Set(signatures).size < signatures.length;
}

export function serverSnapshotHasAccidentalDuplicates(server: WatchlistServerSnapshot): boolean {
  return serverListsHaveDuplicateTickerSets(server);
}

function localSnapshotIsReady(local: WatchlistCollectionsSnapshot): boolean {
  return local.lists.length > 0 && !isPlaceholderWatchlistId(local.activeId);
}

/** Merge server ids/sections with local + server tickers (union per list). */
export function mergeServerWithLocalSnapshot(
  server: WatchlistServerSnapshot,
  local: WatchlistCollectionsSnapshot,
): WatchlistCollectionsSnapshot {
  if (!localSnapshotIsReady(local)) {
    return clearDuplicateWatchlistTickerCopies(serverSnapshotToCollections(server, null));
  }
  if (shouldAdoptServerSnapshot(local, server)) {
    return applyServerSnapshotPreservingLocalNames(server, local, { preferServerNames: true });
  }
  const activeName = getActiveWatchlistCollection(local).name;
  const merged = mergeServerIdsWithLocalSnapshot(server, local, activeName, {
    preferLocalTickers: true,
  });
  return clearDuplicateWatchlistTickerCopies(ensureSnapshotActiveId(merged ?? local));
}

/** Server has a curated layout this device has not received yet. */
export function localIsMissingServerSections(
  local: WatchlistCollectionsSnapshot,
  server: WatchlistServerSnapshot,
): boolean {
  return server.collections.some((serverList) => {
    const serverLayout = {
      sections: serverList.sections,
      tickerSections: serverList.tickerSections,
    };
    if (!serverHasSectionsLayout(serverLayout)) return false;

    const localList = local.lists.find((list) =>
      collectionNamesMatch(list.name, serverList.name),
    );
    if (!localList) return true;

    const localLayout = {
      sections: localList.sections,
      tickerSections: localList.tickerSections,
    };
    return !serverHasSectionsLayout(localLayout);
  });
}

export function serverSnapshotHasNoTickers(server: WatchlistServerSnapshot): boolean {
  return !server.collections.some((collection) => collection.tickers.length > 0);
}

export function serverSnapshotContainsTicker(
  server: WatchlistServerSnapshot,
  ticker: string,
): boolean {
  const key = normalizeWatchlistStorageKey(ticker);
  return server.collections.some((collection) =>
    collection.tickers.some((entry) => normalizeWatchlistStorageKey(entry) === key),
  );
}

/** Prefer the server snapshot instead of uploading stale browser cache. */
export function shouldAdoptServerSnapshot(
  local: WatchlistCollectionsSnapshot,
  server: WatchlistServerSnapshot,
): boolean {
  if (localHasRemovalsPendingSync(local, server)) return false;

  // Never stomp local additions that have not reached the server yet.
  if (localHasTickersAheadOfServer(local, server)) return false;

  // Never replace a populated local watchlist with an empty server snapshot.
  if (unionWatchlistTickers(local).length > 0 && serverSnapshotHasNoTickers(server)) {
    return false;
  }

  if (
    !localHasUnsyncedChanges(local) &&
    !localTickerMembershipMatchesServer(local, server)
  ) {
    return true;
  }

  if (localHasUnsyncedChanges(local)) {
    if (
      localHasTickersAheadOfServer(local, server) &&
      !localHasTickersBehindServer(local, server)
    ) {
      return false;
    }
    if (
      serverChangedSinceLocalSync(local, server) &&
      serverIsStrictlyNewerThanLocal(local, server)
    ) {
      return true;
    }
    return false;
  }
  if (localIsStaleSupersetOfServer(local, server)) return true;
  if (localIsMissingServerSections(local, server)) return true;
  if (
    localSnapshotHasNoTickers(local) &&
    server.collections.some((collection) => collection.tickers.length > 0)
  ) {
    return true;
  }
  if (local.lists.length < server.collections.length) return true;
  if (
    localHasTickersBehindServer(local, server) &&
    !localHasTickersAheadOfServer(local, server)
  ) {
    return true;
  }
  return false;
}

function localSnapshotHasNoTickers(local: WatchlistCollectionsSnapshot): boolean {
  return unionWatchlistTickers(local).length === 0;
}

export function applyServerSnapshotMergingLocal(
  server: WatchlistServerSnapshot,
  local: WatchlistCollectionsSnapshot,
  userId: string | null,
): WatchlistCollectionsSnapshot {
  void userId;
  return mergeServerWithLocalSnapshot(server, local);
}

function localHasSectionsAheadOfServer(
  local: WatchlistCollectionsSnapshot,
  server: WatchlistServerSnapshot,
): boolean {
  return local.lists.some((localList) => {
    const localLayout = {
      sections: localList.sections,
      tickerSections: localList.tickerSections,
    };
    if (!serverHasSectionsLayout(localLayout)) return false;

    const serverList = findServerCollectionForLocalList(localList, server);
    if (!serverList) return true;

    const serverLayout = {
      sections: serverList.sections,
      tickerSections: serverList.tickerSections,
    };
    return !sectionsLayoutsEqual(localLayout, serverLayout);
  });
}

export function localSnapshotNeedsServerUpload(
  local: WatchlistCollectionsSnapshot,
  server: WatchlistServerSnapshot,
): boolean {
  if (shouldAdoptServerSnapshot(local, server)) return false;
  if (unionWatchlistTickers(local).length > 0 && serverSnapshotHasNoTickers(server)) {
    return true;
  }
  if (localHasUnsyncedChanges(local)) return true;
  if (localHasRemovalsPendingSync(local, server)) return true;
  if (serverListsHaveDuplicateTickerSets(server)) return true;
  if (local.lists.length !== server.collections.length) return true;
  if (hasClientOnlyWatchlistIds(local)) return true;
  if (localHasTickersBehindServer(local, server)) return true;
  if (localHasSectionsAheadOfServer(local, server)) return true;
  if (localTickerOrderDiffersFromServer(local, server)) return true;
  if (localListsHaveDistinctTickerSets(local) && serverListsHaveDuplicateTickerSets(server)) {
    return true;
  }

  let perListMismatch = false;

  for (const localList of local.lists) {
    const serverList = findServerCollectionForLocalList(localList, server);
    if (!serverList) return true;
    if (!tickerSetsEqual(localList.tickers, serverList.tickers)) {
      perListMismatch = true;
    }
  }

  if (perListMismatch) {
    if (
      !localHasUnsyncedChanges(local) &&
      localHasTickersAheadOfServer(local, server) &&
      !localHasTickersBehindServer(local, server) &&
      !serverSnapshotHasNoTickers(server)
    ) {
      return false;
    }
    return (
      localListsHaveDistinctTickerSets(local) ||
      localHasTickersAheadOfServer(local, server) ||
      localHasTickersBehindServer(local, server)
    );
  }

  const serverUnion = new Set(server.collections.flatMap((c) => c.tickers));
  const localUnion = new Set(local.lists.flatMap((l) => l.tickers));
  if (localUnion.size > serverUnion.size) return localHasUnsyncedChanges(local);

  for (const ticker of localUnion) {
    if (!serverUnion.has(ticker)) return localHasUnsyncedChanges(local);
  }
  if (localHasSectionsAheadOfServer(local, server)) return true;
  return false;
}

/** Trust server snapshot after a successful sync (server reflects what we just wrote). */
export function applySyncedServerSnapshot(
  server: WatchlistServerSnapshot,
): WatchlistCollectionsSnapshot {
  return clearDuplicateWatchlistTickerCopies(
    ensureSnapshotActiveId(serverSnapshotToCollections(server, null)),
  );
}

/** After add/remove: map server ids onto the optimistic local snapshot. */
export function applyMutationServerResponse(
  server: WatchlistServerSnapshot,
  local: WatchlistCollectionsSnapshot,
): WatchlistCollectionsSnapshot {
  const activeName = getActiveWatchlistCollection(local).name;
  const merged = mergeServerIdsWithLocalSnapshot(server, local, activeName, {
    preferServerSections: true,
    preferLocalTickers: true,
  });
  return clearDuplicateWatchlistTickerCopies(ensureSnapshotActiveId(merged ?? local));
}

/** Like applyMutationServerResponse but keeps local marked unsynced when server is still behind. */
export function applyMutationServerResponseWithSyncMeta(
  server: WatchlistServerSnapshot,
  local: WatchlistCollectionsSnapshot,
): WatchlistCollectionsSnapshot {
  const merged = applyMutationServerResponse(server, local);
  const now = Date.now();
  const serverTime = serverUpdatedAtMs(server);
  const syncedAt = serverTime > 0 ? serverTime : now;

  if (localSnapshotHasTickersAheadOfServer(merged, server)) {
    const priorSynced = merged.lastSyncedAt ?? 0;
    return {
      ...merged,
      lastModifiedAt: Math.max(merged.lastModifiedAt ?? 0, now),
      lastSyncedAt: priorSynced,
    };
  }

  if (localSnapshotHasRemovalsPendingSync(merged, server)) {
    const priorSynced = merged.lastSyncedAt ?? 0;
    return {
      ...merged,
      lastModifiedAt: Math.max(merged.lastModifiedAt ?? 0, now),
      lastSyncedAt: priorSynced,
    };
  }

  return {
    ...merged,
    lastSyncedAt: syncedAt,
    lastModifiedAt: Math.max(merged.lastModifiedAt ?? 0, syncedAt),
  };
}

/** After a successful upload: keep the live local layout, only adopt server collection ids. */
export function applyServerIdsPreservingLocalLayout(
  server: WatchlistServerSnapshot,
  local: WatchlistCollectionsSnapshot,
): WatchlistCollectionsSnapshot {
  const activeName = getActiveWatchlistCollection(local).name;
  const merged = mergeServerIdsWithLocalSnapshot(server, local, activeName, {
    preferLocalTickers: true,
  });
  return clearDuplicateWatchlistTickerCopies(ensureSnapshotActiveId(merged ?? local));
}

export function watchlistSyncPayloadsEqual(
  a: WatchlistCollectionsSnapshot,
  b: WatchlistCollectionsSnapshot,
): boolean {
  return (
    JSON.stringify(localSnapshotToSyncInput(a)) === JSON.stringify(localSnapshotToSyncInput(b))
  );
}

export function localSnapshotToSyncInput(
  local: WatchlistCollectionsSnapshot,
): { collections: WatchlistSyncCollectionInput[]; activeName: string } {
  const active = local.lists.find((l) => l.id === local.activeId) ?? local.lists[0];
  return {
    collections: local.lists.map((list) => ({
      name: list.name,
      tickers: [...list.tickers],
      sections: [...list.sections],
      tickerSections: { ...list.tickerSections },
    })),
    activeName: active?.name ?? "Watchlist",
  };
}

/** Include server-only collections so sync does not try to delete saved lists. */
export function localSnapshotToSyncInputWithServer(
  local: WatchlistCollectionsSnapshot,
  server?: WatchlistServerSnapshot | null,
): { collections: WatchlistSyncCollectionInput[]; activeName: string } {
  const base = localSnapshotToSyncInput(local);
  if (!server?.collections.length) return base;

  const collections = base.collections.map((entry) => ({
    ...entry,
    tickers: [...entry.tickers],
    sections: [...(entry.sections ?? [])],
    tickerSections: { ...(entry.tickerSections ?? {}) },
  }));

  for (const serverCollection of server.collections) {
    const existing = collections.find((entry) =>
      collectionNamesMatch(entry.name, serverCollection.name),
    );
    if (!existing) {
      collections.push({
        name: serverCollection.name,
        tickers: [...serverCollection.tickers],
        sections: [...serverCollection.sections],
        tickerSections: { ...serverCollection.tickerSections },
      });
      continue;
    }

    const localTickers = new Set(existing.tickers);
    for (const ticker of serverCollection.tickers) {
      if (!localTickers.has(ticker)) existing.tickers.push(ticker);
    }
  }

  return { collections, activeName: base.activeName };
}
