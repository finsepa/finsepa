"use client";

import { useCallback, useEffect, useState } from "react";

import { readWatchlistLocal, writeWatchlistLocal } from "@/lib/watchlist/local-storage";

function normalizeTicker(t: string): string {
  return t.trim().toUpperCase();
}

const DEBUG = process.env.NODE_ENV === "development";

function wlLog(...args: unknown[]) {
  if (DEBUG) console.info("[watchlist client]", ...args);
}

/**
 * watched = localStorage ∪ Supabase (merged on load). Best-effort POST/DELETE; UI does not revert on API failure.
 */
export function useWatchlist() {
  const [watched, setWatched] = useState<Set<string>>(() => new Set());
  const [loaded, setLoaded] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const tickers = readWatchlistLocal();
    wlLog("hydrate from localStorage", { count: tickers.length, tickers });
    setWatched(new Set(tickers));
    setHydrated(true);
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
          wlLog("GET /api/watchlist ok", {
            serverCount: server.size,
            warning: data.warning,
            storage: data.warning ? "local+server_merge" : "server",
          });
          setWatched((prev) => {
            const merged = new Set(prev);
            for (const t of server) merged.add(t);
            wlLog("merge server into watched", { prev: [...prev], merged: [...merged] });
            return merged;
          });
        } else {
          wlLog("GET /api/watchlist failed", { status: res.status });
        }
      } catch (e) {
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
    writeWatchlistLocal([...watched]);
    wlLog("persist watched → localStorage", { count: watched.size });
  }, [watched, hydrated]);

  const toggleTicker = useCallback((ticker: string) => {
    const key = normalizeTicker(ticker);
    let wasWatched = false;

    setWatched((prev) => {
      wasWatched = prev.has(key);
      const next = new Set(prev);
      if (wasWatched) next.delete(key);
      else next.add(key);
      return next;
    });

    wlLog("toggle add/remove", { key, wasWatched, action: wasWatched ? "DELETE" : "POST" });

    void (async () => {
      try {
        if (wasWatched) {
          const res = await fetch(`/api/watchlist?ticker=${encodeURIComponent(key)}`, {
            method: "DELETE",
            credentials: "include",
          });
          if (!res.ok) {
            wlLog("DELETE /api/watchlist failed", { status: res.status, body: await res.text().catch(() => "") });
          }
        } else {
          const res = await fetch("/api/watchlist", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ticker: key }),
          });
          if (!res.ok) {
            wlLog("POST /api/watchlist failed", { status: res.status, body: await res.text().catch(() => "") });
          }
        }
      } catch (e) {
        wlLog("toggle API error (UI unchanged)", e);
      }
    })();
  }, []);

  return { watched, loaded, toggleTicker };
}
