import { readWatchlistDisplayName, DEFAULT_WATCHLIST_DISPLAY_NAME } from "@/lib/watchlist/display-name";
import { readWatchlistLocalFull } from "@/lib/watchlist/local-storage";
import {
  isWatchlistTickerWatched,
  normalizeWatchlistStorageKey,
  removeWatchlistTickerFromSet,
  watchlistRemovalCandidateKeys,
} from "@/lib/watchlist/normalize-storage-key";
import {
  newWatchlistSectionId,
  normalizeTickerSections,
  normalizeWatchlistSections,
  sectionNamesMatch,
  sectionsLayoutsEqual,
  serverHasSectionsLayout,
  type WatchlistSection,
} from "@/lib/watchlist/sections";

export type { WatchlistSection };

export type WatchlistCollection = {
  id: string;
  name: string;
  tickers: string[];
  sections: WatchlistSection[];
  tickerSections: Record<string, string>;
};

export type WatchlistCollectionsSnapshot = {
  v: 2;
  activeId: string;
  lists: WatchlistCollection[];
  pendingRemoval: string[];
  /** Set when the user mutates local state (ms since epoch). */
  lastModifiedAt?: number;
  /** Set after a successful server sync (ms since epoch). */
  lastSyncedAt?: number;
};

const STORAGE_KEY = "finsepa.watchlist.collections.v2";
const LEGACY_GUEST_STORAGE_KEY = "finsepa.watchlist.v1.guest";
const LEGACY_GLOBAL_STORAGE_KEY = "finsepa.watchlist.v1";

function storageKeyForUser(userId: string | null): string {
  if (userId && userId.length > 0) return `${STORAGE_KEY}.u.${userId}`;
  return `${STORAGE_KEY}.guest`;
}

