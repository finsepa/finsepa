"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpDown, ChevronDown, ChevronRight } from "lucide-react";

import { CompanyLogo } from "@/components/screener/company-logo";
import { WatchlistRowRemoveButton } from "@/components/watchlist/watchlist-star-button";
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

function WatchlistTableSkeleton() {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-t border-b border-[#E4E4E7] bg-white">
          <th className="py-3 pr-4 text-left">
            <div className="flex items-center gap-1.5 text-[14px] font-semibold leading-5 text-[#71717A]">
              Asset <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
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
        {[0, 1, 2].map((i) => (
          <tr key={i} className="h-[60px] border-b border-[#E4E4E7]">
            <td className="py-2 pr-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-neutral-200" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-32 animate-pulse rounded bg-neutral-200" />
                  <div className="h-3 w-14 animate-pulse rounded bg-neutral-100" />
                </div>
              </div>
            </td>
            {Array.from({ length: 8 }).map((_, j) => (
              <td key={j} className="px-4">
                <div className="mx-auto h-4 w-12 animate-pulse rounded bg-neutral-100" />
              </td>
            ))}
            <td className="w-10 px-4">
              <div className="mx-auto h-5 w-5 animate-pulse rounded bg-neutral-100" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GroupSection({
  label,
  rows,
  toggleTicker,
}: {
  label: string;
  rows: WatchlistEnrichedItem[];
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
                  <CompanyLogo name={row.name} logoUrl={row.logoUrl} symbol={row.symbol} />
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
              <WatchlistRowRemoveButton
                className="flex items-center justify-center"
                storageKey={row.storageKey}
                label={row.symbol}
                toggleTicker={toggleTicker}
              />
            </td>
          </tr>
        ))}
    </>
  );
}

export function WatchlistTable() {
  const { watched, toggleTicker, serverListWarning, storageHydrated } = useWatchlist();
  const watchedKey = useMemo(() => [...watched].sort().join("|"), [watched]);

  const everHadRowsRef = useRef(false);

  /** False until first enrich finishes for the current non-empty watchlist (avoids empty flash before fetch). */
  const [initialFetchDone, setInitialFetchDone] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stocks, setStocks] = useState<WatchlistEnrichedItem[]>([]);
  const [crypto, setCrypto] = useState<WatchlistEnrichedItem[]>([]);
  const [indices, setIndices] = useState<WatchlistEnrichedItem[]>([]);

  const load = useCallback(async () => {
    const tickers = [...watched];
    if (tickers.length === 0) return;

    if (everHadRowsRef.current) {
      setRefreshing(true);
    }
    setError(null);
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
        everHadRowsRef.current = false;
        setInitialFetchDone(true);
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
      const s = Array.isArray(data.stocks) ? data.stocks : [];
      const c = Array.isArray(data.crypto) ? data.crypto : [];
      const i = Array.isArray(data.indices) ? data.indices : [];
      setStocks(s);
      setCrypto(c);
      setIndices(i);
      everHadRowsRef.current = s.length + c.length + i.length > 0;
    } catch (e) {
      if (process.env.NODE_ENV === "development") console.info("[watchlist page] enrich catch", e);
      setError("Could not load watchlist.");
      setStocks([]);
      setCrypto([]);
      setIndices([]);
      everHadRowsRef.current = false;
    } finally {
      setRefreshing(false);
      setInitialFetchDone(true);
    }
  }, [watched]);

  useEffect(() => {
    if (!storageHydrated) return;
    if (watched.size === 0) {
      everHadRowsRef.current = false;
      setInitialFetchDone(false);
      setStocks([]);
      setCrypto([]);
      setIndices([]);
      setRefreshing(false);
      setError(null);
      return;
    }
    void load();
  }, [storageHydrated, watchedKey, load]);

  const hasUsableRows = stocks.length > 0 || crypto.length > 0 || indices.length > 0;
  const empty =
    storageHydrated &&
    !error &&
    stocks.length === 0 &&
    crypto.length === 0 &&
    indices.length === 0 &&
    (watched.size === 0 || initialFetchDone);
  const showBlockingSkeleton =
    storageHydrated && watched.size > 0 && !hasUsableRows && !error && !initialFetchDone;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-semibold leading-7 text-[#09090B]">Watchlist</h1>
        {refreshing && hasUsableRows ? (
          <span className="text-[12px] font-medium text-[#A1A1AA]" aria-live="polite">
            Updating…
          </span>
        ) : null}
      </div>

      {!storageHydrated ? <WatchlistTableSkeleton /> : null}

      {storageHydrated &&
      serverListWarning &&
      watched.size > 0 &&
      initialFetchDone &&
      !error &&
      !hasUsableRows ? (
        <p className="text-[13px] leading-5 text-[#A16207]" role="status">
          {serverListWarning}
        </p>
      ) : null}

      {error ? <p className="text-[14px] leading-5 text-[#B91C1C]">{error}</p> : null}

      {storageHydrated && showBlockingSkeleton ? <WatchlistTableSkeleton /> : null}

      {storageHydrated && !showBlockingSkeleton && empty ? (
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
      ) : null}

      {storageHydrated && hasUsableRows ? (
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
            <GroupSection label="Stocks" rows={stocks} toggleTicker={toggleTicker} />
            <GroupSection label="Crypto" rows={crypto} toggleTicker={toggleTicker} />
            <GroupSection label="Indices" rows={indices} toggleTicker={toggleTicker} />
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
