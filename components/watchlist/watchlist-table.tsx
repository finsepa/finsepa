"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpDown, ChevronDown, ChevronRight } from "lucide-react";

import { CompanyLogo } from "@/components/screener/company-logo";
import { WatchlistStarToggle } from "@/components/watchlist/watchlist-star-button";
import type { WatchlistEnrichedItem } from "@/lib/watchlist/enriched-types";
import { useWatchlist } from "@/lib/watchlist/use-watchlist-client";

function formatPrice(n: number | null, kind: "stock" | "crypto" | "index"): string {
  if (n == null || !Number.isFinite(n)) return "-";
  if (kind === "crypto" && Math.abs(n) < 1) {
    return `$${n.toLocaleString("en-US", { maximumFractionDigits: 6 })}`;
  }
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ChangeCell({ value }: { value: number | null }) {
  if (value == null || !Number.isFinite(value)) {
    return <td className="px-4 text-center text-[14px] leading-5 tabular-nums text-[#71717A]">-</td>;
  }
  const positive = value >= 0;
  return (
    <td
      className={`px-4 text-center text-[14px] leading-5 tabular-nums font-medium ${
        positive ? "text-[#16A34A]" : "text-[#DC2626]"
      }`}
    >
      {positive ? "+" : ""}
      {value.toFixed(2)}%
    </td>
  );
}

function LogoMark({ name }: { name: string }) {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-100 text-[11px] font-bold text-neutral-600">
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function GroupSection({
  label,
  rows,
  watched,
  loaded,
  toggleTicker,
}: {
  label: string;
  rows: WatchlistEnrichedItem[];
  watched: Set<string>;
  loaded: boolean;
  toggleTicker: (ticker: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  if (rows.length === 0) return null;

  return (
    <>
      <tr className="border-b border-[#E4E4E7]">
        <td colSpan={10} className="bg-white px-4 py-2">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-2 text-[13px] font-medium text-[#71717A] transition-colors hover:text-[#09090B]"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {label}
          </button>
        </td>
      </tr>

      {!collapsed &&
        rows.map((row) => (
          <tr
            key={row.entryId}
            className="group h-[60px] max-h-[60px] cursor-pointer border-b border-[#E4E4E7] transition-colors duration-75 last:border-b-0 hover:bg-neutral-50"
          >
            <td className="py-0 pr-4">
              <Link href={row.href} className="flex items-center gap-3">
                {row.logoUrl ? (
                  <CompanyLogo name={row.name} logoUrl={row.logoUrl} />
                ) : (
                  <LogoMark name={row.symbol} />
                )}
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold leading-5 text-[#09090B]">{row.name}</div>
                  <div className="text-[12px] font-normal leading-4 text-[#71717A]">{row.symbol}</div>
                </div>
              </Link>
            </td>

            <td className="px-4 text-center text-[14px] font-normal tabular-nums leading-5 text-[#09090B]">
              {formatPrice(row.price, row.kind)}
            </td>

            <ChangeCell value={row.pct1d} />
            <ChangeCell value={row.pct7d} />
            <ChangeCell value={row.pct1m} />
            <ChangeCell value={row.ytd} />

            <td className="px-4 text-center text-[14px] font-normal tabular-nums leading-5 text-[#09090B]">
              {row.mcapDisplay}
            </td>
            <td className="px-4 text-center text-[14px] font-normal tabular-nums leading-5 text-[#09090B]">
              {row.peDisplay}
            </td>
            <td className="px-4 text-center text-[14px] font-normal leading-5 text-[#09090B]">{row.earningsDisplay}</td>

            <td className="w-10 px-4">
              <WatchlistStarToggle
                className="flex items-center justify-center"
                storageKey={row.storageKey}
                label={row.symbol}
                watched={watched}
                loaded={loaded}
                toggleTicker={toggleTicker}
              />
            </td>
          </tr>
        ))}
    </>
  );
}

export function WatchlistTable() {
  const { watched, loaded, toggleTicker } = useWatchlist();
  const watchedKey = useMemo(() => [...watched].sort().join("|"), [watched]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stocks, setStocks] = useState<WatchlistEnrichedItem[]>([]);
  const [crypto, setCrypto] = useState<WatchlistEnrichedItem[]>([]);
  const [indices, setIndices] = useState<WatchlistEnrichedItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const tickers = [...watched];
    try {
      if (process.env.NODE_ENV === "development") {
        console.info("[watchlist page] POST /api/watchlist/enrich", { tickers, count: tickers.length });
      }
      const res = await fetch("/api/watchlist/enrich", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        if (process.env.NODE_ENV === "development") {
          console.info("[watchlist page] enrich failed", res.status, errText);
        }
        setError("Could not load watchlist.");
        setStocks([]);
        setCrypto([]);
        setIndices([]);
        return;
      }
      const data = (await res.json()) as {
        stocks?: WatchlistEnrichedItem[];
        crypto?: WatchlistEnrichedItem[];
        indices?: WatchlistEnrichedItem[];
      };
      if (process.env.NODE_ENV === "development") {
        console.info("[watchlist page] enrich payload", {
          stocks: data.stocks?.length ?? 0,
          crypto: data.crypto?.length ?? 0,
          indices: data.indices?.length ?? 0,
        });
      }
      setStocks(Array.isArray(data.stocks) ? data.stocks : []);
      setCrypto(Array.isArray(data.crypto) ? data.crypto : []);
      setIndices(Array.isArray(data.indices) ? data.indices : []);
    } catch (e) {
      if (process.env.NODE_ENV === "development") console.info("[watchlist page] enrich catch", e);
      setError("Could not load watchlist.");
      setStocks([]);
      setCrypto([]);
      setIndices([]);
    } finally {
      setLoading(false);
    }
  }, [watched]);

  useEffect(() => {
    void load();
  }, [load, watchedKey]);

  const empty = !loading && !error && stocks.length === 0 && crypto.length === 0 && indices.length === 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-semibold leading-7 text-[#09090B]">Watchlist</h1>
      </div>

      {error ? <p className="text-[14px] leading-5 text-[#B91C1C]">{error}</p> : null}

      {loading ? (
        <p className="text-[14px] leading-5 text-[#71717A]">Loading…</p>
      ) : empty ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-[#E4E4E7] bg-white px-6 py-12 text-center">
          <p className="text-[14px] font-medium text-[#09090B]">No saved assets yet</p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-[#71717A]">
            Add stocks from the screener or a stock page, crypto from a crypto asset page, and indices from the markets
            table. They will show up here.
          </p>
          <Link
            href="/screener"
            className="mt-6 text-sm font-semibold text-[#09090B] underline decoration-[#E4E4E7] underline-offset-4 transition-colors hover:decoration-[#A1A1AA]"
          >
            Go to Markets
          </Link>
        </div>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-t border-b border-[#E4E4E7] bg-white">
              <th className="py-3 pr-4 text-left">
                <div className="flex items-center gap-1.5 text-[14px] font-semibold leading-5 text-[#71717A]">
                  Asset <ArrowUpDown className="h-3.5 w-3.5" />
                </div>
              </th>
              {["Price", "1D %", "7D %", "1M %", "YTD %", "M.Cap", "PE", "Earnings"].map((h) => (
                <th key={h} className="px-4 py-3 text-center text-[14px] font-semibold leading-5 text-[#71717A]">
                  {h}
                </th>
              ))}
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            <GroupSection label="Stocks" rows={stocks} watched={watched} loaded={loaded} toggleTicker={toggleTicker} />
            <GroupSection label="Crypto" rows={crypto} watched={watched} loaded={loaded} toggleTicker={toggleTicker} />
            <GroupSection label="Indices" rows={indices} watched={watched} loaded={loaded} toggleTicker={toggleTicker} />
          </tbody>
        </table>
      )}
    </div>
  );
}
