"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CompanyLogo } from "@/components/screener/company-logo";
import { TopbarDropdownPortal } from "@/components/layout/topbar-dropdown-portal";
import { PeerSearchDropdownRow } from "@/components/comparison/peer-search-dropdown-row";
import { SearchInlineInputShell } from "@/components/search/search-inline-input-shell";
import { SearchLoadingIndicator } from "@/components/search/search-loading-indicator";
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
  dropdownMenuFloatingScrollClassName,
  dropdownMenuPanelBodyClassName,
  dropdownMenuRichItemClassName,
  dropdownMenuSurfaceClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 250;
/** Hard cap on “Most popular” rows (screener default list). */
const PICKER_MOST_POPULAR_MAX = 15;

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

const TRANSACTION_PICKER_RESULTS_ID = "transaction-company-picker-results";

/**
 * Screener top-10 stocks (from `/api/charting/picker-stocks`) + `/api/search` when typing.
 * @param includeCrypto When false (e.g. Charting), hides the crypto list and limits search to equities only.
 */
export function CompanyPicker({
  onPick,
  disabled,
  maxExtraCompanies,
  excludeSymbols = [],
  includeCrypto = true,
  menuAlign = "leading",
  alwaysAllowOpen = false,
  variant = "button",
  selected = null,
  onClearSelection,
  placeholder: placeholderProp,
  shellClassName,
  wrapClassName,
  menuPortal = false,
  children,
}: {
  onPick: (pick: CompanyPick) => void;
  disabled?: boolean;
  maxExtraCompanies: number;
  excludeSymbols?: string[];
  /** Default true — set false on Charting so only stocks appear (transaction modal keeps crypto). */
  includeCrypto?: boolean;
  /** `trailing` anchors the panel to the trigger’s right edge (menu grows left). */
  menuAlign?: "leading" | "trailing";
  /** Breadcrumb ticker switcher: always open menu even when {@link maxExtraCompanies} is 0. */
  alwaysAllowOpen?: boolean;
  /** `inline-search` — top bar–style shell + portaled dropdown (New Transaction). */
  variant?: "button" | "inline-search";
  selected?: CompanyPick | null;
  onClearSelection?: () => void;
  placeholder?: string;
  shellClassName?: string;
  /** Wrapper around trigger + menu (`w-full` for search shell; `shrink-0 w-auto` for chip rows). */
  wrapClassName?: string;
  /** Portal dropdown to `document.body` (avoids modal overflow clipping). */
  menuPortal?: boolean;
  children?: (ctx: CompanyPickerRenderProps) => ReactNode;
}) {
  const pickerWrapRef = useRef<HTMLDivElement>(null);
  const pickerInputRef = useRef<HTMLInputElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);

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
      return singleAssetPickerStocks(excludeSet).slice(0, PICKER_MOST_POPULAR_MAX);
    }
    const base = pickerStocks ?? [];
    return base
      .filter((r) => !excludeSet.has(r.ticker.toUpperCase()))
      .slice(0, PICKER_MOST_POPULAR_MAX);
  }, [excludeSet, pickerStocks]);

  useEffect(() => {
    if (!pickerOpen || isSingleAssetMode()) return;
    if (pickerStocks !== null) return;

    let cancelled = false;
    setPickerStocksLoading(true);
    void (async () => {
      try {
        const res = await fetch("/api/charting/picker-stocks?limit=15", { cache: "default" });
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

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    setPickerQuery("");
    setSearchItems([]);
  }, []);

  const onChooseAsset = useCallback(
    (item: SearchAssetItem) => {
      recordSearchNavigation(item);
      if (item.type === "stock" || (includeCrypto && item.type === "crypto")) {
        onPick({
          symbol: item.symbol.trim().toUpperCase(),
          name: item.name.trim() || item.symbol,
        });
      }
      closePicker();
    },
    [includeCrypto, onPick, closePicker],
  );

  useEffect(() => {
    if (!pickerOpen) return;
    pickerInputRef.current?.focus();
  }, [pickerOpen]);

  useEffect(() => {
    if (!pickerOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (pickerWrapRef.current?.contains(t) || menuPortalRef.current?.contains(t)) return;
      closePicker();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      closePicker();
      e.stopImmediatePropagation();
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [pickerOpen, closePicker]);

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
  const atCapacity = disabled || (!alwaysAllowOpen && maxExtraCompanies <= 0);

  const searchPlaceholder = includeCrypto ? "Search stocks, crypto, indices…" : "Search stocks…";
  const listboxAriaLabel = includeCrypto ? "Stocks, crypto, and search" : "Stocks and search";
  const inlinePlaceholder =
    placeholderProp ??
    "Start entering in the ticker or company name";

  const shellDisplayValue = pickerOpen
    ? pickerQuery
    : selected
      ? `${selected.name} · ${selected.symbol}`
      : "";

  const pickerListBody = (
    <div
      className={cn(
        dropdownMenuPanelBodyClassName,
        dropdownMenuFloatingScrollClassName,
        "flex max-h-[min(400px,calc(100vh-12rem))] flex-col gap-1 overflow-y-auto px-1 py-2",
      )}
    >
      {!showSearchPanel ? (
        <>
          <div className="px-3 pb-1 pt-1 text-[11px] font-semibold tracking-wide text-[#A1A1AA]">
            Most popular
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
                      closePicker();
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
                          closePicker();
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
        <SearchLoadingIndicator />
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
  );

  const pickerDropdownPanel = (
    <div
      className={cn(
        dropdownMenuSurfaceClassName("overflow-hidden"),
        menuPortal ? "w-[min(calc(100vw-2rem),360px)]" : "w-[min(calc(100vw-2rem),360px)]",
      )}
      role="listbox"
      id={variant === "inline-search" ? TRANSACTION_PICKER_RESULTS_ID : undefined}
      aria-label={listboxAriaLabel}
    >
      {variant === "button" ? (
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
      ) : null}
      {pickerListBody}
    </div>
  );

  const portalAlign = menuAlign === "trailing" ? "trailing" : "leading";

  const resolvedWrapClassName =
    wrapClassName ??
    (variant === "inline-search" ? "relative w-full" : "relative w-auto shrink-0");

  return (
    <div className={cn(resolvedWrapClassName, pickerOpen && "z-[100]")} ref={pickerWrapRef}>
      {variant === "inline-search" ? (
        <SearchInlineInputShell
          open={pickerOpen}
          onOpenChange={(next) => {
            if (atCapacity) return;
            if (next) {
              setPickerOpen(true);
              setPickerQuery("");
            } else {
              closePicker();
            }
          }}
          inputRef={pickerInputRef}
          value={shellDisplayValue}
          onChange={setPickerQuery}
          placeholder={inlinePlaceholder}
          disabled={atCapacity}
          shellClassName={shellClassName ?? "rounded-[10px]"}
          showTrailingClear={Boolean(selected) && !pickerOpen}
          onTrailingClear={onClearSelection}
          ariaLabel="Ticker or company"
          ariaControls={TRANSACTION_PICKER_RESULTS_ID}
        />
      ) : (
        children?.({ open: pickerOpen, setOpen: setPickerOpen, atCapacity })
      )}

      {pickerOpen && variant === "button" ? (
        <div
          className={cn(
            "absolute top-full z-[200] mt-1",
            menuAlign === "trailing" ? "right-0" : "left-0",
          )}
        >
          {pickerDropdownPanel}
        </div>
      ) : null}

      {pickerOpen && variant === "inline-search" && menuPortal ? (
        <TopbarDropdownPortal
          open={pickerOpen}
          anchorRef={pickerWrapRef}
          align={portalAlign}
          ref={menuPortalRef}
        >
          {pickerDropdownPanel}
        </TopbarDropdownPortal>
      ) : null}

      {pickerOpen && variant === "inline-search" && !menuPortal ? (
        <div
          className={cn(
            "absolute top-full z-[200] mt-1",
            menuAlign === "trailing" ? "right-0" : "left-0",
          )}
        >
          {pickerDropdownPanel}
        </div>
      ) : null}
    </div>
  );
}
