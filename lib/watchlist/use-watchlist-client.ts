"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { WATCHLIST_MUTATED_EVENT } from "@/lib/watchlist/constants";
import { readWatchlistLocalFull, writeWatchlistLocal } from "@/lib/watchlist/local-storage";

function normalizeTicker(t: string): string {
  return t.trim().toUpperCase();
}

const DEBUG = process.env.NODE_ENV === "development";

function wlLog(...args: unknown[]) {
  if (DEBUG) console.info("[watchlist client]", ...args);
}

const GUEST_KEY = "finsepa.watchlist.v1.guest";

function mergeGuestIntoUser(userId: string): string[] {
  const guest = readWatchlistLocalFull(null);
  const user = readWatchlistLocalFull(userId);
  const merged = [...new Set([...guest.tickers, ...user.tickers])];
  const pendingMerge = [...new Set([...guest.pendingRemoval, ...user.pendingRemoval])];
  if (guest.tickers.length > 0) {
    writeWatchlistLocal(merged, userId, pendingMerge);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(GUEST_KEY);
      }
    } catch {
      /* ignore */
    }
  }
  return merged;
}

/**
 * watched = localStorage (per user) ∪ Supabase (merged on load). Best-effort POST/DELETE; UI does not revert on API failure.
 */
export function useWatchlist() {
  const [watched, setWatched] = useState<Set<string>>(() => new Set());
  const [loaded, setLoaded] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  /** Tickers removed locally; server GET merge must not re-add until DELETE succeeds. */
  const [pendingRemoval, setPendingRemoval] = useState<string[]>([]);
  /** Set when GET /api/watchlist returns `warning: db_unavailable` — server list could not be loaded. */
  const [serverListWarning, setServerListWarning] = useState<string | null>(null);

  const pendingRemovalRef = useRef<string[]>([]);
  pendingRemovalRef.current = pendingRemoval;

  const userIdRef = useRef<string | null>(null);
  userIdRef.current = userId;

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        const tickers = mergeGuestIntoUser(uid);
        const full = readWatchlistLocalFull(uid);
        setPendingRemoval(full.pendingRemoval);
        setWatched(new Set(tickers.map(normalizeTicker)));
      } else {
        const full = readWatchlistLocalFull(null);
        setPendingRemoval(full.pendingRemoval);
        setWatched(new Set(full.tickers.map(normalizeTicker)));
      }
      setHydrated(true);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      const uid = nextSession?.user?.id ?? null;
      setUserId(uid);
      if (event === "SIGNED_IN" && uid) {
        const tickers = mergeGuestIntoUser(uid);
        const full = readWatchlistLocalFull(uid);
        setPendingRemoval(full.pendingRemoval);
        setWatched((prev) => {
          const merged = new Set([...tickers.map(normalizeTicker), ...prev]);
          writeWatchlistLocal([...merged], uid, full.pendingRemoval);
          return merged;
        });
      } else if (event === "SIGNED_OUT") {
        const full = readWatchlistLocalFull(null);
        setPendingRemoval(full.pendingRemoval);
        setWatched(new Set(full.tickers.map(normalizeTicker)));
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/watchlist", { credentials: "include" });
        if (cancelled) return;
        if (res.ok) {
          const data = (await res.json()) as { items?: { ticker: string }[]; warning?: string };
          const items = Array.isArray(data.items) ? data.items : [];
          const server = new Set(items.map((i) => normalizeTicker(i.ticker)));
          setServerListWarning(
            data.warning === "db_unavailable" ? "Watchlist temporarily unavailable" : null,
          );
          wlLog("GET /api/watchlist ok", {
            serverCount: server.size,
            warning: data.warning,
            storage: data.warning ? "local+server_merge" : "server",
          });
          setWatched((prev) => {
            const merged = new Set(prev);
            const pending = new Set(pendingRemovalRef.current.map(normalizeTicker));
            for (const t of server) {
              if (!pending.has(t)) merged.add(t);
            }
            wlLog("merge server into watched", {
              prev: [...prev],
              merged: [...merged],
              skippedDueToPendingRemoval: [...pending],
            });
            return merged;
          });
        } else {
          setServerListWarning(null);
          wlLog("GET /api/watchlist failed", { status: res.status });
        }
      } catch (e) {
        setServerListWarning(null);
        wlLog("GET /api/watchlist throw", e);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    writeWatchlistLocal([...watched], userId, pendingRemoval);
    wlLog("persist watched → localStorage", { count: watched.size, userId, pendingRemovalCount: pendingRemoval.length });
  }, [watched, hydrated, userId, pendingRemoval]);

  /**
   * Mirrors `watched` for toggle. Updated during render (not only in useEffect) so it cannot lag
   * behind `watched` by one frame — otherwise remove could see an empty ref and send POST instead of DELETE.
   */
  const watchedRef = useRef(watched);
  watchedRef.current = watched;

  /** `storageKey` must match `public.watchlist.ticker` (e.g. AAPL, CRYPTO:BTC). Never pass entryId or href. */
  const toggleTicker = useCallback((storageKey: string) => {
    const ticker = normalizeTicker(storageKey);
    const removing = watchedRef.current.has(ticker);

    if (removing) {
      setPendingRemoval((prev) => [...new Set([...prev, ticker])]);
    } else {
      setPendingRemoval((prev) => prev.filter((x) => x !== ticker));
    }

    setWatched((prev) => {
      const next = new Set(prev);
      if (removing) next.delete(ticker);
      else next.add(ticker);
      return next;
    });

    /** Signed-out users only get an add toast here; POST does not revert on failure. Remove sync toast is skipped because DELETE returns 401 and we revert state. */
    if (userIdRef.current == null && !removing) {
      toast.success(`${ticker} added to your watchlist.`);
    }

    void (async () => {
      try {
        if (removing) {
          wlLog("toggle → DELETE", { storageKey, ticker });
          console.info("DELETE ticker", ticker);
          const deletePath = `/api/watchlist?ticker=${encodeURIComponent(ticker)}`;
          console.info("[watchlist] DELETE /api/watchlist request", {
            storageKey,
            ticker,
            deletePath,
            fullUrl: typeof window !== "undefined" ? new URL(deletePath, window.location.origin).href : deletePath,
            credentials: "include",
          });
          const res = await fetch(deletePath, {
            method: "DELETE",
            credentials: "include",
            cache: "no-store",
          });
          const bodyText = await res.text();
          let parsed: unknown = bodyText;
          try {
            parsed = bodyText ? JSON.parse(bodyText) : null;
          } catch {
            /* keep raw */
          }
          if (res.ok) {
            console.info("[watchlist] DELETE /api/watchlist ok", { status: res.status, body: parsed });
            setPendingRemoval((prev) => prev.filter((x) => x !== ticker));
            if (userIdRef.current != null) {
              toast.success(`${ticker} removed from your watchlist.`);
            }
          } else {
            console.error("[watchlist] DELETE /api/watchlist error", { status: res.status, body: parsed });
            setPendingRemoval((prev) => prev.filter((x) => x !== ticker));
            setWatched((prev) => {
              const next = new Set(prev);
              next.add(ticker);
              return next;
            });
          }
          if (res.ok && typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent(WATCHLIST_MUTATED_EVENT, { detail: { ticker } }));
          }
        } else {
          wlLog("toggle → POST", { storageKey, ticker });
          console.info("[watchlist] POST /api/watchlist calling", {
            storageKey,
            ticker,
            credentials: "include",
          });
          const res = await fetch("/api/watchlist", {
            method: "POST",
            credentials: "include",
            cache: "no-store",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ticker }),
          });
          const bodyText = await res.text();
          let parsed: unknown = bodyText;
          try {
            parsed = bodyText ? JSON.parse(bodyText) : null;
          } catch {
            parsed = bodyText;
          }
          if (res.ok) {
            console.info("[watchlist] POST /api/watchlist ok", { status: res.status, body: parsed });
            if (userIdRef.current != null) {
              toast.success(`${ticker} added to your watchlist.`);
            }
          } else {
            console.error("[watchlist] POST /api/watchlist error", { status: res.status, body: parsed });
          }
          if (res.ok && typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent(WATCHLIST_MUTATED_EVENT, { detail: { ticker } }));
          }
        }
      } catch (e) {
        console.error("[watchlist] toggle API network error (failure)", e);
        wlLog("toggle API error (reverting remove if applicable)", e);
        if (removing) {
          setPendingRemoval((prev) => prev.filter((x) => x !== ticker));
          setWatched((prev) => {
            const next = new Set(prev);
            next.add(ticker);
            return next;
          });
        }
      }
    })();
  }, []);

  return { watched, loaded, toggleTicker, serverListWarning, storageHydrated: hydrated };
}
