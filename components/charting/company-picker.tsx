"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CompanyLogo } from "@/components/screener/company-logo";
import { PeerSearchDropdownRow } from "@/components/stock/stock-peers-tab";
import { isSingleAssetMode, SINGLE_ASSET_SYMBOL } from "@/lib/features/single-asset";
import type { SearchAssetItem } from "@/lib/search/search-types";
import { recordSearchNavigation } from "@/lib/search/recent-searches-storage";
import { eodhdCryptoSpotTickerDisplay } from "@/lib/crypto/eodhd-crypto-ticker-display";
import { getCryptoLogoUrl } from "@/lib/crypto/crypto-logo-url";
import { CRYPTO_PICKER_TOP } from "@/lib/crypto/crypto-picker-universe";
import {
  companyLogoUrlForTicker,
  logoDevStockLogoUrl,
} from "@/lib/screener/company-logo-url";
import { isTop10Ticker, TOP10_META } from "@/lib/screener/top10-config";
import {
  dropdownMenuRichItemClassName,
  dropdownMenuSurfaceClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 250;

export type CompanyPick = {
  symbol: string;
  name: string;
};

type PickerStockRow = { ticker: string; name: string; logoUrl: string };

function singleAssetPickerStocks(exclude: Set<string>): PickerStockRow[] {
  if (isSingleAssetMode()) {
    const sym = SINGLE_ASSET_SYMBOL.toUpperCase();
    if (exclude.has(sym)) return [];
    if (isTop10Ticker(sym)) {
      const m = TOP10_META[sym];
      return [{ ticker: sym, name: m.name, logoUrl: companyLogoUrlForTicker(sym, m.domain) }];
    }
    return [{ ticker: sym, name: sym, logoUrl: logoDevStockLogoUrl(sym) ?? "" }];
  }
  return [];
}

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export type CompanyPickerRenderProps = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  atCapacity: boolean;
};

/**
 * Screener page-1 + page-2 stocks (from `/api/charting/picker-stocks`) + `/api/search` when typing.
 * @param includeCrypto When false (e.g. Charting), hides the crypto list and limits search to equities only.
 */
