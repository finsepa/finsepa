"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { readSupabaseSession } from "@/lib/supabase/safe-auth";
import type { SearchAssetItem } from "@/lib/search/search-types";
import {
  mergeRecentSearchLists,
  readRecentSearches,
  recordSearchNavigation,
  removeRecentSearchById,
  writeRecentSearches,
  type RecentSearchStoredItem,
} from "@/lib/search/recent-searches-storage";

async function fetchServerRecent(): Promise<RecentSearchStoredItem[] | null> {
  try {
    const res = await fetch("/api/search/recent", { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { items?: unknown };
    return Array.isArray(data.items) ? (data.items as RecentSearchStoredItem[]) : [];
  } catch {
    return null;
  }
}

async function putServerRecent(
  items: RecentSearchStoredItem[],
  removedIds: string[] = [],
): Promise<RecentSearchStoredItem[] | null> {
  try {
    const res = await fetch("/api/search/recent", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, removedIds }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { items?: unknown };
    return Array.isArray(data.items) ? (data.items as RecentSearchStoredItem[]) : items;
  } catch {
    return null;
  }
}

/** Resolves the signed-in user id and exposes per-user recent-search helpers (local + cloud). */
export function useSearchRecentStorage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [syncEpoch, setSyncEpoch] = useState(0);
  const syncingRef = useRef(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    void (async () => {
      try {
        const session = await readSupabaseSession(supabase);
        setUserId(session?.user?.id ?? null);
        setAuthReady(true);
      } catch {
        setUserId(null);
        setAuthReady(true);
      }
    })();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
      setAuthReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  /** Pull server history and merge with local so prod ↔ local stays in sync. */
  useEffect(() => {
    if (!authReady || !userId) return;
    let cancelled = false;
    void (async () => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      try {
        const server = await fetchServerRecent();
        if (cancelled || server == null) return;
        const local = readRecentSearches(userId);
        const merged = mergeRecentSearchLists(local, server);
        writeRecentSearches(merged, userId);
        const saved = await putServerRecent(merged);
        if (cancelled) return;
        if (saved) writeRecentSearches(saved, userId);
        setSyncEpoch((n) => n + 1);
      } finally {
        syncingRef.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, userId]);

  const readRecent = useCallback(() => {
    if (!authReady) return [];
    void syncEpoch;
    return readRecentSearches(userId);
  }, [authReady, userId, syncEpoch]);

  const recordRecent = useCallback(
    (item: SearchAssetItem) => {
      if (!authReady) return;
      const next = recordSearchNavigation(item, userId);
      setSyncEpoch((n) => n + 1);
      if (!userId) return;
      void putServerRecent(next).then((saved) => {
        if (!saved) return;
        writeRecentSearches(saved, userId);
        setSyncEpoch((n) => n + 1);
      });
    },
    [authReady, userId],
  );

  const removeRecent = useCallback(
    (id: string) => {
      if (!authReady) return;
      const next = removeRecentSearchById(id, userId);
      setSyncEpoch((n) => n + 1);
      if (!userId) return;
      void putServerRecent(next, [id]).then((saved) => {
        if (!saved) return;
        writeRecentSearches(saved, userId);
        setSyncEpoch((n) => n + 1);
      });
    },
    [authReady, userId],
  );

  return { userId, authReady, readRecent, recordRecent, removeRecent };
}
