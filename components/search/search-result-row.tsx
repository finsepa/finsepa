"use client";

import { memo, useEffect, useState } from "react";
import Link from "next/link";
import { X } from "@/lib/icons";

import { dropdownMenuRichItemClassName } from "@/components/design-system/dropdown-menu-styles";
import { SuperinvestorFollowStarToggle } from "@/components/superinvestors/superinvestor-follow-star-toggle";
import { WatchlistStarToggle } from "@/components/watchlist/watchlist-star-button";
import type { WatchlistCollection } from "@/lib/watchlist/collections";
import { cn } from "@/lib/utils";
import { mergeLogoMemory, readLogoMemory } from "@/lib/logos/logo-memory";
import { eodhdCryptoSpotTickerDisplay } from "@/lib/crypto/eodhd-crypto-ticker-display";
import type { SearchAssetItem } from "@/lib/search/search-types";
import { watchlistStorageKeyForSearchItem } from "@/lib/search/watchlist-storage-key";

export function SearchResultLogo({ item }: { item: SearchAssetItem }) {
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
      // eslint-disable-next-line @next/next/no-img-element -- remote favicon or public superinvestor avatar
      <img
        src={src}
        alt=""
        width={32}
        height={32}
        className={cn(
          "h-8 w-8 shrink-0 border border-neutral-200 bg-white object-contain",
          item.type === "superinvestor" ? "rounded-full object-cover" : "rounded-lg",
          item.type === "superinvestor" && src.includes("blackrock") && "bg-[#0F0F0F] p-1",
        )}
        onError={() => {
          setImgErr(true);
          mergeLogoMemory(sym, null);
        }}
      />
    );
  }
  const initials =
    item.type === "superinvestor"
      ? item.name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((w) => w[0])
          .join("")
          .toUpperCase()
      : item.symbol.slice(0, 2).toUpperCase();
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#E4E4E7] bg-[#F4F4F5] text-[10px] font-bold text-[#0F0F0F]">
      {initials}
    </div>
  );
}

const categoryLabel: Record<SearchAssetItem["type"], string> = {
  stock: "Stock",
  crypto: "Crypto",
  index: "Index",
  superinvestor: "Superinvestor",
};

export function searchResultCategoryLabel(item: SearchAssetItem): string {
  if (item.marketLabel?.trim().toUpperCase() === "ETF") return "ETF";
  return categoryLabel[item.type];
}

function MetaRight({ item, className }: { item: SearchAssetItem; className?: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full bg-[#F4F4F5] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[#71717A]",
        className,
      )}
    >
      {searchResultCategoryLabel(item)}
    </span>
  );
}

const recentRemoveButtonClass =
  "flex h-6 w-6 shrink-0 items-center justify-center self-center rounded-md text-[#0F0F0F] outline-none transition-[opacity,background-color,color] duration-100 focus-visible:ring-2 focus-visible:ring-[#0F0F0F]/10";

function RecentRowTrailing({
  item,
  onRemoveRecent,
}: {
  item: SearchAssetItem;
  onRemoveRecent?: () => void;
}) {
  if (!onRemoveRecent) {
    return <MetaRight item={item} />;
  }

  return (
    <div className="relative ml-auto flex h-8 shrink-0 items-center justify-end max-md:gap-2 md:grid md:place-items-end [grid-template-areas:'trailing']">
      <MetaRight
        item={item}
        className={cn(
          "md:[grid-area:trailing] md:self-center",
          "md:transition-opacity md:duration-100",
          "md:group-hover:opacity-0 md:group-hover:pointer-events-none",
          "md:group-focus-within:opacity-0 md:group-focus-within:pointer-events-none",
          "md:group-data-[active=true]:opacity-0 md:group-data-[active=true]:pointer-events-none",
        )}
      />
      <button
        type="button"
        aria-label={`Remove ${item.name} from recent searches`}
        className={cn(
          recentRemoveButtonClass,
          "max-md:relative max-md:opacity-100",
          "md:[grid-area:trailing] md:opacity-0 md:pointer-events-none",
          "md:group-hover:pointer-events-auto md:group-hover:bg-[#E4E4E7] md:group-hover:opacity-100",
          "md:group-focus-within:pointer-events-auto md:group-focus-within:bg-[#E4E4E7] md:group-focus-within:opacity-100",
          "md:group-data-[active=true]:pointer-events-auto md:group-data-[active=true]:bg-[#E4E4E7] md:group-data-[active=true]:opacity-100",
        )}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemoveRecent();
        }}
      >
        <X className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}

