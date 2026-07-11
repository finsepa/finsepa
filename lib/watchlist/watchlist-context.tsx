"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { toastWatchlistCreated } from "@/lib/watchlist/watchlist-created-toast";
import {
  toastWatchlistAddFailed,
  toastWatchlistAdded,
  toastWatchlistNotReady,
  toastWatchlistRemoveFailed,
  toastWatchlistRemoved,
  toastWatchlistSyncFailed,
} from "@/lib/watchlist/watchlist-mutation-toast";
import type { User } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { readSupabaseSession } from "@/lib/supabase/safe-auth";
import {
  addTickerToSnapshot,
  clearDuplicateWatchlistTickerCopies,
  cloneWatchlistCollectionsSnapshot,
  addSectionToCollection,
  applyWatchlistItemMove,
  createDefaultWatchlistCollectionsSnapshot,
  deleteSectionFromCollection,
  ensureSnapshotActiveId,
  getActiveWatchlistCollection,
  isPlaceholderWatchlistId,
  isServerWatchlistCollectionId,
  loadAuthenticatedWatchlistCollections,
  mergeGuestWatchlistOnSignIn,
  moveSectionInCollection,
  moveTickerInCollection,
  newWatchlistCollectionId,
  clearGuestWatchlistStorage,
  persistActiveListTickers,
  preferPopulatedActiveWatchlist,
  prepareWatchlistSwitch,
  readWatchlistCollections,
  renameCollectionInSnapshot,
  renameSectionInCollection,
  removeTickerFromAllInSnapshot,
  removeTickerFromSnapshot,
  resolveWatchlistCollectionId,
  unionWatchlistTickers,
  writeWatchlistCollections,
  type WatchlistCollection,
  type WatchlistCollectionsSnapshot,
  type WatchlistSection,
} from "@/lib/watchlist/collections";
import { collectionNamesMatch } from "@/lib/watchlist/collection-names";
import { sectionNamesMatch } from "@/lib/watchlist/sections";
import type { WatchlistDropTarget } from "@/lib/watchlist/watchlist-drag";
import { WATCHLIST_MUTATED_EVENT } from "@/lib/watchlist/constants";
import {
  deleteWatchlistCollectionOnClient,
  deleteWatchlistTicker,
  fetchWatchlistSnapshot,
  findServerCollectionIdByName,
  postWatchlistTicker,
  refreshWatchlistSnapshotFromServer,
  renameWatchlistOnServer,
  resetNewAccountWatchlistOnServer,
  resolveServerCollectionId,
  setActiveWatchlistOnServer,
  syncWatchlistCollectionsToServer,
} from "@/lib/watchlist/fetch-watchlist-api";
import {
  clearGuestWatchlistPendingMerge,
  consumeGuestWatchlistPendingMerge,
  markGuestWatchlistPendingMerge,
} from "@/lib/watchlist/guest-merge";
import {
  isNewAccountWatchlistResetDone,
  isUserWithinWatchlistResetWindow,
  markNewAccountWatchlistResetDone,
  shouldRunNewAccountWatchlistReset,
} from "@/lib/watchlist/new-account-reset";
import { writeWatchlistLocal } from "@/lib/watchlist/local-storage";
import {
  isWatchlistTickerWatched,
  normalizeWatchlistStorageKey,
} from "@/lib/watchlist/normalize-storage-key";
import { logWatchlistSync } from "@/lib/watchlist/sync-debug";
import {
  applyMutationServerResponse,
  adoptCanonicalServerSnapshot,
  findCollectionIdByName,
  hasClientOnlyWatchlistIds,
  mergeServerIdsWithLocalSnapshot,
  serverSnapshotContainsTicker,
  serverSnapshotToCollections,
  watchlistSyncPayloadsEqual,
} from "@/lib/watchlist/snapshot";
import { clearWatchlistEnrichedCache } from "@/lib/watchlist/watchlist-enriched-cache";
import type { WatchlistServerSnapshot } from "@/lib/watchlist/types";

function normalizeTicker(t: string): string {
  return normalizeWatchlistStorageKey(t);
}

function dispatchWatchlistMutated(ticker = "") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(WATCHLIST_MUTATED_EVENT, { detail: { ticker } }));
}

type BootstrapOptions = {
  /** Merge guest local storage into the signed-in user (sign-in only). */
  mergeGuest?: boolean;
};

