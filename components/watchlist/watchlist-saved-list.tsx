"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
      <p className="text-sm leading-6 text-[#71717A]">Loading…</p>
    );
  }

  if (error) {
    return <p className="text-sm leading-6 text-[#B91C1C]">{error}</p>;
  }

  if (!items?.length) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-[#E4E4E7] bg-white px-6 py-12 text-center">
        <p className="text-[14px] font-medium text-[#09090B]">No saved symbols yet</p>
        <p className="mt-2 max-w-sm text-sm leading-6 text-[#71717A]">
          Add stocks from the screener or a stock page with the star. They will show up here.
        </p>
        <Link
          href="/screener"
          className="mt-6 text-sm font-semibold text-[#09090B] underline decoration-[#E4E4E7] underline-offset-4 transition-colors hover:decoration-[#A1A1AA]"
        >
          Go to screener
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#E4E4E7] bg-white">
      <div className="border-b border-[#E4E4E7] px-4 py-3 text-[14px] font-semibold leading-5 text-[#71717A]">
        Your watchlist
      </div>
      <ul className="divide-y divide-[#E4E4E7]">
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
                  <div className="truncate text-[14px] font-semibold leading-5 text-[#09090B]">{meta.displayName}</div>
                  <div className="text-[12px] font-normal leading-4 text-[#71717A]">{ticker}</div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
