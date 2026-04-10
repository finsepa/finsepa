"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw, X } from "lucide-react";

import { eodhdCryptoSpotTickerDisplay } from "@/lib/crypto/eodhd-crypto-ticker-display";
import { CompanyLogo } from "@/components/screener/company-logo";
import { getStockDetailMetaFromTicker } from "@/lib/market/stock-detail-meta";
import { isSingleAssetMode } from "@/lib/features/single-asset";
import type { SearchAssetItem } from "@/lib/search/search-types";
import { recordSearchNavigation } from "@/lib/search/recent-searches-storage";
import { LogoSkeleton, SkeletonBox, TextSkeleton } from "@/components/markets/skeleton";

type CompareRow = {
  ticker: string;
  fullName: string | null;
  logoUrl: string | null;
  revGrowth: string;
  grossProfit: string;
  operIncome: string;
  netIncome: string;
  eps: string;
  epsGrowth: string;
  revenue: string;
};

const METRIC_HEADERS = ["Rev Growth", "Gross Profit", "Oper Income", "Net Income", "EPS", "EPS Growth", "Revenue"] as const;

const MAX_COMPARE_TICKERS = 12;

const SEARCH_DEBOUNCE_MS = 250;

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/** Session cache keyed by sorted ticker list. */
const PEERS_COMPARE_CACHE = new Map<string, CompareRow[]>();

const SPLIT_PILL_CHIP =
  "inline-flex h-9 items-stretch overflow-hidden rounded-lg border border-[#E4E4E7] bg-white text-[12px] font-semibold text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]";

/** Matches screener `StocksTableSkeleton` — full grid with logo + metric cell placeholders per row. */
const PEERS_SKEL_GRID =
  "grid grid-cols-[210px_repeat(7,minmax(0,1fr))] gap-x-2";