const leadingToggleClassName = "flex w-8 shrink-0 items-center justify-center";

function SearchResultLeadingToggle({
  item,
  label,
  wlKey,
  watched,
  loaded,
  storageHydrated,
  toggleTicker,
  watchlists,
  activeWatchlistId,
}: {
  item: SearchAssetItem;
  label: string;
  wlKey: string;
  watched: Set<string>;
  loaded: boolean;
  storageHydrated: boolean;
  toggleTicker: (ticker: string, watchlistId?: string) => void;
  watchlists: WatchlistCollection[];
  activeWatchlistId: string;
}) {
  if (item.type === "superinvestor") {
    return (
      <SuperinvestorFollowStarToggle
        className={leadingToggleClassName}
        profileHref={item.route}
        label={item.name}
      />
    );
  }

  return (
    <WatchlistStarToggle
      className={leadingToggleClassName}
      storageKey={wlKey}
      label={label}
      watched={watched}
      loaded={loaded}
      storageHydrated={storageHydrated}
      toggleTicker={toggleTicker}
      watchlists={watchlists}
      activeWatchlistId={activeWatchlistId}
    />
  );
}

type Props = {
  item: SearchAssetItem;
  variant: "recent" | "live";
  onNavigate: (item: SearchAssetItem) => void;
  onRemoveRecent?: () => void;
  active?: boolean;
  /** Whether this asset is on any watchlist. */
  starred: boolean;
  watched: Set<string>;
  watchlists: WatchlistCollection[];
  activeWatchlistId: string;
  loaded: boolean;
  storageHydrated?: boolean;
  toggleTicker: (ticker: string, watchlistId?: string) => void;
};

function SearchResultRowInner({
  item,
  variant,
  onNavigate,
  onRemoveRecent,
  active,
  starred,
  watched,
  watchlists,
  activeWatchlistId,
  loaded,
  storageHydrated = false,
  toggleTicker,
}: Props) {
  const wlKey = watchlistStorageKeyForSearchItem(item);
  const label = item.symbol;

  const rowClass = cn(
    dropdownMenuRichItemClassName(),
    "group items-center",
    active && "bg-[#F4F4F5]",
  );

  const mainLink = (
    <Link
      href={item.route}
      onClick={(e) => {
        e.preventDefault();
        onNavigate(item);
      }}
      className="flex min-w-0 flex-1 items-center gap-2 no-underline"
    >
      <SearchResultLogo item={item} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium underline-offset-2 decoration-[#0F0F0F] group-hover:underline group-data-[active=true]:underline">
          {item.name}
        </div>
        <div className="truncate text-[12px] text-[#71717A]">
          {item.type === "crypto" ? eodhdCryptoSpotTickerDisplay(item.symbol) : item.symbol}
        </div>
      </div>
    </Link>
  );

  if (variant === "live") {
    return (
      <div className={rowClass} data-active={active ? "true" : undefined}>
        <SearchResultLeadingToggle
          item={item}
          label={label}
          wlKey={wlKey}
          watched={watched}
          loaded={loaded}
          storageHydrated={storageHydrated}
          toggleTicker={toggleTicker}
          watchlists={watchlists}
          activeWatchlistId={activeWatchlistId}
        />
        {mainLink}
        <MetaRight item={item} />
      </div>
    );
  }

  return (
    <div className={rowClass} data-active={active ? "true" : undefined}>
      <SearchResultLeadingToggle
        item={item}
        label={label}
        wlKey={wlKey}
        watched={watched}
        loaded={loaded}
        storageHydrated={storageHydrated}
        toggleTicker={toggleTicker}
        watchlists={watchlists}
        activeWatchlistId={activeWatchlistId}
      />
      {mainLink}
      <RecentRowTrailing item={item} onRemoveRecent={onRemoveRecent} />
    </div>
  );
}

export const SearchResultRow = memo(SearchResultRowInner);
