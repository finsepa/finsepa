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
import {
  addTickerToSnapshot,
  clearDuplicateWatchlistTickerCopies,
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
  fetchWatchlistSnapshot,
  postWatchlistTicker,
  refreshWatchlistSnapshotFromServer,
  renameWatchlistOnServer,
  resetNewAccountWatchlistOnServer,
  resolveServerCollectionId,
  setActiveWatchlistOnServer,
  syncWatchlistSnapshotToServer,
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
import {
  applyMutationServerResponse,
  applyServerIdsPreservingLocalLayout,
  applyServerSnapshotPreservingLocalNames,
  findCollectionIdByName,
  hasClientOnlyWatchlistIds,
  localSnapshotShouldUploadFirst,
  localSnapshotToSyncInput,
  mergeServerIdsWithLocalSnapshot,
  mergeServerWithLocalSnapshot,
  serverSnapshotHasNoTickers,
  serverSnapshotToCollections,
  shouldAdoptServerSnapshot,
  watchlistSyncPayloadsEqual,
} from "@/lib/watchlist/snapshot";
import { clearWatchlistEnrichedCache } from "@/lib/watchlist/watchlist-enriched-cache";

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
  const syncDirtyRef = useRef(false);
  const syncInFlightRef = useRef<Promise<boolean> | null>(null);

  const hydratedRef = useRef(hydrated);
  hydratedRef.current = hydrated;

  const watchedUnion = useMemo(
    () => new Set(unionWatchlistTickers(collections).map(normalizeTicker)),
    [collections],
  );

  const applyCollections = useCallback(
    (
      snapshot: WatchlistCollectionsSnapshot,
      options?: {
        /** Set after the snapshot matches what was persisted on the server. */
        fromServerSync?: boolean;
      },
    ) => {
      const now = Date.now();
      const normalized = ensureSnapshotActiveId(snapshot);
      const repaired = clearDuplicateWatchlistTickerCopies(normalized);
      const withSyncMeta: WatchlistCollectionsSnapshot = options?.fromServerSync
        ? {
            ...repaired,
            lastSyncedAt: now,
            lastModifiedAt: repaired.lastModifiedAt ?? now,
          }
        : {
            ...repaired,
            lastModifiedAt: now,
            lastSyncedAt: repaired.lastSyncedAt,
          };
      const active = getActiveWatchlistCollection(withSyncMeta);
      const orderedTickers = active.tickers.map(normalizeTicker);
      setCollections(withSyncMeta);
      setWatchedTickers(orderedTickers);
      setWatched(new Set(orderedTickers));
      writeWatchlistCollections(userIdRef.current, withSyncMeta);
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
          const uploaded = await syncWatchlistSnapshotToServer(
            localSnapshotToSyncInput(snapshotToSync),
          );
          if (!uploaded) return false;

          applyCollections(
            applyServerIdsPreservingLocalLayout(uploaded, collectionsRef.current),
            { fromServerSync: true },
          );
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
    [applyCollections],
  );

  const refreshFromServer = useCallback(async () => {
    const snapshot = await refreshWatchlistSnapshotFromServer();
    if (!snapshot) return null;
    const merged = mergeServerWithLocalSnapshot(snapshot, collectionsRef.current);
    writeWatchlistCollections(userIdRef.current, merged);
    applyCollections(merged);
    return snapshot;
  }, [applyCollections]);

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

      setHydrated(false);
      setLoaded(false);

      const local = options.mergeGuest
        ? mergeGuestWatchlistOnSignIn(uid)
        : loadAuthenticatedWatchlistCollections(uid);

      try {
        const { snapshot, warning } = await fetchWatchlistSnapshot();
        if (cancelled) return;

        if (warning === "db_unavailable") {
          setServerListWarning("Watchlist temporarily unavailable");
          applyCollections(local);
          return;
        }

        if (!snapshot) {
          setServerListWarning(null);
          applyCollections(local);
          return;
        }

        let serverSnapshot = snapshot;
        const working = clearDuplicateWatchlistTickerCopies(local);

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

        if (
          !options.mergeGuest &&
          serverSnapshotHasNoTickers(serverSnapshot) &&
          unionWatchlistTickers(working).length > 0
        ) {
          setServerListWarning(null);
          applyCollections(
            applyServerSnapshotPreservingLocalNames(serverSnapshot, working, {
              preferServerNames: true,
            }),
          );
          clearGuestWatchlistStorage(uid);
          return;
        }

        if (localSnapshotShouldUploadFirst(working, serverSnapshot)) {
          const uploaded = await syncWatchlistSnapshotToServer(localSnapshotToSyncInput(working));
          if (uploaded) {
            applyCollections(applyMutationServerResponse(uploaded, working), {
              fromServerSync: true,
            });
            return;
          }
          setServerListWarning(
            "Watchlist saved on this device only — could not sync sections to your account yet.",
          );
          applyCollections(working);
          return;
        }

        if (shouldAdoptServerSnapshot(working, serverSnapshot)) {
          setServerListWarning(null);
          applyCollections(
            applyServerSnapshotPreservingLocalNames(serverSnapshot, working, {
              preferServerNames: true,
            }),
            { fromServerSync: true },
          );
          return;
        }

        setServerListWarning(null);
        applyCollections(mergeServerWithLocalSnapshot(serverSnapshot, working), {
          fromServerSync: true,
        });
      } catch {
        if (!cancelled) {
          setServerListWarning(null);
          applyCollections(local);
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
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled) return;
        await bootstrap(session?.user?.id ?? null, {}, session?.user ?? null);
      } catch {
        if (!cancelled) {
          await bootstrap(null, {}, null);
        }
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      const uid = nextSession?.user?.id ?? null;
      if (event === "SIGNED_IN" && uid) {
        const mergeGuest = consumeGuestWatchlistPendingMerge();
        void bootstrap(uid, { mergeGuest }, nextSession?.user ?? null);
      } else if (event === "SIGNED_OUT") {
        clearGuestWatchlistPendingMerge();
        clearGuestWatchlistStorage();
        setUserId(null);
        applyCollections(readWatchlistCollections(null));
        setHydrated(true);
        setLoaded(true);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [applyCollections]);

  useEffect(() => {
    if (!loaded || !userId) return;

    let cancelled = false;
    void (async () => {
      const local = collectionsRef.current;
      const server = await refreshWatchlistSnapshotFromServer();
      if (cancelled || !server) return;

      if (localSnapshotShouldUploadFirst(local, server)) {
        const synced = await persistSnapshotToServer(local);
        if (cancelled) return;
        if (!synced) {
          setServerListWarning(
            "Watchlist saved on this device only — could not sync sections to your account yet.",
          );
        } else {
          setServerListWarning(null);
        }
        return;
      }

      if (shouldAdoptServerSnapshot(local, server)) {
        applyCollections(
          applyServerSnapshotPreservingLocalNames(server, local, { preferServerNames: true }),
          { fromServerSync: true },
        );
        setServerListWarning(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loaded, userId, persistSnapshotToServer]);

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
      applyCollections(snapshot);
      toastWatchlistAdded(storageKey, targetList.name);
      dispatchWatchlistMutated(ticker);

      if (!userIdRef.current) return;

      void (async () => {
        const optimistic = collectionsRef.current;

        let serverCollectionId = isServerWatchlistCollectionId(resolvedId)
          ? resolvedId
          : await resolveServerCollectionId(optimistic, resolvedId, targetList.name);

        if (serverCollectionId && isServerWatchlistCollectionId(serverCollectionId)) {
          const posted = await postWatchlistTicker(ticker, serverCollectionId);
          if (posted) {
            const snapshot = await refreshWatchlistSnapshotFromServer();
            if (snapshot) {
              applyCollections(applyMutationServerResponse(snapshot, optimistic));
            }
            setServerListWarning(null);
            dispatchWatchlistMutated(ticker);
            return;
          }
        }

        const synced = await persistSnapshotToServer(optimistic);
        if (!synced) {
          setServerListWarning("Watchlist saved locally; server sync will retry.");
          toastWatchlistSyncFailed();
        } else {
          setServerListWarning(null);
        }
        dispatchWatchlistMutated(ticker);
      })();
    },
    [applyCollections, persistSnapshotToServer],
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
      const activeName =
        scope === "active" ? getActiveWatchlistCollection(collectionsRef.current).name : undefined;

      if (!applyOptimisticRemove(storageKey, scope)) {
        toastWatchlistRemoveFailed();
        return;
      }

      toastWatchlistRemoved(storageKey, { scope, watchlistName: activeName });
      dispatchWatchlistMutated(ticker);

      if (!userIdRef.current) return;

      void (async () => {
        const optimistic = collectionsRef.current;
        const synced = await persistSnapshotToServer(optimistic);
        if (!synced) {
          setServerListWarning("Watchlist saved locally; server sync will retry.");
          toastWatchlistSyncFailed();
        } else {
          setServerListWarning(null);
        }
        dispatchWatchlistMutated(ticker);
      })();
    },
    [applyOptimisticRemove, persistSnapshotToServer],
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
          const uploaded = await syncWatchlistSnapshotToServer(localSnapshotToSyncInput(optimistic));
          if (uploaded) {
            applyCollections(applyMutationServerResponse(uploaded, optimistic));
            toast.success("Watchlist renamed.");
          }
          return;
        }

        if (serverId.startsWith("wl_")) {
          const uploaded = await syncWatchlistSnapshotToServer(localSnapshotToSyncInput(optimistic));
          if (uploaded) {
            applyCollections(applyMutationServerResponse(uploaded, optimistic));
            toast.success("Watchlist renamed.");
          }
          return;
        }

        const ok = await renameWatchlistOnServer(serverId, trimmed);
        if (ok) {
          const uploaded = await syncWatchlistSnapshotToServer(localSnapshotToSyncInput(optimistic));
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

        const uploaded = await syncWatchlistSnapshotToServer(localSnapshotToSyncInput(optimistic));
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
          const uploaded = await syncWatchlistSnapshotToServer(localSnapshotToSyncInput(working));
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