export function newWatchlistCollectionId(): string {
  return `wl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function isPlaceholderWatchlistId(id: string): boolean {
  return id === "pending";
}

/** True for Supabase UUID collection ids (not bootstrap placeholders or client-only wl_* ids). */
export function isServerWatchlistCollectionId(id: string): boolean {
  return id.length > 0 && !isPlaceholderWatchlistId(id) && !id.startsWith("wl_");
}

function normalizeCollection(list: {
  id: string;
  name: string;
  tickers?: string[];
  sections?: unknown;
  tickerSections?: unknown;
}): WatchlistCollection {
  const sections = normalizeWatchlistSections(list.sections);
  return {
    id: list.id,
    name: list.name.trim() || DEFAULT_WATCHLIST_DISPLAY_NAME,
    tickers: normalizeTickers(Array.isArray(list.tickers) ? list.tickers : []),
    sections,
    tickerSections: normalizeTickerSections(list.tickerSections, sections),
  };
}

function withSectionLayout(
  list: Omit<WatchlistCollection, "sections" | "tickerSections"> & {
    sections?: WatchlistSection[];
    tickerSections?: Record<string, string>;
  },
): WatchlistCollection {
  return normalizeCollection(list);
}

function normalizeTickers(tickers: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const raw of tickers) {
    const ticker = normalizeWatchlistStorageKey(String(raw));
    if (!ticker || seen.has(ticker)) continue;
    seen.add(ticker);
    ordered.push(ticker);
  }
  return ordered;
}

function migrateLegacyCollections(userId: string | null): WatchlistCollectionsSnapshot {
  const legacy = readWatchlistLocalFull(userId);
  if (
    userId &&
    legacy.tickers.length === 0 &&
    legacy.pendingRemoval.length === 0
  ) {
    const id = newWatchlistCollectionId();
    return {
      v: 2,
      activeId: id,
      lists: [
        withSectionLayout({
          id,
          name: DEFAULT_WATCHLIST_DISPLAY_NAME,
          tickers: [],
        }),
      ],
      pendingRemoval: [],
    };
  }
  const id = newWatchlistCollectionId();
  return {
    v: 2,
    activeId: id,
    lists: [
      withSectionLayout({
        id,
        name: readWatchlistDisplayName(userId),
        tickers: normalizeTickers(legacy.tickers),
      }),
    ],
    pendingRemoval: normalizeTickers(legacy.pendingRemoval),
  };
}

/** Stable SSR/hydration default — never reads localStorage. */
export function createDefaultWatchlistCollectionsSnapshot(): WatchlistCollectionsSnapshot {
  const id = "pending";
  return {
    v: 2,
    activeId: id,
    lists: [
      withSectionLayout({ id, name: DEFAULT_WATCHLIST_DISPLAY_NAME, tickers: [] }),
    ],
    pendingRemoval: [],
  };
}

export function readWatchlistCollections(userId: string | null = null): WatchlistCollectionsSnapshot {
  if (typeof window === "undefined") return migrateLegacyCollections(userId);
  try {
    const raw = localStorage.getItem(storageKeyForUser(userId));
    if (!raw) return migrateLegacyCollections(userId);
    const parsed = JSON.parse(raw) as Partial<WatchlistCollectionsSnapshot>;
    if (parsed.v !== 2 || !Array.isArray(parsed.lists) || parsed.lists.length === 0) {
      return migrateLegacyCollections(userId);
    }
    const lists = parsed.lists
      .map((list) =>
        normalizeCollection({
          id: String(list.id ?? ""),
          name: String(list.name ?? DEFAULT_WATCHLIST_DISPLAY_NAME),
          tickers: Array.isArray(list.tickers) ? list.tickers : [],
          sections: list.sections,
          tickerSections: list.tickerSections,
        }),
      )
      .filter((list) => list.id.length > 0);
    if (!lists.length) return migrateLegacyCollections(userId);
    const activeId = lists.some((l) => l.id === parsed.activeId) ? String(parsed.activeId) : lists[0]!.id;
    const pendingRemoval = normalizeTickers(
      Array.isArray(parsed.pendingRemoval) ? parsed.pendingRemoval : [],
    );
    return {
      v: 2,
      activeId,
      lists,
      pendingRemoval,
      ...(typeof parsed.lastModifiedAt === "number" ? { lastModifiedAt: parsed.lastModifiedAt } : {}),
      ...(typeof parsed.lastSyncedAt === "number" ? { lastSyncedAt: parsed.lastSyncedAt } : {}),
    };
  } catch {
    return migrateLegacyCollections(userId);
  }
}

export function writeWatchlistCollections(
  userId: string | null,
  snapshot: WatchlistCollectionsSnapshot,
): void {
  if (typeof window === "undefined") return;
  try {
    const lists = snapshot.lists.map((list) => normalizeCollection(list));
    const activeId = lists.some((l) => l.id === snapshot.activeId) ? snapshot.activeId : lists[0]!.id;
    const payload: WatchlistCollectionsSnapshot = {
      v: 2,
      activeId,
      lists,
      pendingRemoval: normalizeTickers(snapshot.pendingRemoval),
      ...(snapshot.lastModifiedAt != null ? { lastModifiedAt: snapshot.lastModifiedAt } : {}),
      ...(snapshot.lastSyncedAt != null ? { lastSyncedAt: snapshot.lastSyncedAt } : {}),
    };
    localStorage.setItem(storageKeyForUser(userId), JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

/** Drop guest/offline copies so signed-in state cannot be resurrected on remount. */
export function clearGuestWatchlistStorage(userId?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(storageKeyForUser(null));
    localStorage.removeItem(LEGACY_GUEST_STORAGE_KEY);
    localStorage.removeItem(LEGACY_GLOBAL_STORAGE_KEY);
    if (userId) {
      localStorage.removeItem(`${LEGACY_GLOBAL_STORAGE_KEY}.u.${userId}`);
    }
  } catch {
    /* quota, private mode */
  }
}

/**
 * One-time migration when a guest session signs in.
 * Never merges guest tickers over an existing signed-in watchlist.
 */
export function mergeGuestWatchlistOnSignIn(userId: string): WatchlistCollectionsSnapshot {
  const guest = readWatchlistCollections(null);
  const user = readWatchlistCollections(userId);
  const guestActive = getActiveWatchlistCollection(guest);
  const userActive = getActiveWatchlistCollection(user);
  const guestTickers = unionWatchlistTickers(guest);
  const userTickers = unionWatchlistTickers(user);
  const guestLayout = {
    sections: guestActive.sections,
    tickerSections: guestActive.tickerSections,
  };
  const userLayout = {
    sections: userActive.sections,
    tickerSections: userActive.tickerSections,
  };
  const guestHasSections = serverHasSectionsLayout(guestLayout);

  clearGuestWatchlistStorage(userId);

  if (guestTickers.length === 0 && !guestHasSections) return user;

  const mergeGuestActiveIntoUserList = (list: WatchlistCollection): WatchlistCollection => {
    if (list.id !== userActive.id) return list;
    return normalizeCollection({
      id: list.id,
      name: guestActive.name,
      tickers: guestActive.tickers.length > 0 ? guestActive.tickers : list.tickers,
      sections: guestActive.sections,
      tickerSections: guestActive.tickerSections,
    });
  };

  if (userTickers.length === 0) {
    const lists = user.lists.map(mergeGuestActiveIntoUserList);
    const next: WatchlistCollectionsSnapshot = {
      v: 2,
      activeId: user.activeId,
      lists,
      pendingRemoval: [],
    };
    writeWatchlistCollections(userId, next);
    return next;
  }

  if (guestHasSections && !sectionsLayoutsEqual(guestLayout, userLayout)) {
    const lists = user.lists.map(mergeGuestActiveIntoUserList);
    const next: WatchlistCollectionsSnapshot = {
      v: 2,
      activeId: user.activeId,
      lists,
      pendingRemoval: user.pendingRemoval,
    };
    writeWatchlistCollections(userId, next);
    return next;
  }

  return user;
}

/** Signed-in bootstrap: read the user's snapshot and discard stale guest copies. */
export function loadAuthenticatedWatchlistCollections(userId: string): WatchlistCollectionsSnapshot {
  clearGuestWatchlistStorage(userId);
  return readWatchlistCollections(userId);
}

export function getActiveWatchlistCollection(
  snapshot: WatchlistCollectionsSnapshot,
): WatchlistCollection {
  return snapshot.lists.find((l) => l.id === snapshot.activeId) ?? snapshot.lists[0]!;
}

/** Keep activeId aligned with lists (e.g. after server id remap). */
export function ensureSnapshotActiveId(
  snapshot: WatchlistCollectionsSnapshot,
): WatchlistCollectionsSnapshot {
  if (!snapshot.lists.length) return snapshot;
  if (snapshot.lists.some((list) => list.id === snapshot.activeId)) return snapshot;
  return { ...snapshot, activeId: snapshot.lists[0]!.id };
}

/** When the active list is empty but another list has tickers, show the populated list. */
export function preferPopulatedActiveWatchlist(
  snapshot: WatchlistCollectionsSnapshot,
): WatchlistCollectionsSnapshot {
  const aligned = ensureSnapshotActiveId(snapshot);
  if (!aligned.lists.length) return aligned;

  const active = getActiveWatchlistCollection(aligned);
  if (active.tickers.length > 0) return aligned;

  const populated = aligned.lists.filter((list) => list.tickers.length > 0);
  if (!populated.length) return aligned;

  const best = populated.reduce((current, candidate) =>
    candidate.tickers.length > current.tickers.length ? candidate : current,
  );
  if (best.id === aligned.activeId) return aligned;
  return { ...aligned, activeId: best.id };
}

/** Resolve a collection id after server/local id drift; falls back to the active list. */
export function resolveWatchlistCollectionId(
  snapshot: WatchlistCollectionsSnapshot,
  collectionId: string,
): string | null {
  if (snapshot.lists.some((list) => list.id === collectionId)) return collectionId;
  const active = getActiveWatchlistCollection(snapshot);
  return active?.id ?? null;
}

export function updateActiveWatchlistTickers(
  userId: string | null,
  tickers: string[],
  pendingRemoval: string[],
): WatchlistCollectionsSnapshot {
  const snapshot = readWatchlistCollections(userId);
  const active = getActiveWatchlistCollection(snapshot);
  const lists = snapshot.lists.map((list) =>
    list.id === active.id ? { ...list, tickers: normalizeTickers(tickers) } : list,
  );
  const next = {
    ...snapshot,
    lists,
    pendingRemoval: normalizeTickers(pendingRemoval),
  };
  writeWatchlistCollections(userId, next);
  return next;
}

export function createWatchlistCollection(
  userId: string | null,
  name: string,
  currentTickers: string[],
  pendingRemoval: string[],
): WatchlistCollectionsSnapshot {
  const trimmed = name.trim();
  if (!trimmed) return readWatchlistCollections(userId);

  let snapshot = updateActiveWatchlistTickers(userId, currentTickers, pendingRemoval);
  const id = newWatchlistCollectionId();
  snapshot = {
    ...snapshot,
    activeId: id,
    lists: [...snapshot.lists, withSectionLayout({ id, name: trimmed, tickers: [] })],
    pendingRemoval: [],
  };
  writeWatchlistCollections(userId, snapshot);
  return snapshot;
}

export function renameActiveWatchlistCollection(
  userId: string | null,
  name: string,
): WatchlistCollectionsSnapshot {
  const trimmed = name.trim();
  if (!trimmed) return readWatchlistCollections(userId);
  const snapshot = readWatchlistCollections(userId);
  const active = getActiveWatchlistCollection(snapshot);
  const next = {
    ...snapshot,
    lists: snapshot.lists.map((list) => (list.id === active.id ? { ...list, name: trimmed } : list)),
  };
  writeWatchlistCollections(userId, next);
  return next;
}

export function switchWatchlistCollection(userId: string | null, id: string): WatchlistCollectionsSnapshot | null {
  const snapshot = readWatchlistCollections(userId);
  if (!snapshot.lists.some((l) => l.id === id)) return null;
  const next = { ...snapshot, activeId: id, pendingRemoval: [] };
  writeWatchlistCollections(userId, next);
  return next;
}

/** Persist the active list's tickers, then switch activeId (in-memory; does not read localStorage). */
export function prepareWatchlistSwitch(
  snapshot: WatchlistCollectionsSnapshot,
  currentActiveTickers: string[],
  targetCollectionId: string,
): WatchlistCollectionsSnapshot | null {
  if (!snapshot.lists.some((list) => list.id === targetCollectionId)) return null;
  if (snapshot.activeId === targetCollectionId) return snapshot;

  const lists = snapshot.lists.map((list) =>
    list.id === snapshot.activeId
      ? { ...list, tickers: normalizeTickers(currentActiveTickers) }
      : list,
  );
  return {
    v: 2,
    activeId: targetCollectionId,
    lists,
    pendingRemoval: [],
  };
}

export function unionWatchlistTickers(snapshot: WatchlistCollectionsSnapshot): string[] {
  return normalizeTickers(snapshot.lists.flatMap((list) => list.tickers));
}

export function allLocalListsHaveIdenticalTickerSets(
  snapshot: WatchlistCollectionsSnapshot,
): boolean {
  if (snapshot.lists.length < 2) return false;
  const signatures = snapshot.lists.map((list) => [...list.tickers].sort().join("|"));
  const nonEmpty = signatures.filter((signature) => signature.length > 0);
  return nonEmpty.length > 1 && new Set(nonEmpty).size === 1;
}

function primaryListIdForDuplicateRepair(
  snapshot: WatchlistCollectionsSnapshot,
): string | null {
  const byName = (name: string) =>
    snapshot.lists.find((list) => list.name.toLowerCase() === name)?.id ?? null;
  return byName("main") ?? byName("watchlist") ?? snapshot.lists[0]?.id ?? null;
}

/** When every list has the same full ticker set, keep only the primary list's copy. */
export function clearDuplicateWatchlistTickerCopies(
  snapshot: WatchlistCollectionsSnapshot,
): WatchlistCollectionsSnapshot {
  if (!allLocalListsHaveIdenticalTickerSets(snapshot)) return snapshot;
  const primaryId = primaryListIdForDuplicateRepair(snapshot);
  if (!primaryId) return snapshot;
  return {
    ...snapshot,
    lists: snapshot.lists.map((list) => ({
      ...list,
      tickers: list.id === primaryId ? list.tickers : [],
    })),
  };
}

export function isTickerInAnyCollection(
  snapshot: WatchlistCollectionsSnapshot,
  storageKey: string,
): boolean {
  const watched = new Set(unionWatchlistTickers(snapshot));
  return isWatchlistTickerWatched(watched, storageKey);
}

/** Write the active list's tickers into an in-memory snapshot (does not touch localStorage). */
export function persistActiveListTickers(
  snapshot: WatchlistCollectionsSnapshot,
  tickers: string[],
): WatchlistCollectionsSnapshot {
  const lists = snapshot.lists.map((list) =>
    list.id === snapshot.activeId ? { ...list, tickers: normalizeTickers(tickers) } : list,
  );
  return { ...snapshot, lists };
}

export function renameCollectionInSnapshot(
  snapshot: WatchlistCollectionsSnapshot,
  collectionId: string,
  name: string,
): WatchlistCollectionsSnapshot | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  if (!snapshot.lists.some((list) => list.id === collectionId)) return null;
  return {
    ...snapshot,
    lists: snapshot.lists.map((list) =>
      list.id === collectionId ? { ...list, name: trimmed } : list,
    ),
  };
}

export function setCollectionTickersOrder(
  snapshot: WatchlistCollectionsSnapshot,
  collectionId: string,
  tickers: string[],
): WatchlistCollectionsSnapshot | null {
  if (!snapshot.lists.some((list) => list.id === collectionId)) return null;
  return {
    ...snapshot,
    lists: snapshot.lists.map((list) =>
      list.id === collectionId ? { ...list, tickers: normalizeTickers(tickers) } : list,
    ),
  };
}

export function moveTickerInCollection(
  snapshot: WatchlistCollectionsSnapshot,
  collectionId: string,
  fromIndex: number,
  toIndex: number,
): WatchlistCollectionsSnapshot | null {
  const list = snapshot.lists.find((entry) => entry.id === collectionId);
  if (!list) return null;
  if (fromIndex < 0 || fromIndex >= list.tickers.length) return null;
  if (toIndex < 0 || toIndex >= list.tickers.length) return null;
  if (fromIndex === toIndex) return snapshot;

  const tickers = [...list.tickers];
  const [moved] = tickers.splice(fromIndex, 1);
  if (!moved) return null;
  tickers.splice(toIndex, 0, moved);
  return setCollectionTickersOrder(snapshot, collectionId, tickers);
}

function computeSectionAppendIndex(list: WatchlistCollection, sectionId: string): number {
  if (!list.tickers.length) return 0;

  let lastInSection = -1;
  for (let i = 0; i < list.tickers.length; i++) {
    const key = normalizeWatchlistStorageKey(list.tickers[i]!);
    if (list.tickerSections[key] === sectionId) lastInSection = i;
  }
  if (lastInSection >= 0) return Math.min(lastInSection + 1, list.tickers.length - 1);

  const sectionIndex = list.sections.findIndex((section) => section.id === sectionId);
  if (sectionIndex <= 0) {
    let lastUnsectioned = -1;
    for (let i = 0; i < list.tickers.length; i++) {
      const key = normalizeWatchlistStorageKey(list.tickers[i]!);
      if (!list.tickerSections[key]) lastUnsectioned = i;
    }
    if (lastUnsectioned >= 0) return Math.min(lastUnsectioned + 1, list.tickers.length - 1);
    return list.tickers.length - 1;
  }

  const precedingSectionIds = new Set(list.sections.slice(0, sectionIndex).map((section) => section.id));
  let lastPreceding = -1;
  for (let i = 0; i < list.tickers.length; i++) {
    const key = normalizeWatchlistStorageKey(list.tickers[i]!);
    const assignedSectionId = list.tickerSections[key];
    if (assignedSectionId && precedingSectionIds.has(assignedSectionId)) lastPreceding = i;
  }
  if (lastPreceding >= 0) return Math.min(lastPreceding + 1, list.tickers.length - 1);
  return list.tickers.length - 1;
}

function setTickerSectionAssignment(
  snapshot: WatchlistCollectionsSnapshot,
  collectionId: string,
  tickerKey: string,
  sectionId: string | null,
): WatchlistCollectionsSnapshot {
  return {
    ...snapshot,
    lists: snapshot.lists.map((entry) => {
      if (entry.id !== collectionId) return entry;
      const nextTickerSections = { ...entry.tickerSections };
      if (sectionId == null) {
        delete nextTickerSections[tickerKey];
      } else {
        nextTickerSections[tickerKey] = sectionId;
      }
      return { ...entry, tickerSections: nextTickerSections };
    }),
  };
}

export function applyWatchlistItemMove(
  snapshot: WatchlistCollectionsSnapshot,
  collectionId: string,
  fromIndex: number,
  target:
    | { kind: "row"; toIndex: number; sectionId: string | null }
    | { kind: "section"; sectionId: string },
): WatchlistCollectionsSnapshot | null {
  const list = snapshot.lists.find((entry) => entry.id === collectionId);
  if (!list || fromIndex < 0 || fromIndex >= list.tickers.length) return null;

  const sectionId = target.kind === "row" ? target.sectionId : target.sectionId;
  const toIndex =
    target.kind === "row"
      ? target.toIndex
      : computeSectionAppendIndex(list, target.sectionId);
  const clampedToIndex = Math.max(0, Math.min(toIndex, list.tickers.length - 1));
  const tickerKey = normalizeWatchlistStorageKey(list.tickers[fromIndex]!);

  if (fromIndex === clampedToIndex) {
    return setTickerSectionAssignment(snapshot, collectionId, tickerKey, sectionId);
  }

  const moved = moveTickerInCollection(snapshot, collectionId, fromIndex, clampedToIndex);
  if (!moved) return null;
  return setTickerSectionAssignment(moved, collectionId, tickerKey, sectionId);
}

export function addTickerToSnapshot(
  snapshot: WatchlistCollectionsSnapshot,
  collectionId: string,
  storageKey: string,
): WatchlistCollectionsSnapshot | null {
  if (!snapshot.lists.some((list) => list.id === collectionId)) return null;
  const lists = snapshot.lists.map((list) => {
    if (list.id !== collectionId) return list;
    return { ...list, tickers: normalizeTickers([...list.tickers, storageKey]) };
  });
  return { ...snapshot, lists };
}

function withoutTickerSectionAssignments(
  tickerSections: Record<string, string>,
  storageKey: string,
): Record<string, string> {
  const drop = new Set(
    watchlistRemovalCandidateKeys(storageKey).map(normalizeWatchlistStorageKey),
  );
  const next = { ...tickerSections };
  for (const key of Object.keys(next)) {
    if (drop.has(normalizeWatchlistStorageKey(key))) {
      delete next[key];
    }
  }
  return next;
}

export function removeTickerFromSnapshot(
  snapshot: WatchlistCollectionsSnapshot,
  collectionId: string,
  storageKey: string,
): WatchlistCollectionsSnapshot | null {
  if (!snapshot.lists.some((list) => list.id === collectionId)) return null;
  const lists = snapshot.lists.map((list) => {
    if (list.id !== collectionId) return list;
    return {
      ...list,
      tickers: normalizeTickers([...removeWatchlistTickerFromSet(new Set(list.tickers), storageKey)]),
      tickerSections: withoutTickerSectionAssignments(list.tickerSections, storageKey),
    };
  });
  return { ...snapshot, lists };
}

export function removeTickerFromAllInSnapshot(
  snapshot: WatchlistCollectionsSnapshot,
  storageKey: string,
): WatchlistCollectionsSnapshot {
  const lists = snapshot.lists.map((list) => ({
    ...list,
    tickers: normalizeTickers([...removeWatchlistTickerFromSet(new Set(list.tickers), storageKey)]),
    tickerSections: withoutTickerSectionAssignments(list.tickerSections, storageKey),
  }));
  return { ...snapshot, lists };
}

export function addTickerToCollection(
  userId: string | null,
  collectionId: string,
  storageKey: string,
): WatchlistCollectionsSnapshot | null {
  const next = addTickerToSnapshot(readWatchlistCollections(userId), collectionId, storageKey);
  if (!next) return null;
  writeWatchlistCollections(userId, next);
  return next;
}

export function removeTickerFromCollection(
  userId: string | null,
  collectionId: string,
  storageKey: string,
): WatchlistCollectionsSnapshot | null {
  const next = removeTickerFromSnapshot(readWatchlistCollections(userId), collectionId, storageKey);
  if (!next) return null;
  writeWatchlistCollections(userId, next);
  return next;
}

export function removeTickerFromAllCollections(
  userId: string | null,
  storageKey: string,
): WatchlistCollectionsSnapshot {
  const next = removeTickerFromAllInSnapshot(readWatchlistCollections(userId), storageKey);
  writeWatchlistCollections(userId, next);
  return next;
}

export function importServerTickersIntoCollections(
  userId: string | null,
  serverTickers: string[],
): WatchlistCollectionsSnapshot | null {
  const snapshot = readWatchlistCollections(userId);
  const known = new Set(unionWatchlistTickers(snapshot));
  const pending = new Set(snapshot.pendingRemoval.map(normalizeWatchlistStorageKey));
  const toAdd = serverTickers
    .map(normalizeWatchlistStorageKey)
    .filter((t) => t.length > 0 && !known.has(t) && !pending.has(t));
  if (!toAdd.length) return null;

  const active = getActiveWatchlistCollection(snapshot);
  const lists = snapshot.lists.map((list) =>
    list.id === active.id
      ? { ...list, tickers: normalizeTickers([...list.tickers, ...toAdd]) }
      : list,
  );
  const next = { ...snapshot, lists };
  writeWatchlistCollections(userId, next);
  return next;
}

export function deleteActiveWatchlistCollection(
  userId: string | null,
  currentTickers: string[],
  pendingRemoval: string[],
): { snapshot: WatchlistCollectionsSnapshot; removedTickers: string[] } {
  let snapshot = updateActiveWatchlistTickers(userId, currentTickers, pendingRemoval);
  const active = getActiveWatchlistCollection(snapshot);
  const removedTickers = [...active.tickers];
  let lists = snapshot.lists.filter((list) => list.id !== active.id);
  if (!lists.length) {
    const id = newWatchlistCollectionId();
    lists = [withSectionLayout({ id, name: DEFAULT_WATCHLIST_DISPLAY_NAME, tickers: [] })];
    snapshot = { v: 2, activeId: id, lists, pendingRemoval: [] };
  } else {
    snapshot = {
      ...snapshot,
      lists,
      activeId: lists[0]!.id,
      pendingRemoval: [],
    };
  }
  writeWatchlistCollections(userId, snapshot);
  return { snapshot, removedTickers };
}

export function addSectionToCollection(
  snapshot: WatchlistCollectionsSnapshot,
  collectionId: string,
  name: string,
): WatchlistCollectionsSnapshot | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const list = snapshot.lists.find((entry) => entry.id === collectionId);
  if (!list) return null;
  if (list.sections.some((section) => sectionNamesMatch(section.name, trimmed))) return null;

  const section: WatchlistSection = { id: newWatchlistSectionId(), name: trimmed };
  return {
    ...snapshot,
    lists: snapshot.lists.map((entry) =>
      entry.id === collectionId ? { ...entry, sections: [...entry.sections, section] } : entry,
    ),
  };
}

export function renameSectionInCollection(
  snapshot: WatchlistCollectionsSnapshot,
  collectionId: string,
  sectionId: string,
  name: string,
): WatchlistCollectionsSnapshot | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const list = snapshot.lists.find((entry) => entry.id === collectionId);
  if (!list) return null;
  if (!list.sections.some((section) => section.id === sectionId)) return null;
  if (
    list.sections.some(
      (section) => section.id !== sectionId && sectionNamesMatch(section.name, trimmed),
    )
  ) {
    return null;
  }

  return {
    ...snapshot,
    lists: snapshot.lists.map((entry) =>
      entry.id === collectionId
        ? {
            ...entry,
            sections: entry.sections.map((section) =>
              section.id === sectionId ? { ...section, name: trimmed } : section,
            ),
          }
        : entry,
    ),
  };
}

function reorderTickersForSectionOrder(
  tickers: string[],
  tickerSections: Record<string, string>,
  sections: WatchlistSection[],
): string[] {
  const unsectioned: string[] = [];
  const bySection = new Map(sections.map((section) => [section.id, [] as string[]]));

  for (const ticker of tickers) {
    const key = normalizeWatchlistStorageKey(ticker);
    const sectionId = tickerSections[key];
    if (sectionId && bySection.has(sectionId)) {
      bySection.get(sectionId)!.push(ticker);
      continue;
    }
    unsectioned.push(ticker);
  }

  const ordered: string[] = [...unsectioned];
  for (const section of sections) {
    ordered.push(...(bySection.get(section.id) ?? []));
  }
  return normalizeTickers(ordered);
}

export function moveSectionInCollection(
  snapshot: WatchlistCollectionsSnapshot,
  collectionId: string,
  fromSectionIndex: number,
  toSectionIndex: number,
): WatchlistCollectionsSnapshot | null {
  const list = snapshot.lists.find((entry) => entry.id === collectionId);
  if (!list) return null;
  if (fromSectionIndex < 0 || fromSectionIndex >= list.sections.length) return null;
  if (toSectionIndex < 0 || toSectionIndex >= list.sections.length) return null;
  if (fromSectionIndex === toSectionIndex) return snapshot;

  const sections = [...list.sections];
  const [moved] = sections.splice(fromSectionIndex, 1);
  if (!moved) return null;
  sections.splice(toSectionIndex, 0, moved);

  const tickers = reorderTickersForSectionOrder(list.tickers, list.tickerSections, sections);

  return {
    ...snapshot,
    lists: snapshot.lists.map((entry) =>
      entry.id === collectionId ? { ...entry, sections, tickers } : entry,
    ),
  };
}

export function deleteSectionFromCollection(
  snapshot: WatchlistCollectionsSnapshot,
  collectionId: string,
  sectionId: string,
): WatchlistCollectionsSnapshot | null {
  const list = snapshot.lists.find((entry) => entry.id === collectionId);
  if (!list) return null;
  const sectionIndex = list.sections.findIndex((section) => section.id === sectionId);
  if (sectionIndex < 0) return null;

  const targetSectionId =
    sectionIndex > 0 ? list.sections[sectionIndex - 1]!.id : null;
  const nextTickerSections: Record<string, string> = { ...list.tickerSections };

  for (const [ticker, assignedSectionId] of Object.entries(nextTickerSections)) {
    if (assignedSectionId !== sectionId) continue;
    if (targetSectionId) {
      nextTickerSections[ticker] = targetSectionId;
    } else {
      delete nextTickerSections[ticker];
    }
  }

  return {
    ...snapshot,
    lists: snapshot.lists.map((entry) =>
      entry.id === collectionId
        ? {
            ...entry,
            sections: entry.sections.filter((section) => section.id !== sectionId),
            tickerSections: nextTickerSections,
          }
        : entry,
    ),
  };
}
