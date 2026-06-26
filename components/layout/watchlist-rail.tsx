"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { GripVertical, Maximize2, PanelLeftOpen, Star, X } from "@/lib/icons";

import { WatchlistEmptyState } from "@/components/watchlist/watchlist-empty-state";
import { WatchlistOptionsMenu } from "@/components/watchlist/watchlist-options-menu";
import { WatchlistSectionHeader } from "@/components/watchlist/watchlist-section-header";
import { CompanyLogo } from "@/components/screener/company-logo";
import { DropdownScrollArea } from "@/components/design-system/dropdown-scroll-area";
import { panelOverlayScrollGutterClassName } from "@/components/design-system/dropdown-menu-styles";
import {
  WATCHLIST_PANEL_WIDTH_PX,
  WATCHLIST_RAIL_WIDTH_MOTION_CLASS,
  useWatchlistRailLayout,
} from "@/components/layout/watchlist-rail-layout-context";
import { TopbarDelayedTooltip } from "@/components/layout/topbar-delayed-tooltip";
import { shellChromeToggleButtonClass } from "@/components/layout/shell-chrome-toggle-button";
import { eodhdCryptoSpotTickerDisplay } from "@/lib/crypto/eodhd-crypto-ticker-display";
import type { WatchlistEnrichedItem } from "@/lib/watchlist/enriched-types";
import { normalizeWatchlistStorageKey } from "@/lib/watchlist/normalize-storage-key";
import { partitionEnrichedItemsBySections } from "@/lib/watchlist/sections";
import type { WatchlistDropTarget } from "@/lib/watchlist/watchlist-drag";
import { readWatchlistDragData, writeWatchlistDragData } from "@/lib/watchlist/watchlist-drag";
import { resolveWatchlistRailHref } from "@/lib/watchlist/watchlist-rail-href";
import { useWatchlistEnrichedItems } from "@/lib/watchlist/use-watchlist-enriched-items";
import { useWatchlist } from "@/lib/watchlist/use-watchlist-client";
import { cn } from "@/lib/utils";

function globalTickerIndex(watchedTickers: string[], storageKey: string): number {
  const key = normalizeWatchlistStorageKey(storageKey);
  return watchedTickers.findIndex((ticker) => normalizeWatchlistStorageKey(ticker) === key);
}

function hasRailQuote(row: WatchlistEnrichedItem): boolean {
  return (
    (row.price != null && Number.isFinite(row.price)) ||
    (row.pct1d != null && Number.isFinite(row.pct1d))
  );
}

