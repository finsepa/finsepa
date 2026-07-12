/**
 * Development-only watchlist state replacement audit.
 * Never logs user ids, auth tokens, or full ticker lists — only counts and drag-target metadata.
 */

import {
  getActiveWatchlistCollection,
  unionWatchlistTickers,
  type WatchlistCollectionsSnapshot,
} from "@/lib/watchlist/collections";
import { normalizeWatchlistStorageKey } from "@/lib/watchlist/normalize-storage-key";

export type WatchlistStateSource =
  | "optimistic"
  | "server_refetch"
  | "server_sync_response"
  | "localStorage_bootstrap"
  | "guest"
  | "rollback"
  | "react_cache"
  | "unknown";

export type WatchlistStateAuditMeta = {
  caller: string;
  reason: string;
  source?: WatchlistStateSource;
};

type DragAuditContext = {
  storageKey: string;
  expectedIndex: number;
  expectedSectionId: string | null;
  startedAt: number;
};

let dragContext: DragAuditContext | null = null;
let optimisticDragPosition: { index: number; sectionId: string | null } | null = null;
let revertLogged = false;

function enabled(): boolean {
  return process.env.NODE_ENV === "development";
}

function dragTickerMeta(snapshot: WatchlistCollectionsSnapshot, storageKey: string | null) {
  if (!storageKey) {
    return {
      dragTicker: null as string | null,
      dragTickerIndex: null as number | null,
      dragTickerSection: null as string | null,
    };
  }
  const active = getActiveWatchlistCollection(snapshot);
  const key = normalizeWatchlistStorageKey(storageKey);
  const index = active.tickers.findIndex((ticker) => normalizeWatchlistStorageKey(ticker) === key);
  return {
    dragTicker: key,
    dragTickerIndex: index >= 0 ? index : null,
    dragTickerSection: index >= 0 ? (active.tickerSections[key] ?? null) : null,
  };
}

function positionMatchesExpected(
  snapshot: WatchlistCollectionsSnapshot,
  expected: DragAuditContext,
): boolean {
  const meta = dragTickerMeta(snapshot, expected.storageKey);
  if (meta.dragTickerIndex == null) return false;
  if (meta.dragTickerIndex !== expected.expectedIndex) return false;
  return (meta.dragTickerSection ?? null) === expected.expectedSectionId;
}

export function logWatchlistDragStart(storageKey: string, globalIndex: number, sectionId: string | null): void {
  if (!enabled()) return;
  dragContext = null;
  optimisticDragPosition = null;
  revertLogged = false;
  console.info("[watchlist-state] drag_start", {
    ts: new Date().toISOString(),
    storageKey: normalizeWatchlistStorageKey(storageKey),
    globalIndex,
    sectionId,
  });
}

export function logWatchlistDragEnd(
  storageKey: string,
  target: { kind: "row"; toIndex: number; sectionId: string | null } | { kind: "section"; sectionId: string },
): void {
  if (!enabled()) return;
  console.info("[watchlist-state] drag_end", {
    ts: new Date().toISOString(),
    storageKey: normalizeWatchlistStorageKey(storageKey),
    targetKind: target.kind,
    toIndex: target.kind === "row" ? target.toIndex : null,
    sectionId: target.kind === "row" ? target.sectionId : target.sectionId,
  });
}

/** Call after optimistic applyCollections from drag/move handlers. */
export function noteOptimisticDragResult(snapshot: WatchlistCollectionsSnapshot, storageKey: string): void {
  if (!enabled()) return;
  const key = normalizeWatchlistStorageKey(storageKey);
  const active = getActiveWatchlistCollection(snapshot);
  const index = active.tickers.findIndex((ticker) => normalizeWatchlistStorageKey(ticker) === key);
  const sectionId = index >= 0 ? (active.tickerSections[key] ?? null) : null;
  optimisticDragPosition = { index, sectionId };
  dragContext = {
    storageKey: key,
    expectedIndex: index,
    expectedSectionId: sectionId,
    startedAt: Date.now(),
  };
  console.info("[watchlist-state] drag_optimistic_applied", {
    ts: new Date().toISOString(),
    ...dragTickerMeta(snapshot, key),
  });
}

export function logWatchlistStateReplace(
  snapshot: WatchlistCollectionsSnapshot,
  meta: WatchlistStateAuditMeta,
): void {
  if (!enabled()) return;

  const active = getActiveWatchlistCollection(snapshot);
  const dragKey = dragContext?.storageKey ?? null;
  const dragMeta = dragTickerMeta(snapshot, dragKey);
  const matchesOptimistic =
    dragContext != null ? positionMatchesExpected(snapshot, dragContext) : null;
  const matchesExpected =
    optimisticDragPosition != null && dragMeta.dragTickerIndex != null
      ? dragMeta.dragTickerIndex === optimisticDragPosition.index &&
        (dragMeta.dragTickerSection ?? null) === optimisticDragPosition.sectionId
      : null;

  const payload = {
    ts: new Date().toISOString(),
    caller: meta.caller,
    reason: meta.reason,
    source: meta.source ?? "unknown",
    collectionCount: snapshot.lists.length,
    itemCount: unionWatchlistTickers(snapshot).length,
    activeItemCount: active.tickers.length,
    activeSectionCount: active.sections.length,
    fromServerSync: meta.source === "server_refetch" || meta.source === "server_sync_response",
    ...dragMeta,
    dragMatchesOptimistic: matchesOptimistic,
    dragMatchesExpectedPosition: matchesExpected,
    msSinceDragStart: dragContext ? Date.now() - dragContext.startedAt : null,
  };

  console.info("[watchlist-state] state_replace", payload);

  if (
    !revertLogged &&
    dragContext &&
    optimisticDragPosition &&
    matchesExpected === false &&
    meta.source !== "optimistic"
  ) {
    revertLogged = true;
    console.warn("[watchlist-state] FIRST_DRAG_REVERT", {
      ...payload,
      expectedIndex: dragContext.expectedIndex,
      expectedSectionId: dragContext.expectedSectionId,
      actualIndex: dragMeta.dragTickerIndex,
      actualSectionId: dragMeta.dragTickerSection,
    });
  }
}

export function logWatchlistRefetch(phase: "start" | "response", detail: string, extra?: Record<string, unknown>): void {
  if (!enabled()) return;
  console.info(`[watchlist-state] refetch_${phase}`, {
    ts: new Date().toISOString(),
    detail,
    ...extra,
  });
}

export function logWatchlistSyncRequest(phase: "start" | "response", detail: string, extra?: Record<string, unknown>): void {
  if (!enabled()) return;
  console.info(`[watchlist-state] full_sync_${phase}`, {
    ts: new Date().toISOString(),
    detail,
    ...extra,
  });
}

export function logWatchlistPatchRequest(
  phase: "start" | "response",
  detail: string,
  extra?: Record<string, unknown>,
): void {
  if (!enabled()) return;
  console.info(`[watchlist-state] patch_${phase}`, {
    ts: new Date().toISOString(),
    detail,
    ...extra,
  });
}
