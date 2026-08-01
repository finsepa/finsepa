"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { emptyDescriptionClassName, emptyTitleClassName } from "@/components/ui/empty";
import type { WatchlistRow } from "@/lib/watchlist/types";
import { getWatchlistTickerMeta } from "@/lib/watchlist/ticker-meta";

export function WatchlistSavedList() {
  const [items, setItems] = useState<WatchlistRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/watchlist", { credentials: "include" });
        if (!res.ok) {
          if (!cancelled) setError("Could not load watchlist.");
          return;
        }
        const data = (await res.json()) as { items?: WatchlistRow[] };
        if (!cancelled) {
          setItems(Array.isArray(data.items) ? data.items : []);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Could not load watchlist.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (items === null && !error) {
    return (
      <p className="text-sm leading-6 text-fg-muted">Loading…</p>
    );
  }

  if (error) {
    return <p className="text-sm leading-6 text-down">{error}</p>;
  }

  if (!items?.length) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-stroke bg-surface px-6 py-12 text-center">
        <p className={emptyTitleClassName}>No saved symbols yet</p>
        <p className={`mt-1 max-w-sm ${emptyDescriptionClassName}`}>
          Add stocks from the screener or a stock page with the star. They will show up here.
        </p>
        <Link
          href="/screener"
          className="mt-6 text-sm font-semibold text-fg underline decoration-stroke underline-offset-4 transition-colors hover:decoration-fg-subtle"
        >
          Go to screener
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-stroke bg-surface">
      <div className="border-b border-stroke px-4 py-3 text-[14px] font-semibold leading-5 text-fg-muted">
        Your watchlist
      </div>
      <ul className="divide-y divide-stroke">
        {items.map((row) => {
          const ticker = row.ticker.trim().toUpperCase();
          const meta = getWatchlistTickerMeta(ticker);
          return (
            <li key={row.id}>
              <Link
                href={`/stock/${encodeURIComponent(row.ticker)}`}
                className="flex h-[60px] max-h-[60px] items-center gap-3 px-4 transition-colors duration-75 hover:bg-neutral-50"
              >
                <div className={meta.frameClass} aria-hidden>
                  {meta.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold leading-5 text-fg">{meta.displayName}</div>
                  <div className="text-[12px] font-normal leading-4 text-fg-muted">{ticker}</div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