function PeersComparisonTableSkeleton({ rowCount }: { rowCount: number }) {
  return (
    <div className="overflow-hidden">
      <div className={`${PEERS_SKEL_GRID} items-center border-t border-b border-[#E4E4E7] bg-white px-3 py-3`}>
        <div className="flex justify-start">
          <SkeletonBox className="h-3.5 w-20 rounded" />
        </div>
        {METRIC_HEADERS.map((h) => (
          <div key={h} className="flex justify-end">
            <SkeletonBox className="h-3 w-12 rounded" />
          </div>
        ))}
      </div>
      {Array.from({ length: rowCount }).map((_, ri) => (
        <div
          key={ri}
          className={`${PEERS_SKEL_GRID} h-[60px] max-h-[60px] items-center border-b border-[#E4E4E7] px-3`}
        >
          <div className="flex min-w-0 items-center gap-3 pr-2">
            <LogoSkeleton />
            <div className="min-w-0 flex-1 space-y-1.5">
              <TextSkeleton wClass="w-[45%] max-w-[140px]" />
              <TextSkeleton wClass="w-10" hClass="h-3" />
            </div>
          </div>
          {Array.from({ length: 7 }).map((_, ci) => (
            <div key={ci} className="flex justify-end">
              <TextSkeleton wClass={ci === 2 || ci === 5 ? "w-16" : "w-12"} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

const categoryLabel: Record<SearchAssetItem["type"], string> = {
  stock: "Stock",
  crypto: "Crypto",
  index: "Index",
};

export function PeerSearchDropdownRow({ item, onPick }: { item: SearchAssetItem; onPick: (item: SearchAssetItem) => void }) {
  const sub = item.marketLabel ?? item.subtitle;
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[#09090B] transition-colors hover:bg-[#F4F4F5]"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onPick(item)}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{item.name}</div>
        <div className="truncate text-[12px] text-[#71717A]">
          {item.type === "crypto" ? eodhdCryptoSpotTickerDisplay(item.symbol) : item.symbol}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="rounded-full bg-[#F4F4F5] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[#71717A]">
          {categoryLabel[item.type]}
        </span>
        {sub ? <span className="max-w-[100px] truncate text-[11px] text-[#A1A1AA]">{sub}</span> : null}
      </div>
    </button>
  );
}

function StockPeersTabInner({
  ticker,
  initialCompareRows,
}: {
  ticker: string;
  /** From SSR — single-symbol compare row so first open avoids a client fetch when `[ticker]` only. */
  initialCompareRows?: CompareRow[] | null;
}) {
  const router = useRouter();
  const singleMode = isSingleAssetMode();
  const main = ticker.trim().toUpperCase();

  const pickerWrapRef = useRef<HTMLDivElement>(null);
  const pickerInputRef = useRef<HTMLInputElement>(null);

  const [compareTickers, setCompareTickers] = useState<string[]>(() => [main]);
  const [rows, setRows] = useState<CompareRow[] | null>(() =>
    initialCompareRows && initialCompareRows.length > 0 ? initialCompareRows : null,
  );
  const [loading, setLoading] = useState(() => !(initialCompareRows && initialCompareRows.length > 0));
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (!initialCompareRows?.length) return;
    PEERS_COMPARE_CACHE.set([main].sort().join("|"), initialCompareRows);
  }, [main, initialCompareRows]);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [searchItems, setSearchItems] = useState<SearchAssetItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const debouncedQuery = useDebouncedValue(pickerQuery, SEARCH_DEBOUNCE_MS);
  const debouncedTrim = debouncedQuery.trim();

  useEffect(() => {
    setCompareTickers([main]);
  }, [main]);

  const tickersKey = useMemo(() => [...compareTickers].sort().join("|"), [compareTickers]);

  useEffect(() => {
    if (singleMode) return;
    let cancelled = false;

    async function loadCompare() {
      const cached = PEERS_COMPARE_CACHE.get(tickersKey) ?? null;
      if (cached) {
        setRows(cached);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      setRows(null);
      try {
        const res = await fetch("/api/stocks/peers/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tickers: compareTickers }),
        });
        if (!res.ok) {
          if (!cancelled) {
            setRows([]);
            setError("Failed to load peers.");
          }
          return;
        }
        const json = (await res.json()) as { rows?: CompareRow[] };
        if (cancelled) return;
        const nextRows = Array.isArray(json.rows) ? json.rows : [];
        setRows(nextRows);
        PEERS_COMPARE_CACHE.set(tickersKey, nextRows);
      } catch {
        if (!cancelled) {
          setRows([]);
          setError("Failed to load peers.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadCompare();
    return () => {
      cancelled = true;
    };
  }, [compareTickers, singleMode]);

  const rowsByTicker = useMemo(() => {
    const m = new Map<string, CompareRow>();
    for (const r of rows ?? []) {
      m.set(r.ticker.toUpperCase(), r);
    }
    return m;
  }, [rows]);

  const handleRefresh = useCallback(() => {
    setCompareTickers([main]);
  }, [main]);

  const handleRemovePeer = useCallback((sym: string) => {
    const u = sym.toUpperCase();
    if (u === main) return;
    setCompareTickers((prev) => prev.filter((t) => t.toUpperCase() !== u));
  }, [main]);

  const onChooseAsset = useCallback(
    (item: SearchAssetItem) => {
      recordSearchNavigation(item);
      if (item.type === "stock") {
        const sym = item.symbol.trim().toUpperCase();
        setCompareTickers((prev) => {
          if (prev.some((t) => t.toUpperCase() === sym)) return prev;
          if (prev.length >= MAX_COMPARE_TICKERS) return prev;
          return [...prev, sym];
        });
      } else {
        router.push(item.route);
      }
      setPickerOpen(false);
      setPickerQuery("");
      setSearchItems([]);
    },
    [router],
  );

  useEffect(() => {
    if (!pickerOpen) return;
    pickerInputRef.current?.focus();
  }, [pickerOpen]);

  useEffect(() => {
    if (!pickerOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      const el = pickerWrapRef.current;
      if (!el || !(e.target instanceof Node) || el.contains(e.target)) return;
      setPickerOpen(false);
      setPickerQuery("");
      setSearchItems([]);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setPickerOpen(false);
        setPickerQuery("");
        setSearchItems([]);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [pickerOpen]);

  useEffect(() => {
    if (!pickerOpen || debouncedTrim.length < 1) {
      if (!debouncedTrim.length) setSearchItems([]);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    const ac = new AbortController();
    setSearchLoading(true);

    void (async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(debouncedTrim)}`, {
          signal: ac.signal,
          cache: "default",
        });
        const json = (await res.json()) as { items?: SearchAssetItem[] };
        if (cancelled) return;
        setSearchItems(Array.isArray(json.items) ? json.items : []);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        setSearchItems([]);
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [debouncedTrim, pickerOpen]);

  if (singleMode) {
    return <div className="space-y-2 pt-2 text-[#71717A]">Peers temporarily unavailable in NVDA-only mode.</div>;
  }

  const queryTrim = pickerQuery.trim();
  const showSearchPanel = queryTrim.length > 0;

  return (
    <div className="w-full min-w-0 space-y-4 pt-1">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-[24px] font-bold leading-8 tracking-tight text-[#09090B]">Comparison</h2>
        <button
          type="button"
          onClick={handleRefresh}
          aria-label="Reset comparison to this symbol only"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[#E4E4E7] bg-white text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-colors hover:bg-[#F4F4F5]"
        >
          <RefreshCw className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {compareTickers.map((sym) => {
          const isPrimary = sym.toUpperCase() === main;

          return (
            <div key={sym} className={SPLIT_PILL_CHIP}>
              <div className="flex items-center py-1 pl-2.5 pr-2">
                <span className="tabular-nums">{sym}</span>
              </div>
              {isPrimary ? null : (
                <>
                  <div className="w-px shrink-0 self-stretch bg-[#E4E4E7]" aria-hidden />
                  <button
                    type="button"
                    onClick={() => handleRemovePeer(sym)}
                    aria-label={`Remove ${sym} from comparison`}
                    className="flex w-9 shrink-0 items-center justify-center text-[#71717A] transition-colors hover:bg-neutral-50 hover:text-[#09090B]"
                  >
                    <X className="h-4 w-4" strokeWidth={2} aria-hidden />
                  </button>
                </>
              )}
            </div>
          );
        })}

        <div className="relative" ref={pickerWrapRef}>
          <button
            type="button"
            onClick={() => {
              setPickerOpen((o) => {
                if (o) {
                  setPickerQuery("");
                  setSearchItems([]);
                }
                return !o;
              });
            }}
            disabled={compareTickers.length >= MAX_COMPARE_TICKERS}
            className="inline-flex items-center gap-2 rounded-[10px] bg-[#F4F4F5] px-4 py-2 text-[14px] font-medium leading-5 text-[#09090B] transition-colors hover:bg-[#EBEBEB] disabled:pointer-events-none disabled:opacity-50"
            aria-expanded={pickerOpen}
            aria-haspopup="listbox"
          >
            <Plus className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
            Company
          </button>

          {pickerOpen ? (
            <div
              className="absolute left-0 top-full z-[200] mt-1 w-[min(calc(100vw-2rem),360px)] rounded-lg border border-[#E4E4E7] bg-white py-1 shadow-md"
              role="listbox"
              aria-label="Search assets"
            >
              <div className="border-b border-[#F4F4F5] px-2 pb-1 pt-1">
                <input
                  ref={pickerInputRef}
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                  placeholder="Search stocks, crypto, indices…"
                  className="w-full rounded-md border-0 bg-[#FAFAFA] px-2 py-1.5 text-[13px] text-[#09090B] placeholder:text-[#A1A1AA] outline-none ring-1 ring-transparent focus:ring-[#E4E4E7]"
                  aria-label="Search to add company"
                  autoComplete="off"
                  autoCorrect="off"
                />
              </div>
              <div className="max-h-[min(400px,calc(100vh-12rem))] overflow-y-auto py-1">
                {!showSearchPanel ? null : searchLoading && searchItems.length === 0 ? (
                  <p className="px-3 py-2 text-[12px] text-[#71717A]">Searching…</p>
                ) : !searchLoading && searchItems.length === 0 ? (
                  <p className="px-3 py-2 text-[12px] text-[#71717A]">No results for &ldquo;{queryTrim}&rdquo;</p>
                ) : (
                  <>
                    {searchLoading && searchItems.length > 0 ? (
                      <p className="px-3 pb-1 text-center text-[11px] text-[#A1A1AA]" aria-hidden>
                        Updating…
                      </p>
                    ) : null}
                    {searchItems.map((item) => (
                      <PeerSearchDropdownRow key={item.id} item={item} onPick={onChooseAsset} />
                    ))}
                  </>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="overflow-x-auto" aria-hidden>
          <div className="min-w-[860px] rounded-xl border border-[#E4E4E7] bg-white">
            <PeersComparisonTableSkeleton rowCount={compareTickers.length} />
          </div>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-[#E4E4E7] bg-white px-4 py-4 text-sm text-[#71717A]">{error}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse">
            <thead>
              <tr className="border-t border-b border-[#E4E4E7] bg-white">
                <th className="w-[210px] min-w-[210px] px-3 py-3 text-left text-[14px] font-semibold leading-5 text-[#71717A]">
                  Company
                </th>
                {METRIC_HEADERS.map((h) => (
                  <th key={h} className="px-3 py-3 text-right text-[14px] font-semibold leading-5 text-[#71717A]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {compareTickers.map((sym) => {
                const row = rowsByTicker.get(sym.toUpperCase());
                const meta = getStockDetailMetaFromTicker(sym);
                const displayName = row?.fullName?.trim() ? row.fullName : meta.name ?? sym;
                const displayLogo = row?.logoUrl ?? meta.logoUrl ?? null;
                return (
                  <tr
                    key={sym}
                    className="h-[60px] border-b border-[#E4E4E7] transition-colors duration-75 hover:bg-neutral-50"
                  >
                    <td className="px-3 py-3 align-middle">
                      <div className="flex items-center gap-2">
                        <CompanyLogo name={displayName} logoUrl={(displayLogo ?? "").trim()} symbol={sym} />
                        <div className="min-w-0">
                          <div className="truncate text-[14px] font-semibold leading-5 text-[#09090B]">{sym}</div>
                          <div className="truncate text-[12px] font-normal leading-4 text-[#71717A]">{displayName}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right text-[14px] font-normal leading-5 tabular-nums text-[#09090B]">
                      {row?.revGrowth ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-right text-[14px] font-normal leading-5 tabular-nums text-[#09090B]">
                      {row?.grossProfit ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-right text-[14px] font-normal leading-5 tabular-nums text-[#09090B]">
                      {row?.operIncome ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-right text-[14px] font-normal leading-5 tabular-nums text-[#09090B]">
                      {row?.netIncome ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-right text-[14px] font-normal leading-5 tabular-nums text-[#09090B]">
                      {row?.eps ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-right text-[14px] font-normal leading-5 tabular-nums text-[#09090B]">
                      {row?.epsGrowth ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-right text-[14px] font-normal leading-5 tabular-nums text-[#09090B]">
                      {row?.revenue ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export const StockPeersTab = memo(StockPeersTabInner);
