"use client";

import { memo, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

import { WatchlistStarToggle } from "@/components/watchlist/watchlist-star-button";
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
        width={40}
        height={40}
        className="h-10 w-10 shrink-0 rounded-xl border border-neutral-200 bg-white object-contain"
        onError={() => {
          setImgErr(true);
          mergeLogoMemory(sym, null);
        }}
      />
    );
  }
  const initials = item.symbol.slice(0, 2).toUpperCase();
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E4E4E7] bg-[#F4F4F5] text-[11px] font-bold text-[#09090B]">
      {initials}
    </div>
  );
}

const categoryLabel: Record<SearchAssetItem["type"], string> = {
  stock: "Stock",
  crypto: "Crypto",
  index: "Index",
};

function MetaRight({ item }: { item: SearchAssetItem }) {
  const sub = item.marketLabel ?? item.subtitle;
  return (
    <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
      <span className="rounded-full bg-[#F4F4F5] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[#71717A]">
        {categoryLabel[item.type]}
      </span>
      {sub ? <span className="max-w-[140px] truncate text-[12px] text-[#A1A1AA]">{sub}</span> : null}
    </div>
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

  const rowClass = `group flex items-center gap-2 px-5 py-3 transition-colors ${
    active ? "bg-[#EEF2FF]" : "hover:bg-[#F4F4F5]"
  }`;

  const mainLink = (
    <Link
      href={item.route}
      onClick={(e) => {
        e.preventDefault();
        onNavigate(item);
      }}
      className="flex min-w-0 flex-1 items-center gap-3"
    >
      <LogoBlock item={item} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold leading-5 text-[#09090B]">{item.name}</div>
        <div className="truncate text-[12px] leading-4 text-[#71717A]">
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
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#A1A1AA] outline-none transition-colors hover:bg-[#F4F4F5] hover:text-[#71717A] focus-visible:ring-2 focus-visible:ring-[#09090B]/15"
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