export function CompanyPicker({
  onPick,
  disabled,
  maxExtraCompanies,
  excludeSymbols = [],
  includeCrypto = true,
  children,
}: {
  onPick: (pick: CompanyPick) => void;
  disabled?: boolean;
  maxExtraCompanies: number;
  excludeSymbols?: string[];
  /** Default true — set false on Charting so only stocks appear (transaction modal keeps crypto). */
  includeCrypto?: boolean;
  children: (ctx: CompanyPickerRenderProps) => ReactNode;
}) {
  const pickerWrapRef = useRef<HTMLDivElement>(null);
  const pickerInputRef = useRef<HTMLInputElement>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [searchItems, setSearchItems] = useState<SearchAssetItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [pickerStocks, setPickerStocks] = useState<PickerStockRow[] | null>(null);
  const [pickerStocksLoading, setPickerStocksLoading] = useState(false);

  const debouncedQuery = useDebouncedValue(pickerQuery, SEARCH_DEBOUNCE_MS);
  const debouncedTrim = debouncedQuery.trim();

  const excludeSet = useMemo(
    () => new Set(excludeSymbols.map((s) => s.trim().toUpperCase()).filter(Boolean)),
    [excludeSymbols],
  );

  const screenerList = useMemo(() => {
    if (isSingleAssetMode()) {
      return singleAssetPickerStocks(excludeSet);
    }
    const base = pickerStocks ?? [];
    return base.filter((r) => !excludeSet.has(r.ticker.toUpperCase()));
  }, [excludeSet, pickerStocks]);

  useEffect(() => {
    if (!pickerOpen || isSingleAssetMode()) return;
    if (pickerStocks !== null) return;

    let cancelled = false;
    setPickerStocksLoading(true);
    void (async () => {
      try {
        const res = await fetch("/api/charting/picker-stocks", { cache: "default" });
        const json = (await res.json()) as { stocks?: PickerStockRow[] };
        if (cancelled) return;
        setPickerStocks(Array.isArray(json.stocks) ? json.stocks : []);
      } catch {
        if (!cancelled) setPickerStocks([]);
      } finally {
        if (!cancelled) setPickerStocksLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pickerOpen, pickerStocks]);

  const cryptoPickerList = useMemo(
    () => CRYPTO_PICKER_TOP.filter((c) => !excludeSet.has(c.symbol.toUpperCase())),
    [excludeSet],
  );

  const searchItemsForDisplay = useMemo(() => {
    if (includeCrypto) return searchItems;
    return searchItems.filter((item) => item.type === "stock");
  }, [includeCrypto, searchItems]);

  const onChooseAsset = useCallback(
    (item: SearchAssetItem) => {
      recordSearchNavigation(item);
      if (item.type === "stock" || (includeCrypto && item.type === "crypto")) {
        onPick({
          symbol: item.symbol.trim().toUpperCase(),
          name: item.name.trim() || item.symbol,
        });
      }
      setPickerOpen(false);
      setPickerQuery("");
      setSearchItems([]);
    },
    [includeCrypto, onPick],
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
      if (e.key !== "Escape") return;
      setPickerOpen(false);
      setPickerQuery("");
      setSearchItems([]);
      e.stopImmediatePropagation();
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey, true);
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

  const queryTrim = pickerQuery.trim();
  const showSearchPanel = queryTrim.length > 0;
  const atCapacity = disabled || maxExtraCompanies <= 0;

  const searchPlaceholder = includeCrypto ? "Search stocks, crypto, indices…" : "Search stocks…";
  const listboxAriaLabel = includeCrypto ? "Stocks, crypto, and search" : "Stocks and search";

  return (
    <div className="relative" ref={pickerWrapRef}>
      {children({ open: pickerOpen, setOpen: setPickerOpen, atCapacity })}

      {pickerOpen ? (
        <div
          className={cn(
            dropdownMenuSurfaceClassName(),
            "absolute left-0 top-full z-[200] mt-1 w-[min(calc(100vw-2rem),360px)] overflow-hidden",
          )}
          role="listbox"
          aria-label={listboxAriaLabel}
        >
          <div className="border-b border-[#F4F4F5] px-2 pb-1 pt-1">
            <input
              ref={pickerInputRef}
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-md border-0 bg-[#FAFAFA] px-2 py-1.5 text-[13px] text-[#09090B] placeholder:text-[#A1A1AA] outline-none ring-1 ring-transparent focus:ring-[#E4E4E7]"
              aria-label="Search to add company"
              autoComplete="off"
              autoCorrect="off"
            />
          </div>
          <div className="flex max-h-[min(400px,calc(100vh-12rem))] flex-col gap-1 overflow-y-auto px-1 py-2">
            {!showSearchPanel ? (
              <>
                <div className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-[#A1A1AA]">
                  Stocks
                </div>
                {pickerStocksLoading && screenerList.length === 0 && !isSingleAssetMode() ? (
                  <p className="px-3 py-2 text-[12px] text-[#71717A]">Loading companies…</p>
                ) : screenerList.length === 0 ? (
                  <p className="px-3 py-2 text-[12px] text-[#71717A]">No companies to add.</p>
                ) : (
                  <ul className="flex flex-col gap-1 pb-2">
                    {screenerList.map((row) => (
                      <li key={row.ticker}>
                        <button
                          type="button"
                          className={cn(dropdownMenuRichItemClassName(), "items-center")}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            onPick({ symbol: row.ticker, name: row.name });
                            setPickerOpen(false);
                            setPickerQuery("");
                            setSearchItems([]);
                          }}
                        >
                          <CompanyLogo name={row.name} logoUrl={row.logoUrl} symbol={row.ticker} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{row.name}</div>
                            <div className="truncate text-[12px] text-[#71717A]">{row.ticker}</div>
                          </div>
                          <span className="shrink-0 rounded-full bg-[#F4F4F5] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[#71717A]">
                            Stock
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {includeCrypto ? (
                  <>
                    <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-[#A1A1AA]">
                      Crypto
                    </div>
                    {cryptoPickerList.length === 0 ? (
                      <p className="px-3 py-2 text-[12px] text-[#71717A]">No crypto to add.</p>
                    ) : (
                      <ul className="flex flex-col gap-1 pb-2">
                        {cryptoPickerList.map((row) => (
                          <li key={row.symbol}>
                            <button
                              type="button"
                              className={cn(dropdownMenuRichItemClassName(), "items-center")}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                onPick({ symbol: row.symbol, name: row.name });
                                setPickerOpen(false);
                                setPickerQuery("");
                                setSearchItems([]);
                              }}
                            >
                              <CompanyLogo
                                name={row.name}
                                logoUrl={getCryptoLogoUrl(row.symbol)}
                                symbol={row.symbol}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-medium">{row.name}</div>
                                <div className="truncate text-[12px] text-[#71717A]">
                                  {eodhdCryptoSpotTickerDisplay(row.symbol)}
                                </div>
                              </div>
                              <span className="shrink-0 rounded-full bg-[#F4F4F5] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[#71717A]">
                                Crypto
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : null}
              </>
            ) : searchLoading && searchItemsForDisplay.length === 0 ? (
              <p className="px-3 py-2 text-[12px] text-[#71717A]">Searching…</p>
            ) : !searchLoading && searchItemsForDisplay.length === 0 ? (
              <p className="px-3 py-2 text-[12px] text-[#71717A]">No results for &ldquo;{queryTrim}&rdquo;</p>
            ) : (
              <>
                {searchLoading && searchItemsForDisplay.length > 0 ? (
                  <p className="px-3 pb-1 text-center text-[11px] text-[#A1A1AA]" aria-hidden>
                    Updating…
                  </p>
                ) : null}
                {searchItemsForDisplay.map((item) => (
                  <PeerSearchDropdownRow key={item.id} item={item} onPick={onChooseAsset} />
                ))}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