function formatRailPrice(n: number | null, kind: WatchlistEnrichedItem["kind"]): string {
  if (n == null || !Number.isFinite(n)) return "";
  if (kind === "crypto" && Math.abs(n) < 1) {
    return `$${n.toLocaleString("en-US", { maximumFractionDigits: 6 })}`;
  }
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatRailPercent(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function RailPriceSkeleton() {
  return (
    <div className="ml-auto flex shrink-0 items-center gap-3">
      <div className="h-5 w-[4.5rem] animate-pulse rounded bg-[#E4E4E7]" />
      <div className="h-5 w-12 animate-pulse rounded bg-[#E4E4E7]" />
    </div>
  );
}

function WatchlistRailTitleSkeleton() {
  return (
    <div
      className="flex min-w-0 flex-1 items-center gap-0.5 pl-1"
      aria-hidden
    >
      <div className="h-4 w-[5.5rem] max-w-[45%] animate-pulse rounded bg-[#E4E4E7]" />
      <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-[#F4F4F5]" />
    </div>
  );
}

function RailChange({ value }: { value: number | null }) {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }
  const positive = value >= 0;
  return (
    <span
      className={cn(
        "flex h-5 w-full items-center justify-end text-[14px] font-normal leading-5 tabular-nums",
        positive ? "text-[#16A34A]" : "text-[#DC2626]",
      )}
    >
      {formatRailPercent(value)}
    </span>
  );
}

function WatchlistRailRow({
  row,
  globalIndex,
  sectionId,
  pathname,
  tabParam,
  pricesLoading,
  loading,
  onMoveItem,
  onRemove,
}: {
  row: WatchlistEnrichedItem;
  globalIndex: number;
  sectionId: string | null;
  pathname: string;
  tabParam: string | null;
  pricesLoading: boolean;
  loading: boolean;
  onMoveItem: (fromIndex: number, target: WatchlistDropTarget) => void;
  onRemove: (storageKey: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const symbolLabel =
    row.kind === "crypto" ? eodhdCryptoSpotTickerDisplay(row.symbol) : row.symbol;
  const href = resolveWatchlistRailHref(row, { pathname, tabParam });
  const showQuoteSkeleton = pricesLoading || (loading && !hasRailQuote(row));
  const priceText = formatRailPrice(row.price, row.kind);

  return (
    <div
      draggable={globalIndex >= 0}
      aria-label={`Reorder ${symbolLabel}`}
      onDragStart={(event) => {
        if (globalIndex < 0) return;
        writeWatchlistDragData(event.dataTransfer, {
          globalIndex,
          storageKey: row.storageKey,
        });
      }}
      onDragEnd={() => {
        setDragOver(false);
      }}
      onDragOver={(event) => {
        if (globalIndex < 0) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        if (globalIndex < 0) return;
        const payload = readWatchlistDragData(event.dataTransfer);
        if (!payload) return;
        if (payload.globalIndex === globalIndex) return;
        onMoveItem(payload.globalIndex, { kind: "row", toIndex: globalIndex, sectionId });
      }}
      className={cn(
        "group flex min-w-0 items-center gap-1 rounded-lg px-2 py-1.5 transition-colors",
        dragOver ? "bg-[#E4E4E7]" : "hover:bg-[#F4F4F5]",
      )}
    >
      <Link
        href={href}
        className="flex min-w-0 flex-1 items-center gap-2 no-underline"
        draggable={false}
      >
        <CompanyLogo
          name={row.name}
          logoUrl={row.logoUrl ?? ""}
          symbol={row.symbol}
          size="sm"
        />
        <span className="min-w-0 shrink truncate text-[14px] font-normal leading-5 text-[#09090B] underline-offset-2 decoration-[#71717A] group-hover:underline">
          {symbolLabel}
        </span>
      </Link>
      {showQuoteSkeleton ? (
        <RailPriceSkeleton />
      ) : (
        <div className="ml-auto flex shrink-0 items-center gap-3 font-['Inter'] tabular-nums">
          {priceText ? (
            <span className="shrink-0 text-right text-[14px] font-normal leading-5 text-[#09090B]">
              {priceText}
            </span>
          ) : null}
          <div className="relative h-5 w-12 shrink-0">
            <span className="absolute inset-0 flex items-center justify-end group-hover:invisible">
              <RailChange value={row.pct1d} />
            </span>
            <div className="absolute inset-0 hidden items-center justify-end gap-0.5 group-hover:flex">
              <button
                type="button"
                aria-label={`Remove ${symbolLabel} from watchlist`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onRemove(row.storageKey);
                }}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[#A1A1AA] outline-none hover:bg-[#EBEBEB] hover:text-[#71717A] focus-visible:ring-2 focus-visible:ring-[#09090B]/10"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
              <span
                className="flex h-5 w-5 shrink-0 cursor-grab items-center justify-center text-[#71717A] active:cursor-grabbing"
                aria-hidden
              >
                <GripVertical className="h-4 w-4" strokeWidth={2} />
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WatchlistRailSectionGroup({
  sectionId,
  sectionIndex,
  label,
  rows,
  watchedTickers,
  pathname,
  tabParam,
  pricesLoading,
  loading,
  onMoveItem,
  onRemove,
  onRenameSection,
  onDeleteSection,
  onReorderSection,
}: {
  sectionId: string;
  sectionIndex: number;
  label: string;
  rows: WatchlistEnrichedItem[];
  watchedTickers: string[];
  pathname: string;
  tabParam: string | null;
  pricesLoading: boolean;
  loading: boolean;
  onMoveItem: (fromIndex: number, target: WatchlistDropTarget) => void;
  onRemove: (storageKey: string) => void;
  onRenameSection: (sectionId: string, name: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onReorderSection: (fromSectionIndex: number, toSectionIndex: number) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      <WatchlistSectionHeader
        variant="rail"
        sectionId={sectionId}
        sectionIndex={sectionIndex}
        label={label}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((value) => !value)}
        onRename={(name) => onRenameSection(sectionId, name)}
        onDelete={() => onDeleteSection(sectionId)}
        onDropItem={onMoveItem}
        onReorderSection={onReorderSection}
      />
      {!collapsed
        ? rows.map((row) => (
            <WatchlistRailRow
              key={row.entryId}
              row={row}
              globalIndex={globalTickerIndex(watchedTickers, row.storageKey)}
              sectionId={sectionId}
              pathname={pathname}
              tabParam={tabParam}
              pricesLoading={pricesLoading}
              loading={loading}
              onMoveItem={onMoveItem}
              onRemove={onRemove}
            />
          ))
        : null}
    </>
  );
}

function WatchlistRailSkeleton() {
  return (
    <div className="flex flex-col">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
          <div className="h-6 w-6 shrink-0 animate-pulse rounded-[8px] bg-[#E4E4E7]" />
          <div className="h-4 w-12 animate-pulse rounded bg-[#E4E4E7]" />
          <div className="ml-auto flex items-center gap-4">
            <div className="h-5 w-14 animate-pulse rounded bg-[#E4E4E7]" />
            <div className="h-4 w-10 animate-pulse rounded bg-[#F4F4F5]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function WatchlistRailScrollContent({
  showLoadingState,
  empty,
  error,
  railGroups,
  watchedTickers,
  pathname,
  tabParam,
  pricesLoading,
  loading,
  moveActiveWatchlistItem,
  removeFromActiveWatchlist,
  renameActiveSection,
  deleteActiveSection,
  reorderActiveSection,
}: {
  showLoadingState: boolean;
  empty: boolean;
  error: string | null;
  railGroups: ReturnType<typeof partitionEnrichedItemsBySections>;
  watchedTickers: string[];
  pathname: string;
  tabParam: string | null;
  pricesLoading: boolean;
  loading: boolean;
  moveActiveWatchlistItem: (fromIndex: number, target: WatchlistDropTarget) => void;
  removeFromActiveWatchlist: (storageKey: string) => void;
  renameActiveSection: (sectionId: string, name: string) => void;
  deleteActiveSection: (sectionId: string) => void;
  reorderActiveSection: (fromSectionIndex: number, toSectionIndex: number) => void;
}) {
  if (showLoadingState) {
    return <WatchlistRailSkeleton />;
  }
  if (empty) {
    return (
      <WatchlistEmptyState
        variant="plain"
        className="min-h-full flex-1 justify-center py-12"
      />
    );
  }
  if (error) {
    return <p className="px-3 py-4 text-[13px] leading-5 text-[#DC2626]">{error}</p>;
  }
  return (
    <div className="flex flex-col">
      {railGroups.unsectioned.map((row) => (
        <WatchlistRailRow
          key={row.entryId}
          row={row}
          globalIndex={globalTickerIndex(watchedTickers, row.storageKey)}
          sectionId={null}
          pathname={pathname}
          tabParam={tabParam}
          pricesLoading={pricesLoading}
          loading={loading}
          onMoveItem={moveActiveWatchlistItem}
          onRemove={removeFromActiveWatchlist}
        />
      ))}
      {railGroups.sections.map(({ section, rows }, sectionIndex) => (
        <WatchlistRailSectionGroup
          key={section.id}
          sectionId={section.id}
          sectionIndex={sectionIndex}
          label={section.name}
          rows={rows}
          watchedTickers={watchedTickers}
          pathname={pathname}
          tabParam={tabParam}
          pricesLoading={pricesLoading}
          loading={loading}
          onMoveItem={moveActiveWatchlistItem}
          onRemove={removeFromActiveWatchlist}
          onRenameSection={renameActiveSection}
          onDeleteSection={deleteActiveSection}
          onReorderSection={reorderActiveSection}
        />
      ))}
    </div>
  );
}

const watchlistRailSurfaceClass =
  "flex h-full min-h-0 flex-col overflow-hidden bg-white md:rounded-none";

function WatchlistRailFullPageLink() {
  return (
    <TopbarDelayedTooltip label="Open full watchlist" placement="left">
      <Link
        href="/watchlist"
        prefetch={false}
        aria-label="Open full watchlist"
        className={shellChromeToggleButtonClass}
      >
        <Maximize2 className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
      </Link>
    </TopbarDelayedTooltip>
  );
}

function WatchlistRailToggle({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  const label = expanded ? "Collapse watchlist" : "Expand watchlist";
  return (
    <TopbarDelayedTooltip label={label} placement="left">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={label}
        className={shellChromeToggleButtonClass}
      >
        {expanded ? (
          <PanelLeftOpen className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
        ) : (
          <Star className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
        )}
      </button>
    </TopbarDelayedTooltip>
  );
}

function isFullWatchlistPage(pathname: string): boolean {
  return pathname === "/watchlist" || pathname.startsWith("/watchlist/");
}

export function WatchlistRail() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { collapsed, toggleCollapsed, outerWidthPx } = useWatchlistRailLayout();
  const expanded = !collapsed;
  const { items, empty, error, pricesLoading, loading } = useWatchlistEnrichedItems({
    enabled: expanded,
  });
  const {
    watchlists,
    activeWatchlistId,
    activeWatchlistName,
    watchedTickers,
    activeSections,
    activeTickerSections,
    createWatchlist,
    createActiveSection,
    renameActiveWatchlist,
    renameActiveSection,
    deleteActiveWatchlist,
    deleteActiveSection,
    reorderActiveSection,
    switchWatchlist,
    moveActiveWatchlistItem,
    removeFromActiveWatchlist,
    storageHydrated,
  } = useWatchlist();

  const railGroups = partitionEnrichedItemsBySections(
    items,
    watchedTickers,
    activeSections,
    activeTickerSections,
  );
  const showLoadingState = !mounted || !storageHydrated;
  const showRailContent = mounted && storageHydrated;

  if (isFullWatchlistPage(pathname)) {
    return null;
  }

  return (
    <div
      suppressHydrationWarning
      className={cn(
        "hidden h-full min-h-0 shrink-0 self-stretch overflow-hidden md:flex md:border-l md:border-[#E4E4E7]",
        WATCHLIST_RAIL_WIDTH_MOTION_CLASS,
      )}
      style={{ width: `${outerWidthPx}px` }}
      aria-label="Watchlist panel"
    >
      <div
        className={watchlistRailSurfaceClass}
        style={{ width: expanded ? `${WATCHLIST_PANEL_WIDTH_PX}px` : "100%" }}
      >
        <div
          className={cn(
            "flex shrink-0 items-center pt-2",
            expanded ? "justify-between gap-2 px-2 pl-3 pr-2" : "justify-center px-1",
          )}
        >
          {expanded ? (
            <>
              {mounted && storageHydrated ? (
                <WatchlistOptionsMenu
                  name={activeWatchlistName}
                  watchlists={watchlists}
                  activeWatchlistId={activeWatchlistId}
                  onCreate={createWatchlist}
                  onCreateSection={createActiveSection}
                  onRename={renameActiveWatchlist}
                  onDelete={deleteActiveWatchlist}
                  onSwitch={switchWatchlist}
                  variant="rail-title"
                  className="min-w-0 flex-1"
                  ready={storageHydrated}
                />
              ) : (
                <WatchlistRailTitleSkeleton />
              )}
              <WatchlistRailFullPageLink />
              <WatchlistRailToggle expanded={expanded} onToggle={toggleCollapsed} />
            </>
          ) : (
            <span className="sr-only">Watchlist</span>
          )}
          {!expanded ? <WatchlistRailToggle expanded={expanded} onToggle={toggleCollapsed} /> : null}
        </div>

        <div
          className={cn(
            "grid min-h-0 flex-1 transition-[grid-template-rows] duration-[280ms] ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none",
            expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="flex min-h-0 h-full flex-col overflow-hidden">
            <DropdownScrollArea
              className={cn(
                "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain overscroll-x-hidden px-1 pb-2",
                panelOverlayScrollGutterClassName,
              )}
              wheelIsolation
              edgeFade={false}
              suppressHydrationWarning
            >
              {showRailContent ? (
                <WatchlistRailScrollContent
                  showLoadingState={showLoadingState}
                  empty={empty}
                  error={error}
                  railGroups={railGroups}
                  watchedTickers={watchedTickers}
                  pathname={pathname}
                  tabParam={tabParam}
                  pricesLoading={pricesLoading}
                  loading={loading}
                  moveActiveWatchlistItem={moveActiveWatchlistItem}
                  removeFromActiveWatchlist={removeFromActiveWatchlist}
                  renameActiveSection={renameActiveSection}
                  deleteActiveSection={deleteActiveSection}
                  reorderActiveSection={reorderActiveSection}
                />
              ) : (
                <WatchlistRailSkeleton />
              )}
            </DropdownScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
}
