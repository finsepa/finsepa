"use client";

import { useCallback, useEffect, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { readSupabaseSession } from "@/lib/supabase/safe-auth";
import type { SearchAssetItem } from "@/lib/search/search-types";
import {
  readRecentSearches,
  recordSearchNavigation,
  removeRecentSearchById,
} from "@/lib/search/recent-searches-storage";

/** Resolves the signed-in user id and exposes per-user recent-search helpers. */
export function useSearchRecentStorage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

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

  const readRecent = useCallback(() => {
    if (!authReady) return [];
    return readRecentSearches(userId);
  }, [authReady, userId]);

  const recordRecent = useCallback(
    (item: SearchAssetItem) => {
      if (!authReady) return;
      recordSearchNavigation(item, userId);
    },
    [authReady, userId],
  );

  const removeRecent = useCallback(
    (id: string) => {
      if (!authReady) return;
      removeRecentSearchById(id, userId);
    },
    [authReady, userId],
  );

  return { userId, authReady, readRecent, recordRecent, removeRecent };
}