type WatchlistContextValue = {
  watched: Set<string>;
  watchedTickers: string[];
  watchedUnion: Set<string>;
  loaded: boolean;
  toggleTicker: (storageKey: string, watchlistId?: string) => void;
  removeFromActiveWatchlist: (storageKey: string) => void;
  reorderActiveWatchlist: (fromIndex: number, toIndex: number) => void;
  moveActiveWatchlistItem: (fromIndex: number, target: WatchlistDropTarget) => void;
  deleteActiveWatchlist: () => Promise<void>;
  createWatchlist: (name: string) => void;
  createActiveSection: (name: string) => void;
  renameActiveSection: (sectionId: string, name: string) => void;
  deleteActiveSection: (sectionId: string) => void;
  reorderActiveSection: (fromSectionIndex: number, toSectionIndex: number) => void;
  renameActiveWatchlist: (name: string) => void;
  switchWatchlist: (id: string) => void;
  watchlists: WatchlistCollection[];
  activeWatchlistId: string;
  activeWatchlistName: string;
  activeSections: WatchlistSection[];
  activeTickerSections: Record<string, string>;
  serverListWarning: string | null;
  storageHydrated: boolean;
};

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const [watched, setWatched] = useState<Set<string>>(() => new Set());
  const [watchedTickers, setWatchedTickers] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [serverListWarning, setServerListWarning] = useState<string | null>(null);
  const [collections, setCollections] = useState<WatchlistCollectionsSnapshot>(
    createDefaultWatchlistCollectionsSnapshot,
  );

  const userIdRef = useRef<string | null>(null);
  userIdRef.current = userId;

  const collectionsRef = useRef(collections);
  collectionsRef.current = collections;

  const serverSyncChainRef = useRef(Promise.resolve());
  const bootstrapChainRef = useRef(Promise.resolve());
  const mutationChainRef = useRef(Promise.resolve());
  const syncDirtyRef = useRef(false);
  const syncInFlightRef = useRef<Promise<boolean> | null>(null);
  const syncErrorToastedRef = useRef(false);

  const hydratedRef = useRef(hydrated);
  hydratedRef.current = hydrated;

  const watchedUnion = useMemo(
    () => new Set(unionWatchlistTickers(collections).map(normalizeTicker)),
    [collections],
  );

  const notifyWatchlistSyncFailed = useCallback(() => {
    if (syncErrorToastedRef.current) return;
    syncErrorToastedRef.current = true;
    toastWatchlistSyncFailed();
  }, []);

  const waitForPendingWatchlistWork = useCallback(async () => {
    await mutationChainRef.current.catch(() => undefined);
    await serverSyncChainRef.current.catch(() => undefined);
  }, []);

  const enqueueWatchlistMutation = useCallback(
    (task: () => Promise<boolean>): Promise<boolean> => {
      const run = mutationChainRef.current.then(task, task);
      mutationChainRef.current = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
    [],
  );

  const applyCollections = useCallback(
    (
      snapshot: WatchlistCollectionsSnapshot,
      options?: {
        /** Set after the snapshot matches what was persisted on the server. */
        fromServerSync?: boolean;
        serverUpdatedAt?: string | null;
        /** Login/bootstrap only: show a populated list when server active is empty. */
        preferPopulatedActive?: boolean;
      },
    ) => {
      const now = Date.now();
      const aligned = ensureSnapshotActiveId(snapshot);
      const repaired = clearDuplicateWatchlistTickerCopies(aligned);
      const beforeActiveId = repaired.activeId;
      const withActive =
        options?.preferPopulatedActive ? preferPopulatedActiveWatchlist(repaired) : repaired;
      const activeRepointed =
        options?.preferPopulatedActive &&
        withActive.activeId !== beforeActiveId &&
        withActive.lists.some((list) => list.id === withActive.activeId);
      const syncedAt =
        options?.fromServerSync ?
          (() => {
            const serverTime =
              options.serverUpdatedAt ?
                Date.parse(options.serverUpdatedAt)
              : 0;
            return !Number.isNaN(serverTime) && serverTime > 0 ? serverTime : now;
          })()
        : null;
      const withSyncMeta: WatchlistCollectionsSnapshot = options?.fromServerSync
        ? {
            ...withActive,
            lastSyncedAt:
              typeof withActive.lastSyncedAt === "number" ? withActive.lastSyncedAt : (syncedAt ?? now),
            lastModifiedAt:
              typeof withActive.lastModifiedAt === "number"
                ? withActive.lastModifiedAt
                : Math.max(withActive.lastModifiedAt ?? now, syncedAt ?? now),
          }
        : {
            ...withActive,
            lastModifiedAt: now,
            lastSyncedAt: withActive.lastSyncedAt,
          };
      const active = getActiveWatchlistCollection(withSyncMeta);
      const orderedTickers = active.tickers.map(normalizeTicker);
      setCollections(withSyncMeta);
      setWatchedTickers(orderedTickers);
      setWatched(new Set(orderedTickers));
      writeWatchlistCollections(userIdRef.current, withSyncMeta);
      if (
        activeRepointed &&
        userIdRef.current &&
        isServerWatchlistCollectionId(withActive.activeId)
      ) {
        void setActiveWatchlistOnServer(withActive.activeId);
      }
      if (!userIdRef.current && unionWatchlistTickers(withSyncMeta).length > 0) {
        markGuestWatchlistPendingMerge();
      }
      if (userIdRef.current) {
        clearGuestWatchlistStorage(userIdRef.current);
      }
      writeWatchlistLocal(active.tickers, userIdRef.current, []);
    },
    [],
  );

  const adoptServerCanonical = useCallback(
    (
      serverSnapshot: WatchlistServerSnapshot,
      options?: { preferPopulatedActive?: boolean },
    ) => {
      applyCollections(
        adoptCanonicalServerSnapshot(serverSnapshot, collectionsRef.current, {
          preferServerNames: true,
          preferPopulatedActive: options?.preferPopulatedActive ?? true,
        }),
        { fromServerSync: true, serverUpdatedAt: serverSnapshot.updatedAt },
      );
    },
    [applyCollections],
  );

  /**
   * Full replacement sync — session layout/collection helpers only (not login/logout/bootstrap).
   * @deprecated Prefer explicit POST/DELETE/collection endpoints for user mutations.
   */
  const persistSnapshotToServer = useCallback(
    async (_snapshot?: WatchlistCollectionsSnapshot): Promise<boolean> => {
      void _snapshot;
      if (!userIdRef.current) return false;

      syncDirtyRef.current = true;
      const existing = syncInFlightRef.current;
      if (existing) return existing;

      const task = (async (): Promise<boolean> => {
        await serverSyncChainRef.current;
        let lastOk = false;
        while (syncDirtyRef.current) {
          syncDirtyRef.current = false;
          const snapshotToSync = collectionsRef.current;
          const uploaded = await syncWatchlistCollectionsToServer(snapshotToSync);
          if (!uploaded) {
            if (unionWatchlistTickers(collectionsRef.current).length > 0) {
              setServerListWarning(
                "Watchlist saved on this device only — server refused a sync that would erase saved tickers.",
              );
              notifyWatchlistSyncFailed();
            }
            return false;
          }

          const fresh = await refreshWatchlistSnapshotFromServer();
          if (fresh) {
            adoptServerCanonical(fresh, { preferPopulatedActive: false });
          }
          lastOk = true;

          if (!watchlistSyncPayloadsEqual(collectionsRef.current, snapshotToSync)) {
            syncDirtyRef.current = true;
          }
        }
        setServerListWarning(null);
        return lastOk;
      })().finally(() => {
        syncInFlightRef.current = null;
        if (syncDirtyRef.current) {
          void persistSnapshotToServer();
        }
      });

      syncInFlightRef.current = task;
      serverSyncChainRef.current = task.then(
        () => undefined,
        () => undefined,
      );
      return task;
    },
    [adoptServerCanonical, notifyWatchlistSyncFailed],
  );

  const applyFreshServerState = useCallback(async (): Promise<boolean> => {
    const snapshot = await refreshWatchlistSnapshotFromServer();
    if (!snapshot) return false;
    adoptServerCanonical(snapshot, { preferPopulatedActive: false });
    return true;
  }, [adoptServerCanonical]);

  const resolveServerCollectionIdForList = useCallback(
    async (
      local: WatchlistCollectionsSnapshot,
      collectionId: string,
      collectionName: string,
    ): Promise<string | null> => {
      const serverSnapshot = await refreshWatchlistSnapshotFromServer();
      let serverCollectionId = isServerWatchlistCollectionId(collectionId)
        ? collectionId
        : findServerCollectionIdByName(serverSnapshot, collectionName);

      if (!serverCollectionId) {
        serverCollectionId = await resolveServerCollectionId(local, collectionId, collectionName);
      }

      return serverCollectionId && isServerWatchlistCollectionId(serverCollectionId)
        ? serverCollectionId
        : null;
    },
    [],
  );

  const refreshFromServer = useCallback(async () => {
    const snapshot = await refreshWatchlistSnapshotFromServer();
    if (!snapshot) return null;
    adoptServerCanonical(snapshot);
    return snapshot;
  }, [adoptServerCanonical]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let cancelled = false;

    async function bootstrap(
      uid: string | null,
      options: BootstrapOptions = {},
      authUser?: User | null,
    ) {
      setUserId(uid);

      if (!uid) {
        applyCollections(readWatchlistCollections(null));
        setHydrated(true);
        setLoaded(true);
        return;
      }

      const local = options.mergeGuest
        ? mergeGuestWatchlistOnSignIn(uid)
        : loadAuthenticatedWatchlistCollections(uid);
      const working = clearDuplicateWatchlistTickerCopies(local);
      const activeEmptyButHasTickers =
        unionWatchlistTickers(working).length > 0 &&
        getActiveWatchlistCollection(working).tickers.length === 0;
      logWatchlistSync("bootstrap_cache_display");
      applyCollections(working, { preferPopulatedActive: activeEmptyButHasTickers });
      setHydrated(true);
      setLoaded(true);

      try {
        await waitForPendingWatchlistWork();
        const { snapshot, warning } = await fetchWatchlistSnapshot();
        if (cancelled) return;

        if (warning === "db_unavailable") {
          logWatchlistSync("bootstrap_db_unavailable");
          setServerListWarning("Watchlist temporarily unavailable");
          return;
        }

        if (!snapshot) {
          logWatchlistSync("bootstrap_server_fetch_miss");
          setServerListWarning(null);
          return;
        }

        let serverSnapshot = snapshot;

        if (
          authUser &&
          isUserWithinWatchlistResetWindow(authUser) &&
          !options.mergeGuest &&
          !isNewAccountWatchlistResetDone(uid)
        ) {
          if (shouldRunNewAccountWatchlistReset(authUser, uid, options, working, serverSnapshot)) {
            const cleared = await resetNewAccountWatchlistOnServer();
            markNewAccountWatchlistResetDone(uid);
            clearGuestWatchlistStorage(uid);
            if (cleared) {
              setServerListWarning(null);
              applyCollections(serverSnapshotToCollections(cleared, uid));
              return;
            }
          } else {
            markNewAccountWatchlistResetDone(uid);
          }
        }

        logWatchlistSync("bootstrap_server_canonical_adopt");
        adoptServerCanonical(serverSnapshot);
        setServerListWarning(null);
        clearGuestWatchlistStorage(uid);

        if (options.mergeGuest) {
          const guestTickers = unionWatchlistTickers(working);
          for (const storageKey of guestTickers) {
            const ticker = normalizeTicker(storageKey);
            if (serverSnapshotContainsTicker(serverSnapshot, ticker)) continue;
            const active = getActiveWatchlistCollection(collectionsRef.current);
            const serverCollectionId = await resolveServerCollectionIdForList(
              collectionsRef.current,
              active.id,
              active.name,
            );
            if (!serverCollectionId) continue;
            logWatchlistSync("mutation_start", "guest_merge_add");
            const posted = await postWatchlistTicker(ticker, serverCollectionId);
            if (posted) {
              logWatchlistSync("mutation_success", "guest_merge_add");
            } else {
              logWatchlistSync("mutation_failure", "guest_merge_add");
            }
          }
          await applyFreshServerState();
        }
      } catch {
        if (!cancelled) {
          setServerListWarning(null);
        }
      } finally {
        if (!cancelled) {
          setHydrated(true);
          setLoaded(true);
        }
      }
    }

    void (async () => {
      try {
        const session = await readSupabaseSession(supabase);
        if (cancelled) return;
        const uid = session?.user?.id ?? null;
        bootstrapChainRef.current = bootstrapChainRef.current
          .then(() => bootstrap(uid, {}, session?.user ?? null))
          .catch(() => undefined);
        await bootstrapChainRef.current;
      } catch {
        if (!cancelled) {
          bootstrapChainRef.current = bootstrapChainRef.current
            .then(() => bootstrap(null, {}, null))
            .catch(() => undefined);
          await bootstrapChainRef.current;
        }
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      const uid = nextSession?.user?.id ?? null;
      if (event === "SIGNED_IN" && uid) {
        const mergeGuest = consumeGuestWatchlistPendingMerge();
        bootstrapChainRef.current = bootstrapChainRef.current
          .then(() => bootstrap(uid, { mergeGuest }, nextSession?.user ?? null))
          .catch(() => undefined);
        void bootstrapChainRef.current;
      } else if (event === "SIGNED_OUT") {
        void (async () => {
          await waitForPendingWatchlistWork();
          clearGuestWatchlistPendingMerge();
          clearGuestWatchlistStorage();
          setUserId(null);
          applyCollections(readWatchlistCollections(null));
          setHydrated(true);
          setLoaded(true);
        })();
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [adoptServerCanonical, applyCollections, applyFreshServerState, notifyWatchlistSyncFailed, resolveServerCollectionIdForList, waitForPendingWatchlistWork]);

  const addToWatchlist = useCallback(
    (storageKey: string, watchlistId: string) => {
      if (!hydratedRef.current) {
        toastWatchlistNotReady();
        return;
      }
      if (isPlaceholderWatchlistId(watchlistId)) {
        toastWatchlistAddFailed();
        return;
      }

      const ticker = normalizeTicker(storageKey);
      const current = collectionsRef.current;
      const resolvedId = resolveWatchlistCollectionId(current, watchlistId);
      if (!resolvedId) {
        toastWatchlistAddFailed();
        return;
      }

      const targetList =
        current.lists.find((list) => list.id === resolvedId) ??
        getActiveWatchlistCollection(current);

      const snapshot = addTickerToSnapshot(current, resolvedId, storageKey);
      if (!snapshot) {
        toastWatchlistAddFailed();
        return;
      }

      const previous = cloneWatchlistCollectionsSnapshot(current);
      const withActiveTarget =
        snapshot.activeId === resolvedId ? snapshot : { ...snapshot, activeId: resolvedId };
      applyCollections(withActiveTarget);
      dispatchWatchlistMutated(ticker);

      if (!userIdRef.current) {
        toastWatchlistAdded(storageKey, targetList.name);
        return;
      }

      void enqueueWatchlistMutation(async () => {
        logWatchlistSync("mutation_start", "add");
        const serverCollectionId = await resolveServerCollectionIdForList(
          collectionsRef.current,
          resolvedId,
          targetList.name,
        );

        if (serverCollectionId) {
          const posted = await postWatchlistTicker(ticker, serverCollectionId);
          if (posted) {
            if (withActiveTarget.activeId === resolvedId) {
              await setActiveWatchlistOnServer(serverCollectionId);
            }
            await applyFreshServerState();
            logWatchlistSync("mutation_success", "add");
            toastWatchlistAdded(storageKey, targetList.name);
            setServerListWarning(null);
            dispatchWatchlistMutated(ticker);
            return true;
          }
        }

        logWatchlistSync("mutation_failure", "add");
        applyCollections(previous);
        toastWatchlistAddFailed();
        setServerListWarning("Could not save to your account. Try again.");
        dispatchWatchlistMutated(ticker);
        return false;
      });
    },
    [
      applyCollections,
      applyFreshServerState,
      enqueueWatchlistMutation,
      resolveServerCollectionIdForList,
    ],
  );

  const applyOptimisticRemove = useCallback(
    (storageKey: string, scope: "active" | "all"): boolean => {
      const current = collectionsRef.current;
      let snapshot: WatchlistCollectionsSnapshot | null;

      if (scope === "active") {
        const activeId = getActiveWatchlistCollection(current).id;
        snapshot = removeTickerFromSnapshot(current, activeId, storageKey);
        if (!snapshot) {
          const resolvedId = resolveWatchlistCollectionId(current, current.activeId);
          if (resolvedId) {
            snapshot = removeTickerFromSnapshot(current, resolvedId, storageKey);
          }
        }
      } else {
        snapshot = removeTickerFromAllInSnapshot(current, storageKey);
      }

      if (!snapshot) return false;
      applyCollections(snapshot);
      return true;
    },
    [applyCollections],
  );

  const removeFromWatchlist = useCallback(
    (storageKey: string, scope: "active" | "all") => {
      if (!hydratedRef.current) {
        toastWatchlistNotReady();
        return;
      }

      const ticker = normalizeTicker(storageKey);
      const previous = cloneWatchlistCollectionsSnapshot(collectionsRef.current);
      const activeName =
        scope === "active" ? getActiveWatchlistCollection(previous).name : undefined;
      const activeId =
        scope === "active" ? getActiveWatchlistCollection(previous).id : undefined;

      if (!applyOptimisticRemove(storageKey, scope)) {
        toastWatchlistRemoveFailed();
        return;
      }

      dispatchWatchlistMutated(ticker);

      if (!userIdRef.current) {
        toastWatchlistRemoved(storageKey, { scope, watchlistName: activeName });
        return;
      }

      void enqueueWatchlistMutation(async () => {
        logWatchlistSync("mutation_start", "remove");
        let removed = false;

        if (scope === "all") {
          removed = await deleteWatchlistTicker(ticker, { scope: "all" });
        } else if (activeId) {
          const serverCollectionId = await resolveServerCollectionIdForList(
            collectionsRef.current,
            activeId,
            activeName ?? getActiveWatchlistCollection(previous).name,
          );
          if (serverCollectionId) {
            removed = await deleteWatchlistTicker(ticker, { collectionId: serverCollectionId });
          }
          if (!removed) {
            removed = await deleteWatchlistTicker(ticker, { scope: "all" });
          }
        }

        if (!removed) {
          logWatchlistSync("mutation_failure", "remove");
          applyCollections(previous);
          toastWatchlistRemoveFailed();
          setServerListWarning("Could not save to your account. Try again.");
          dispatchWatchlistMutated(ticker);
          return false;
        }

        await applyFreshServerState();
        const verified = await refreshWatchlistSnapshotFromServer();
        if (verified && serverSnapshotContainsTicker(verified, ticker)) {
          logWatchlistSync("mutation_failure", "remove_verify");
          applyCollections(previous);
          toastWatchlistRemoveFailed();
          setServerListWarning("Could not save to your account. Try again.");
          dispatchWatchlistMutated(ticker);
          return false;
        }

        logWatchlistSync("mutation_success", "remove");
        toastWatchlistRemoved(storageKey, { scope, watchlistName: activeName });
        setServerListWarning(null);
        dispatchWatchlistMutated(ticker);
        return true;
      });
    },
    [
      applyCollections,
      applyFreshServerState,
      applyOptimisticRemove,
      enqueueWatchlistMutation,
      resolveServerCollectionIdForList,
    ],
  );

  const toggleTicker = useCallback(
    (storageKey: string, watchlistId?: string) => {
      if (!hydratedRef.current) {
        toastWatchlistNotReady();
        return;
      }

      const currentUnion = new Set(
        unionWatchlistTickers(collectionsRef.current).map(normalizeTicker),
      );
      const removing = isWatchlistTickerWatched(currentUnion, storageKey);
      if (removing) {
        removeFromWatchlist(storageKey, "all");
        return;
      }

      const targetId =
        resolveWatchlistCollectionId(collectionsRef.current, watchlistId ?? "") ??
        collectionsRef.current.activeId;
      if (!targetId || isPlaceholderWatchlistId(targetId)) {
        toastWatchlistAddFailed();
        return;
      }
      addToWatchlist(storageKey, targetId);
    },
    [removeFromWatchlist, addToWatchlist],
  );

  const removeFromActiveWatchlist = useCallback(
    (storageKey: string) => {
      removeFromWatchlist(storageKey, "active");
    },
    [removeFromWatchlist],
  );

  const reorderActiveWatchlist = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (!hydratedRef.current) return;

      const previous = collectionsRef.current;
      const active = getActiveWatchlistCollection(previous);
      const optimistic = moveTickerInCollection(previous, active.id, fromIndex, toIndex);
      if (!optimistic) return;

      applyCollections(optimistic);
      dispatchWatchlistMutated();

      if (!userIdRef.current) return;

      void (async () => {
        const synced = await persistSnapshotToServer(optimistic);
        if (!synced) {
          setServerListWarning("Watchlist order saved locally; server sync will retry.");
        } else {
          setServerListWarning(null);
        }
      })();
    },
    [applyCollections, persistSnapshotToServer],
  );

  const moveActiveWatchlistItem = useCallback(
    (fromIndex: number, target: WatchlistDropTarget) => {
      if (!hydratedRef.current) return;

      const previous = collectionsRef.current;
      const active = getActiveWatchlistCollection(previous);
      const optimistic = applyWatchlistItemMove(previous, active.id, fromIndex, target);
      if (!optimistic) return;

      applyCollections(optimistic);
      dispatchWatchlistMutated();

      if (!userIdRef.current) return;

      void (async () => {
        const synced = await persistSnapshotToServer(optimistic);
        if (!synced) {
          setServerListWarning("Watchlist order saved locally; server sync will retry.");
        } else {
          setServerListWarning(null);
        }
      })();
    },
    [applyCollections, persistSnapshotToServer],
  );

  const createWatchlist = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;

      const previous = collectionsRef.current;
      const base = persistActiveListTickers(previous, [...watched]);

      if (base.lists.some((list) => collectionNamesMatch(list.name, trimmed))) {
        toast.error("A watchlist with this name already exists.");
        return;
      }

      const id = newWatchlistCollectionId();
      const optimistic: WatchlistCollectionsSnapshot = {
        v: 2,
        activeId: id,
        lists: [...base.lists, { id, name: trimmed, tickers: [], sections: [], tickerSections: {} }],
        pendingRemoval: [],
      };
      applyCollections(optimistic);
      dispatchWatchlistMutated();
      toastWatchlistCreated(trimmed);

      if (!userIdRef.current) {
        return;
      }

      void (async () => {
        const synced = await persistSnapshotToServer(optimistic);
        if (!synced) {
          setServerListWarning("Watchlist created locally; server sync will retry.");
        } else {
          setServerListWarning(null);
        }
        dispatchWatchlistMutated();
      })();
    },
    [applyCollections, persistSnapshotToServer, watched],
  );

  const persistSectionLayout = useCallback(
    (optimistic: WatchlistCollectionsSnapshot) => {
      applyCollections(optimistic);
      dispatchWatchlistMutated();
      if (!userIdRef.current) {
        toast.message("Sign in to sync sections across devices.");
        return;
      }
      void (async () => {
        const synced = await persistSnapshotToServer(optimistic);
        if (!synced) {
          setServerListWarning("Section saved on this device only; server sync will retry.");
        } else {
          setServerListWarning(null);
        }
      })();
    },
    [applyCollections, persistSnapshotToServer],
  );

  const createActiveSection = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;

      const previous = collectionsRef.current;
      const active = getActiveWatchlistCollection(previous);
      if (active.sections.some((section) => sectionNamesMatch(section.name, trimmed))) {
        toast.error("A section with this name already exists.");
        return;
      }

      const optimistic = addSectionToCollection(previous, active.id, trimmed);
      if (!optimistic) return;

      persistSectionLayout(optimistic);
      toast.success(`Created section "${trimmed}".`);
    },
    [persistSectionLayout],
  );

  const renameActiveSection = useCallback(
    (sectionId: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;

      const previous = collectionsRef.current;
      const active = getActiveWatchlistCollection(previous);
      if (
        active.sections.some(
          (section) => section.id !== sectionId && sectionNamesMatch(section.name, trimmed),
        )
      ) {
        toast.error("A section with this name already exists.");
        return;
      }

      const optimistic = renameSectionInCollection(previous, active.id, sectionId, trimmed);
      if (!optimistic) return;

      persistSectionLayout(optimistic);
      toast.success("Section renamed.");
    },
    [persistSectionLayout],
  );

  const deleteActiveSection = useCallback(
    (sectionId: string) => {
      const previous = collectionsRef.current;
      const active = getActiveWatchlistCollection(previous);
      const optimistic = deleteSectionFromCollection(previous, active.id, sectionId);
      if (!optimistic) return;

      persistSectionLayout(optimistic);
      toast.success("Section deleted.");
    },
    [persistSectionLayout],
  );

  const reorderActiveSection = useCallback(
    (fromSectionIndex: number, toSectionIndex: number) => {
      if (!hydratedRef.current) return;

      const previous = collectionsRef.current;
      const active = getActiveWatchlistCollection(previous);
      const optimistic = moveSectionInCollection(
        previous,
        active.id,
        fromSectionIndex,
        toSectionIndex,
      );
      if (!optimistic) return;

      persistSectionLayout(optimistic);
    },
    [persistSectionLayout],
  );

  const renameActiveWatchlist = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;

      const previous = collectionsRef.current;
      const activeList = getActiveWatchlistCollection(previous);
      const previousName = activeList.name;
      const optimistic = renameCollectionInSnapshot(previous, previous.activeId, trimmed);
      if (!optimistic) return;

      applyCollections(optimistic);

      if (!userIdRef.current) {
        toast.success("Watchlist renamed.");
        return;
      }

      void (async () => {
        const serverId = await resolveServerCollectionId(previous, previous.activeId, previousName);
        if (!serverId) {
          const uploaded = await syncWatchlistCollectionsToServer(optimistic);
          if (uploaded) {
            applyCollections(applyMutationServerResponse(uploaded, optimistic));
            toast.success("Watchlist renamed.");
          }
          return;
        }

        if (serverId.startsWith("wl_")) {
          const uploaded = await syncWatchlistCollectionsToServer(optimistic);
          if (uploaded) {
            applyCollections(applyMutationServerResponse(uploaded, optimistic));
            toast.success("Watchlist renamed.");
          }
          return;
        }

        const ok = await renameWatchlistOnServer(serverId, trimmed);
        if (ok) {
          const uploaded = await syncWatchlistCollectionsToServer(optimistic);
          if (uploaded) {
            applyCollections(applyMutationServerResponse(uploaded, optimistic));
            toast.success("Watchlist renamed.");
            return;
          }

          const snapshot = await refreshWatchlistSnapshotFromServer();
          if (snapshot) {
            applyCollections(applyMutationServerResponse(snapshot, optimistic));
          }
          toast.success("Watchlist renamed.");
          return;
        }

        const uploaded = await syncWatchlistCollectionsToServer(optimistic);
        if (uploaded) {
          applyCollections(applyMutationServerResponse(uploaded, optimistic));
          toast.success("Watchlist renamed.");
          return;
        }

        toast.error("Could not save watchlist name. Try again.");
      })();
    },
    [applyCollections, refreshFromServer],
  );

  const switchWatchlist = useCallback(
    (id: string) => {
      const previous = collectionsRef.current;
      const targetList = previous.lists.find((list) => list.id === id);
      if (!targetList) return;

      const next = prepareWatchlistSwitch(previous, [...watched], id);
      if (!next) return;

      applyCollections(next);
      dispatchWatchlistMutated();

      if (!userIdRef.current) return;

      void (async () => {
        let working = next;

        if (hasClientOnlyWatchlistIds(working)) {
          const uploaded = await syncWatchlistCollectionsToServer(working);
          if (uploaded) {
            const remapped = mergeServerIdsWithLocalSnapshot(uploaded, working, targetList.name);
            if (remapped) {
              applyCollections(remapped);
              working = remapped;
              dispatchWatchlistMutated();
            }
          }
        }

        const serverId =
          findCollectionIdByName(working, targetList.name) ?? working.activeId;
        const snapshot = await setActiveWatchlistOnServer(serverId);
        if (!snapshot) return;

        if (snapshot.activeCollectionId !== serverId) {
          const remapped = mergeServerIdsWithLocalSnapshot(snapshot, working, targetList.name);
          if (remapped) {
            applyCollections(remapped);
            dispatchWatchlistMutated();
          }
        }
      })();
    },
    [applyCollections, watched],
  );

  const deleteActiveWatchlist = useCallback(async () => {
    const previous = collectionsRef.current;
    const active = getActiveWatchlistCollection(previous);

    if (previous.lists.length <= 1) {
      toast.error("You need at least one watchlist.");
      return;
    }

    const remaining = previous.lists.filter((list) => list.id !== active.id);
    const optimistic: WatchlistCollectionsSnapshot = {
      v: 2,
      activeId: remaining[0]!.id,
      lists: remaining,
      pendingRemoval: [],
    };

    applyCollections(optimistic);
    clearWatchlistEnrichedCache();

    if (!userIdRef.current) {
      toast.success("Watchlist deleted.");
      dispatchWatchlistMutated();
      return;
    }

    const serverId = await resolveServerCollectionId(previous, active.id, active.name);
    if (serverId && !serverId.startsWith("wl_")) {
      const serverSnapshot = await deleteWatchlistCollectionOnClient(serverId);
      if (serverSnapshot) {
        const fromServer = clearDuplicateWatchlistTickerCopies(
          ensureSnapshotActiveId(serverSnapshotToCollections(serverSnapshot, userIdRef.current)),
        );
        applyCollections(fromServer);
        clearWatchlistEnrichedCache();
        setServerListWarning(null);
        toast.success("Watchlist deleted.");
        dispatchWatchlistMutated();
        return;
      }
    }

    if (await persistSnapshotToServer(optimistic)) {
      toast.success("Watchlist deleted.");
      dispatchWatchlistMutated();
      return;
    }

    applyCollections(previous);
    clearWatchlistEnrichedCache();
    setServerListWarning("Could not delete watchlist on the server. Try again.");
    toast.error("Could not delete watchlist. Try again.");
  }, [applyCollections, persistSnapshotToServer]);

  const active = getActiveWatchlistCollection(collections);

  const value = useMemo<WatchlistContextValue>(
    () => ({
      watched,
      watchedTickers,
      watchedUnion,
      loaded,
      toggleTicker,
      removeFromActiveWatchlist,
      reorderActiveWatchlist,
      moveActiveWatchlistItem,
      deleteActiveWatchlist,
      createWatchlist,
      createActiveSection,
      renameActiveSection,
      deleteActiveSection,
      reorderActiveSection,
      renameActiveWatchlist,
      switchWatchlist,
      watchlists: collections.lists,
      activeWatchlistId: active.id,
      activeWatchlistName: active.name,
      activeSections: active.sections,
      activeTickerSections: active.tickerSections,
      serverListWarning,
      storageHydrated: hydrated,
    }),
    [
      watched,
      watchedTickers,
      watchedUnion,
      loaded,
      toggleTicker,
      removeFromActiveWatchlist,
      reorderActiveWatchlist,
      moveActiveWatchlistItem,
      deleteActiveWatchlist,
      createWatchlist,
      createActiveSection,
      renameActiveSection,
      deleteActiveSection,
      reorderActiveSection,
      renameActiveWatchlist,
      switchWatchlist,
      collections.lists,
      active.id,
      active.name,
      active.sections,
      active.tickerSections,
      serverListWarning,
      hydrated,
    ],
  );

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

export function useWatchlist(): WatchlistContextValue {
  const ctx = useContext(WatchlistContext);
  if (!ctx) {
    throw new Error("useWatchlist must be used within WatchlistProvider");
  }
  return ctx;
}
