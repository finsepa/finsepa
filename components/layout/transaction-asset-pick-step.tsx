"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { CompanyPick } from "@/components/charting/company-picker";
import { PeerSearchDropdownRow } from "@/components/comparison/peer-search-dropdown-row";
import { dropdownMenuRichItemClassName } from "@/components/design-system/dropdown-menu-styles";
import { CompanyLogo } from "@/components/screener/company-logo";
import { SearchLoadingIndicator } from "@/components/search/search-loading-indicator";
import { getCryptoLogoUrl } from "@/lib/crypto/crypto-logo-url";
import { CRYPTO_PICKER_TOP } from "@/lib/crypto/crypto-picker-universe";
import { Plus, Search } from "@/lib/icons";
import { getSearchPanelViewState } from "@/lib/search/search-policy";
import type { SearchAssetItem } from "@/lib/search/search-types";
import { useSearchRecentStorage } from "@/lib/search/use-search-recent-storage";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 250;
const POPULAR_STOCKS_MAX = 10;
const POPULAR_CRYPTO_MAX = 5;

type PopularStock = { ticker: string; name: string; logoUrl: string };

function SectionTitle({ children }: { children: string }) {
  return (
    <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
      {children}
    </div>
  );
}

/** iOS “Add Transaction” step 1 — Popular assets / search, then the form. */
export function TransactionAssetPickStep({
  onPick,
  onPickCustom,
}: {
  onPick: (pick: CompanyPick) => void;
  onPickCustom: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<SearchAssetItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [popular, setPopular] = useState<PopularStock[] | null>(null);
  const { recordRecent } = useSearchRecentStorage();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/charting/picker-stocks?limit=${POPULAR_STOCKS_MAX}`, { cache: "default" });
        const json = (await res.json()) as { stocks?: PopularStock[] };
        if (!cancelled) setPopular(Array.isArray(json.stocks) ? json.stocks : []);
      } catch {
        if (!cancelled) setPopular([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!debounced) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const ac = new AbortController();
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(debounced)}&scope=all`, {
          signal: ac.signal,
          cache: "default",
        });
        const json = (await res.json()) as { items?: SearchAssetItem[] };
        if (!cancelled) setResults(Array.isArray(json.items) ? json.items : []);
      } catch (e) {
        if (cancelled || (e instanceof DOMException && e.name === "AbortError")) return;
        setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [debounced]);

  const pickable = useMemo(
    () => results.filter((item) => item.type === "stock" || item.type === "crypto"),
    [results],
  );

  const queryTrim = query.trim();
  const { searchPending, showStaleList, noResults } = getSearchPanelViewState({
    queryTrim,
    debouncedTrim: debounced,
    loading,
    resultCount: pickable.length,
  });

  const choose = (item: SearchAssetItem) => {
    recordRecent(item);
    onPick({ symbol: item.symbol.trim().toUpperCase(), name: item.name.trim() || item.symbol });
  };

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <label className="flex h-10 items-center gap-2 rounded-full bg-surface-muted px-3.5 text-sm text-fg focus-within:ring-2 focus-within:ring-fg/10">
        <Search className="h-4 w-4 shrink-0 text-fg-muted" strokeWidth={2} aria-hidden />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search company or ticker"
          className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-muted"
          aria-label="Search company or ticker"
          autoComplete="off"
          autoCorrect="off"
        />
      </label>

      <div className="flex min-h-0 flex-col gap-1">
        {!queryTrim ? (
          <>
            <SectionTitle>Popular assets</SectionTitle>
            {popular == null ? (
              <p className="px-3 py-2 text-[12px] text-fg-muted">Loading…</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {popular.slice(0, POPULAR_STOCKS_MAX).map((row) => (
                  <li key={row.ticker}>
                    <button
                      type="button"
                      className={cn(dropdownMenuRichItemClassName(), "items-center")}
                      onClick={() => onPick({ symbol: row.ticker, name: row.name })}
                    >
                      <CompanyLogo name={row.name} logoUrl={row.logoUrl} symbol={row.ticker} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{row.ticker}</div>
                        <div className="truncate text-[12px] text-fg-muted">{row.name}</div>
                      </div>
                    </button>
                  </li>
                ))}
                {CRYPTO_PICKER_TOP.slice(0, POPULAR_CRYPTO_MAX).map((row) => (
                  <li key={row.symbol}>
                    <button
                      type="button"
                      className={cn(dropdownMenuRichItemClassName(), "items-center")}
                      onClick={() => onPick({ symbol: row.symbol, name: row.name })}
                    >
                      <CompanyLogo name={row.name} logoUrl={getCryptoLogoUrl(row.symbol)} symbol={row.symbol} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{row.symbol}</div>
                        <div className="truncate text-[12px] text-fg-muted">{row.name}</div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <SectionTitle>Other</SectionTitle>
            <button
              type="button"
              className={cn(dropdownMenuRichItemClassName(), "items-center")}
              onClick={onPickCustom}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-fg">
                <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">Custom asset</div>
                <div className="truncate text-[12px] text-fg-muted">Track something without a ticker</div>
              </div>
            </button>
          </>
        ) : searchPending && !showStaleList ? (
          <SearchLoadingIndicator />
        ) : noResults ? (
          <p className="px-3 py-6 text-center text-[13px] text-fg-muted">No results for &ldquo;{queryTrim}&rdquo;</p>
        ) : (
          <>
            <SectionTitle>Assets</SectionTitle>
            {pickable.map((item) => (
              <PeerSearchDropdownRow key={item.id} item={item} onPick={choose} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
