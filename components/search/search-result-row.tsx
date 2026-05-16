"use client";

import { memo, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

import { dropdownMenuRichItemClassName } from "@/components/design-system/dropdown-menu-styles";
import { WatchlistStarToggle } from "@/components/watchlist/watchlist-star-button";
import { cn } from "@/lib/utils";
import { mergeLogoMemory, readLogoMemory } from "@/lib/logos/logo-memory";
import { eodhdCryptoSpotTickerDisplay } from "@/lib/crypto/eodhd-crypto-ticker-display";
import type { SearchAssetItem } from "@/lib/search/search-types";
import { watchlistStorageKeyForSearchItem } from "@/lib/search/watchlist-storage-key";

function LogoBlock({ item }: { item: SearchAssetItem }) {
  const [imgErr, setImgErr] = useState(false);
  const sym = item.symbol.trim().toUpperCase();
  const fromServer = item.logoUrl?.trim() ?? "";
  const fromMem = readLogoMemory(sym);
  const src = fromServer || (fromMem ?? "");

  useEffect(() => {
    if (fromServer) mergeLogoMemory(sym, fromServer);
  }, [sym, fromServer]);

  if (src && !imgErr) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote favicon
      <img
        src={src}
        alt=""
        width={32}
        height={32}
        className="h-8 w-8 shrink-0 rounded-lg border border-neutral-200 bg-white object-contain"
        onError={() => {
          setImgErr(true);
          mergeLogoMemory(sym, null);
        }}
      />
    );
  }
  const initials = item.symbol.slice(0, 2).toUpperCase();
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#E4E4E7] bg-[#F4F4F5] text-[10px] font-bold text-[#09090B]">
      {initials}
    </div>
  );
}

const categoryLabel: Record<SearchAssetItem["type"], string> = {
  stock: "Stock",
  crypto: "Crypto",
  index: "Index",
};

function resultCategoryLabel(item: SearchAssetItem): string {
  if (item.marketLabel?.trim().toUpperCase() === "ETF") return "ETF";
  return categoryLabel[item.type];
}

function MetaRight({ item }: { item: SearchAssetItem }) {
  return (
    <span className="shrink-0 rounded-full bg-[#F4F4F5] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[#71717A]">
      {resultCategoryLabel(item)}
    </span>
  );
}

type Props = {
  item: SearchAssetItem;
  variant: "recent" | "live";
  onNavigate: (item: SearchAssetItem) => void;
  onRemoveRecent?: () => void;
  active?: boolean;
  /** Whether this asset is on the watchlist (avoids passing the full Set each render). */
  starred: boolean;
  loaded: boolean;
  toggleTicker: (ticker: string) => void;
};

function SearchResultRowInner({
  item,
  variant,
  onNavigate,
  onRemoveRecent,
  active,
  starred,
  loaded,
  toggleTicker,
}: Props) {
  const wlKey = watchlistStorageKeyForSearchItem(item);
  const label = item.symbol;

  const watchedSet = useMemo(() => {
    const k = wlKey.trim().toUpperCase();
    return starred ? new Set([k]) : new Set<string>();
  }, [starred, wlKey]);

  const rowClass = cn(dropdownMenuRichItemClassName(), "group items-center", active && "bg-[#F4F4F5]");

  const mainLink = (
    <Link
      href={item.route}
      onClick={(e) => {
        e.preventDefault();
        onNavigate(item);
      }}
      className="flex min-w-0 flex-1 items-center gap-2 no-underline"
    >
      <LogoBlock item={item} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{item.name}</div>
        <div className="truncate text-[12px] text-[#71717A]">
          {item.type === "crypto" ? eodhdCryptoSpotTickerDisplay(item.symbol) : item.symbol}
        </div>
      </div>
    </Link>
  );

  if (variant === "live") {
    return (
      <div className={rowClass}>
        <WatchlistStarToggle
          className="flex w-8 shrink-0 items-center justify-center"
          storageKey={wlKey}
          label={label}
          watched={watchedSet}
          loaded={loaded}
          toggleTicker={toggleTicker}
        />
        {mainLink}
        <MetaRight item={item} />
      </div>
    );
  }

  return (
    <div className={rowClass}>
      <WatchlistStarToggle
        className="flex w-8 shrink-0 items-center justify-center"
        storageKey={wlKey}
        label={label}
        watched={watchedSet}
        loaded={loaded}
        toggleTicker={toggleTicker}
      />
      {mainLink}
      <div className="flex shrink-0 items-center gap-2">
        <MetaRight item={item} />
        {onRemoveRecent ? (
          <button
            type="button"
            aria-label={`Remove ${item.name} from recent searches`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#A1A1AA] outline-none transition-colors hover:bg-[#F4F4F5] hover:text-[#71717A] focus-visible:ring-2 focus-visible:ring-[#09090B]/10"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemoveRecent();
            }}
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export const SearchResultRow = memo(SearchResultRowInner);
