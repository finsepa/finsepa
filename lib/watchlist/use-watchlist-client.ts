"use client";

import { useCallback, useEffect, useState } from "react";

function normalizeTicker(t: string): string {
  return t.trim().toUpperCase();
}

/** Shared client hook for GET /api/watchlist + optimistic POST/DELETE toggles (screener, stock header, etc.). */
export function useWatchlist() {
  const [watched, setWatched] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/watchlist", { credentials: "include" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { items?: { ticker: string }[] };
        const items = Array.isArray(data.items) ? data.items : [];
        if (cancelled) return;
        setWatched(new Set(items.map((i) => normalizeTicker(i.ticker))));
      } catch {
        /* keep empty set */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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

    (async () => {
      try {
        if (wasWatched) {
          const res = await fetch(`/api/watchlist?ticker=${encodeURIComponent(key)}`, {
            method: "DELETE",
            credentials: "include",
          });
          if (!res.ok) throw new Error("delete failed");
        } else {
          const res = await fetch("/api/watchlist", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ticker: key }),
          });
          if (!res.ok) throw new Error("post failed");
        }
      } catch {
        setWatched((prev) => {
          const next = new Set(prev);
          if (wasWatched) next.add(key);
          else next.delete(key);
          return next;
        });
      }
    })();
  }, []);

  return { watched, loaded, toggleTicker };
}
