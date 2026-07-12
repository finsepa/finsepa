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
  patchWatchlistCollectionItemsReorder,
  patchWatchlistCollectionSections,
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
import {
  applyMembershipReconcileRollback,
  membershipReconcileConfirmed,
  type MembershipReconcileJob,
} from "@/lib/watchlist/membership-reconcile";
import {
  logWatchlistBackgroundReconcileResult,
  logWatchlistCanonicalRefetchMs,
  markWatchlistMutationHttpConfirmed,
  markWatchlistMutationOptimisticApplied,
  markWatchlistMutationQueueReleased,
  markWatchlistMutationToastShown,
  startWatchlistMutationTiming,
} from "@/lib/watchlist/mutation-timing";
import { logWatchlistSync } from "@/lib/watchlist/sync-debug";
import {
  logWatchlistRefetch,
  logWatchlistStateReplace,
  logWatchlistSyncRequest,
  noteOptimisticDragResult,
  type WatchlistStateAuditMeta,
} from "@/lib/watchlist/state-audit";
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
  const latestMutationGenerationRef = useRef(0);
  const syncDirtyRef = useRef(false);
  const syncInFlightRef = useRef<Promise<boolean> | null>(null);
  const syncErrorToastedRef = useRef(false);
  const membershipReconcileQueueRef = useRef<MembershipReconcileJob[]>([]);
  const membershipReconcileFlushScheduledRef = useRef(false);
  const membershipReconcileInFlightRef = useRef<Promise<void> | null>(null);

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

  const nextMutationGeneration = useCallback((): number => {
    latestMutationGenerationRef.current += 1;
    return latestMutationGenerationRef.current;
  }, []);

  const isStaleMutationGeneration = useCallback((generation: number): boolean => {
    return generation < latestMutationGenerationRef.current;
  }, []);

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
      audit?: WatchlistStateAuditMeta,
    ) => {
      const auditMeta: WatchlistStateAuditMeta = audit ?? {
        caller: "applyCollections",
        reason: options?.fromServerSync ? "fromServerSync option" : "unspecified",
        source: options?.fromServerSync ? "server_refetch" : "unknown",
      };
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
      logWatchlistStateReplace(withSyncMeta, auditMeta);
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
      auditReason = "server snapshot adopt",
    ) => {
      applyCollections(
        adoptCanonicalServerSnapshot(serverSnapshot, collectionsRef.current, {
          preferServerNames: true,
          preferPopulatedActive: options?.preferPopulatedActive ?? true,
        }),
        { fromServerSync: true, serverUpdatedAt: serverSnapshot.updatedAt },
        {
          caller: "adoptServerCanonical",
          reason: auditReason,
          source: "server_refetch",
        },
      );
    },
    [applyCollections],
  );

  const applyCollectionsIfCurrent = useCallback(
    (
      generation: number,
      snapshot: WatchlistCollectionsSnapshot,
      options?: {
        fromServerSync?: boolean;
        serverUpdatedAt?: string | null;
        preferPopulatedActive?: boolean;
      },
      audit?: WatchlistStateAuditMeta,
    ): boolean => {
      if (isStaleMutationGeneration(generation)) {
        logWatchlistSync("mutation_stale");
        return false;
      }
      applyCollections(snapshot, options, audit);
      return true;
    },
    [applyCollections, isStaleMutationGeneration],
  );

  const adoptServerCanonicalIfCurrent = useCallback(
    (
      generation: number,
      serverSnapshot: WatchlistServerSnapshot,
      options?: { preferPopulatedActive?: boolean },
      auditReason = "server snapshot adopt",
    ): boolean => {
      if (isStaleMutationGeneration(generation)) {
        logWatchlistSync("mutation_stale");
        return false;
      }
      adoptServerCanonical(serverSnapshot, options, auditReason);
      return true;
    },
    [adoptServerCanonical, isStaleMutationGeneration],
  );

  /**
   * Full replacement sync — session layout/collection helpers only (not login/logout/bootstrap).
   * @deprecated Prefer explicit POST/DELETE/collection endpoints for user mutations.
   */
  const persistSnapshotToServer = useCallback(
    async (
      _snapshot?: WatchlistCollectionsSnapshot,
      responseGeneration?: number,
    ): Promise<boolean> => {
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
          logWatchlistSyncRequest("start", "persistSnapshotToServer", {
            collectionCount: snapshotToSync.lists.length,
            itemCount: unionWatchlistTickers(snapshotToSync).length,
          });
          const uploaded = await syncWatchlistCollectionsToServer(snapshotToSync);
          logWatchlistSyncRequest("response", "persistSnapshotToServer", { ok: !!uploaded });
          if (!uploaded) {
            if (unionWatchlistTickers(collectionsRef.current).length > 0) {
              setServerListWarning(
                "Watchlist saved on this device only — server refused a sync that would erase saved tickers.",
              );
              notifyWatchlistSyncFailed();
            }
            return false;
          }

          logWatchlistRefetch("start", "persistSnapshotToServer after full sync");
          const fresh = await refreshWatchlistSnapshotFromServer();
          logWatchlistRefetch("response", "persistSnapshotToServer after full sync", {
            ok: !!fresh,
            collectionCount: fresh?.collections.length ?? 0,
          });
          if (fresh) {
            if (responseGeneration != null) {
              adoptServerCanonicalIfCurrent(
                responseGeneration,
                fresh,
                { preferPopulatedActive: false },
                "persistSnapshotToServer post-sync refetch",
              );
            } else {
              adoptServerCanonical(
                fresh,
                { preferPopulatedActive: false },
                "persistSnapshotToServer post-sync refetch",
              );
            }
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
          void persistSnapshotToServer(undefined, latestMutationGenerationRef.current);
        }
      });

      syncInFlightRef.current = task;
      serverSyncChainRef.current = task.then(
        () => undefined,
        () => undefined,
      );
      return task;
    },
    [adoptServerCanonical, adoptServerCanonicalIfCurrent, notifyWatchlistSyncFailed],
  );

  const applyFreshServerState = useCallback(
    async (generation?: number): Promise<boolean> => {
      logWatchlistRefetch("start", "applyFreshServerState");
      const snapshot = await refreshWatchlistSnapshotFromServer();
      logWatchlistRefetch("response", "applyFreshServerState", { ok: !!snapshot });
      if (!snapshot) return false;
      if (generation != null) {
        return adoptServerCanonicalIfCurrent(
          generation,
          snapshot,
          { preferPopulatedActive: false },
          "applyFreshServerState",
        );
      }
      adoptServerCanonical(snapshot, { preferPopulatedActive: false }, "applyFreshServerState");
      return true;
    },
    [adoptServerCanonical, adoptServerCanonicalIfCurrent],
  );

  const flushMembershipReconcileQueue = useCallback(async () => {
    if (membershipReconcileInFlightRef.current) {
      await membershipReconcileInFlightRef.current.catch(() => undefined);
      if (membershipReconcileQueueRef.current.length > 0) {
        void flushMembershipReconcileQueue();
      }
      return;
    }

    const jobs = membershipReconcileQueueRef.current.splice(0);
    if (jobs.length === 0) return;

    const task = (async () => {
      const refetchStart = performance.now();
      logWatchlistRefetch("start", "background membership reconcile");
      const server = await refreshWatchlistSnapshotFromServer();
      logWatchlistCanonicalRefetchMs(Math.round(performance.now() - refetchStart));
      logWatchlistRefetch("response", "background membership reconcile", { ok: !!server });

      if (!server) {
        for (const job of jobs) {
          logWatchlistBackgroundReconcileResult("fetch_miss", job.kind);
        }
        return;
      }

      for (const job of jobs) {
        if (isStaleMutationGeneration(job.generation)) {
          logWatchlistBackgroundReconcileResult("stale_skipped", job.kind);
          continue;
        }

        if (membershipReconcileConfirmed(server, job)) {
          logWatchlistBackgroundReconcileResult("confirmed", job.kind);
          continue;
        }

        if (isStaleMutationGeneration(job.generation)) {
          logWatchlistBackgroundReconcileResult("stale_skipped", job.kind);
          continue;
        }

        const rolledBack = applyMembershipReconcileRollback(collectionsRef.current, job);
        const applied = applyCollectionsIfCurrent(job.generation, rolledBack, undefined, {
          caller: "membershipReconcile",
          reason: job.expectedOnServer ? "add verify failed" : "remove verify failed",
          source: "server_refetch",
        });
        if (!applied) {
          logWatchlistBackgroundReconcileResult("stale_skipped", job.kind);
          continue;
        }
        logWatchlistBackgroundReconcileResult("contradicted_rollback", job.kind);
        if (job.expectedOnServer) {
          toastWatchlistAddFailed();
        } else {
          toastWatchlistRemoveFailed();
        }
        setServerListWarning("Could not save to your account. Try again.");
        dispatchWatchlistMutated(job.ticker);
      }
    })();

    membershipReconcileInFlightRef.current = task.finally(() => {
      membershipReconcileInFlightRef.current = null;
    });
    await membershipReconcileInFlightRef.current;

    if (membershipReconcileQueueRef.current.length > 0) {
      void flushMembershipReconcileQueue();
    }
  }, [applyCollectionsIfCurrent, isStaleMutationGeneration]);

  const scheduleMembershipReconcile = useCallback(
    (job: MembershipReconcileJob) => {
      membershipReconcileQueueRef.current.push(job);
      if (membershipReconcileFlushScheduledRef.current) return;
      membershipReconcileFlushScheduledRef.current = true;
      queueMicrotask(() => {
        membershipReconcileFlushScheduledRef.current = false;
        void flushMembershipReconcileQueue();
      });
    },
    [flushMembershipReconcileQueue],
  );

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
        applyCollections(readWatchlistCollections(null), undefined, {
          caller: "bootstrap",
          reason: "signed out",
          source: "localStorage_bootstrap",
        });
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
      applyCollections(working, { preferPopulatedActive: activeEmptyButHasTickers }, {
        caller: "bootstrap",
        reason: "cache display before GET",
        source: "localStorage_bootstrap",
      });
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
        adoptServerCanonical(serverSnapshot, undefined, "bootstrap GET success");
        setServerListWarning(null);
        clearGuestWatchlistStorage(uid);

        if (options.mergeGuest) {
          const guestMergeGeneration = nextMutationGeneration();
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
          await applyFreshServerState(guestMergeGeneration);
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
          applyCollections(readWatchlistCollections(null), undefined, {
          caller: "bootstrap",
          reason: "signed out",
          source: "localStorage_bootstrap",
        });
          setHydrated(true);
          setLoaded(true);
        })();
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [adoptServerCanonical, applyCollections, applyFreshServerState, nextMutationGeneration, notifyWatchlistSyncFailed, resolveServerCollectionIdForList, waitForPendingWatchlistWork]);

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
      const generation = nextMutationGeneration();
      const timing = startWatchlistMutationTiming("add");
      applyCollections(withActiveTarget, undefined, {
        caller: "addToWatchlist",
        reason: "optimistic add",
        source: "optimistic",
      });
      markWatchlistMutationOptimisticApplied(timing);
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
            markWatchlistMutationHttpConfirmed(timing);
            if (withActiveTarget.activeId === resolvedId) {
              void setActiveWatchlistOnServer(serverCollectionId);
            }
            logWatchlistSync("mutation_success", "add");
            toastWatchlistAdded(storageKey, targetList.name);
            markWatchlistMutationToastShown(timing);
            setServerListWarning(null);
            dispatchWatchlistMutated(ticker);
            scheduleMembershipReconcile({
              generation,
              ticker,
              storageKey,
              expectedOnServer: true,
              previous,
              kind: "add",
            });
            markWatchlistMutationQueueReleased(timing);
            return true;
          }
        }

        logWatchlistSync("mutation_failure", "add");
        applyCollectionsIfCurrent(generation, previous);
        toastWatchlistAddFailed();
        setServerListWarning("Could not save to your account. Try again.");
        dispatchWatchlistMutated(ticker);
        markWatchlistMutationQueueReleased(timing);
        return false;
      });
    },
    [
      applyCollections,
      applyCollectionsIfCurrent,
      enqueueWatchlistMutation,
      nextMutationGeneration,
      resolveServerCollectionIdForList,
      scheduleMembershipReconcile,
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

      const timing = startWatchlistMutationTiming("remove");
      if (!applyOptimisticRemove(storageKey, scope)) {
        toastWatchlistRemoveFailed();
        return;
      }

      const generation = nextMutationGeneration();
      markWatchlistMutationOptimisticApplied(timing);
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
          applyCollectionsIfCurrent(generation, previous);
          toastWatchlistRemoveFailed();
          setServerListWarning("Could not save to your account. Try again.");
          dispatchWatchlistMutated(ticker);
          markWatchlistMutationQueueReleased(timing);
          return false;
        }

        markWatchlistMutationHttpConfirmed(timing);
        logWatchlistSync("mutation_success", "remove");
        toastWatchlistRemoved(storageKey, { scope, watchlistName: activeName });
        markWatchlistMutationToastShown(timing);
        setServerListWarning(null);
        dispatchWatchlistMutated(ticker);
        scheduleMembershipReconcile({
          generation,
          ticker,
          storageKey,
          expectedOnServer: false,
          previous,
          kind: "remove",
        });
        markWatchlistMutationQueueReleased(timing);
        return true;
      });
    },
    [
      applyCollectionsIfCurrent,
      applyOptimisticRemove,
      enqueueWatchlistMutation,
      nextMutationGeneration,
      resolveServerCollectionIdForList,
      scheduleMembershipReconcile,
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

  const persistDragOrReorderLayout = useCallback(
    (
      previous: WatchlistCollectionsSnapshot,
      optimistic: WatchlistCollectionsSnapshot,
      generation: number,
      mode: "drag" | "reorder",
    ) => {
      const active = getActiveWatchlistCollection(optimistic);
      if (!userIdRef.current) return;

      void enqueueWatchlistMutation(async () => {
        logWatchlistSync("mutation_start", mode);
        const serverId = await resolveServerCollectionIdForList(
          optimistic,
          active.id,
          active.name,
        );
        if (!serverId) {
          logWatchlistSync("mutation_failure", mode);
          applyCollectionsIfCurrent(generation, previous);
          setServerListWarning("Watchlist order saved on this device only; server sync will retry.");
          return false;
        }

        const reorderOk = await patchWatchlistCollectionItemsReorder(serverId, active.tickers);
        if (!reorderOk) {
          logWatchlistSync("mutation_failure", mode);
          applyCollectionsIfCurrent(generation, previous);
          setServerListWarning("Watchlist order saved on this device only; server sync will retry.");
          return false;
        }

        if (mode === "drag") {
          const sectionsOk = await patchWatchlistCollectionSections(
            serverId,
            active.sections,
            active.tickerSections,
          );
          if (!sectionsOk) {
            logWatchlistSync("mutation_failure", mode);
            applyCollectionsIfCurrent(generation, previous);
            setServerListWarning("Watchlist order saved on this device only; server sync will retry.");
            return false;
          }
        }

        logWatchlistSync("mutation_success", mode);
        setServerListWarning(null);
        return true;
      });
    },
    [
      applyCollectionsIfCurrent,
      enqueueWatchlistMutation,
      resolveServerCollectionIdForList,
    ],
  );

  const reorderActiveWatchlist = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (!hydratedRef.current) return;

      const previous = cloneWatchlistCollectionsSnapshot(collectionsRef.current);
      const active = getActiveWatchlistCollection(previous);
      const optimistic = moveTickerInCollection(previous, active.id, fromIndex, toIndex);
      if (!optimistic) return;

      const draggedKey = active.tickers[fromIndex];
      const generation = nextMutationGeneration();
      applyCollections(optimistic, undefined, {
        caller: "reorderActiveWatchlist",
        reason: "optimistic ticker reorder",
        source: "optimistic",
      });
      if (draggedKey) noteOptimisticDragResult(optimistic, draggedKey);

      persistDragOrReorderLayout(previous, optimistic, generation, "reorder");
    },
    [applyCollections, nextMutationGeneration, persistDragOrReorderLayout],
  );

  const moveActiveWatchlistItem = useCallback(
    (fromIndex: number, target: WatchlistDropTarget) => {
      if (!hydratedRef.current) return;

      const previous = cloneWatchlistCollectionsSnapshot(collectionsRef.current);
      const active = getActiveWatchlistCollection(previous);
      const optimistic = applyWatchlistItemMove(previous, active.id, fromIndex, target);
      if (!optimistic) return;

      const draggedKey = active.tickers[fromIndex];
      const generation = nextMutationGeneration();
      applyCollections(optimistic, undefined, {
        caller: "moveActiveWatchlistItem",
        reason: "optimistic section/row move",
        source: "optimistic",
      });
      if (draggedKey) noteOptimisticDragResult(optimistic, draggedKey);

      persistDragOrReorderLayout(previous, optimistic, generation, "drag");
    },
    [applyCollections, nextMutationGeneration, persistDragOrReorderLayout],
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
      const generation = nextMutationGeneration();
      applyCollections(optimistic);
      toastWatchlistCreated(trimmed);

      if (!userIdRef.current) {
        return;
      }

      void (async () => {
        const synced = await persistSnapshotToServer(optimistic, generation);
        if (!synced) {
          setServerListWarning("Watchlist created locally; server sync will retry.");
        } else {
          setServerListWarning(null);
        }
      })();
    },
    [applyCollections, nextMutationGeneration, persistSnapshotToServer, watched],
  );

  const persistSectionLayout = useCallback(
    (optimistic: WatchlistCollectionsSnapshot) => {
      const previous = cloneWatchlistCollectionsSnapshot(collectionsRef.current);
      const active = getActiveWatchlistCollection(optimistic);
      const generation = nextMutationGeneration();

      applyCollections(optimistic);
      if (!userIdRef.current) {
        toast.message("Sign in to sync sections across devices.");
        return;
      }

      void enqueueWatchlistMutation(async () => {
        logWatchlistSync("mutation_start", "sections");
        const serverId = await resolveServerCollectionIdForList(
          optimistic,
          active.id,
          active.name,
        );
        if (!serverId) {
          logWatchlistSync("mutation_failure", "sections");
          applyCollectionsIfCurrent(generation, previous);
          setServerListWarning("Section saved on this device only; server sync will retry.");
          return false;
        }

        const ok = await patchWatchlistCollectionSections(
          serverId,
          active.sections,
          active.tickerSections,
        );
        if (!ok) {
          logWatchlistSync("mutation_failure", "sections");
          applyCollectionsIfCurrent(generation, previous);
          setServerListWarning("Section saved on this device only; server sync will retry.");
          return false;
        }

        logWatchlistSync("mutation_success", "sections");
        setServerListWarning(null);
        return true;
      });
    },
    [applyCollections, applyCollectionsIfCurrent, enqueueWatchlistMutation, nextMutationGeneration, resolveServerCollectionIdForList],
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

      const generation = nextMutationGeneration();
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
            applyCollectionsIfCurrent(
              generation,
              applyMutationServerResponse(uploaded, optimistic),
            );
            toast.success("Watchlist renamed.");
          }
          return;
        }

        if (serverId.startsWith("wl_")) {
          const uploaded = await syncWatchlistCollectionsToServer(optimistic);
          if (uploaded) {
            applyCollectionsIfCurrent(
              generation,
              applyMutationServerResponse(uploaded, optimistic),
            );
            toast.success("Watchlist renamed.");
          }
          return;
        }

        const ok = await renameWatchlistOnServer(serverId, trimmed);
        if (ok) {
          const uploaded = await syncWatchlistCollectionsToServer(optimistic);
          if (uploaded) {
            applyCollectionsIfCurrent(
              generation,
              applyMutationServerResponse(uploaded, optimistic),
            );
            toast.success("Watchlist renamed.");
            return;
          }

          const snapshot = await refreshWatchlistSnapshotFromServer();
          if (snapshot) {
            applyCollectionsIfCurrent(
              generation,
              applyMutationServerResponse(snapshot, optimistic),
            );
          }
          toast.success("Watchlist renamed.");
          return;
        }

        const uploaded = await syncWatchlistCollectionsToServer(optimistic);
        if (uploaded) {
          applyCollectionsIfCurrent(
            generation,
            applyMutationServerResponse(uploaded, optimistic),
          );
          toast.success("Watchlist renamed.");
          return;
        }

        toast.error("Could not save watchlist name. Try again.");
      })();
    },
    [applyCollections, applyCollectionsIfCurrent, nextMutationGeneration, refreshFromServer],
  );

  const switchWatchlist = useCallback(
    (id: string) => {
      const previous = collectionsRef.current;
      const targetList = previous.lists.find((list) => list.id === id);
      if (!targetList) return;

      const next = prepareWatchlistSwitch(previous, [...watched], id);
      if (!next) return;

      const generation = nextMutationGeneration();
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
              applyCollectionsIfCurrent(generation, remapped);
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
            applyCollectionsIfCurrent(generation, remapped);
            dispatchWatchlistMutated();
          }
        }
      })();
    },
    [applyCollections, applyCollectionsIfCurrent, nextMutationGeneration, watched],
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

    const generation = nextMutationGeneration();
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
        applyCollectionsIfCurrent(generation, fromServer);
        clearWatchlistEnrichedCache();
        setServerListWarning(null);
        toast.success("Watchlist deleted.");
        dispatchWatchlistMutated();
        return;
      }
    }

    if (await persistSnapshotToServer(optimistic, generation)) {
      toast.success("Watchlist deleted.");
      dispatchWatchlistMutated();
      return;
    }

    applyCollectionsIfCurrent(generation, previous);
    clearWatchlistEnrichedCache();
    setServerListWarning("Could not delete watchlist on the server. Try again.");
    toast.error("Could not delete watchlist. Try again.");
  }, [applyCollections, applyCollectionsIfCurrent, nextMutationGeneration, persistSnapshotToServer]);

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
