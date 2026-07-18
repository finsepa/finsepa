"use client";

import Link from "next/link";
import { useState } from "react";

import { eodhdCryptoSpotTickerDisplay } from "@/lib/crypto/eodhd-crypto-ticker-display";
import { CompanyLogo } from "@/components/screener/company-logo";
import {
  SCREENER_TABLE_BODY_DIVIDE_CLASS,
  SCREENER_TABLE_HEADER_STICKY_CLASS,
  ScreenerTableScroll,
} from "@/components/screener/screener-table-scroll";
import { WatchlistEmptyState } from "@/components/watchlist/watchlist-empty-state";
import { WatchlistHeaderActions } from "@/components/watchlist/watchlist-header-actions";
import { WatchlistRowRemoveButton } from "@/components/watchlist/watchlist-star-button";
import { WatchlistSectionHeader } from "@/components/watchlist/watchlist-section-header";
import type { WatchlistEnrichedItem } from "@/lib/watchlist/enriched-types";
import { partitionEnrichedItemsBySections } from "@/lib/watchlist/sections";
import { normalizeWatchlistStorageKey } from "@/lib/watchlist/normalize-storage-key";
import type { WatchlistDropTarget } from "@/lib/watchlist/watchlist-drag";
import { readWatchlistDragData, writeWatchlistDragData } from "@/lib/watchlist/watchlist-drag";
import { logWatchlistDragEnd, logWatchlistDragStart } from "@/lib/watchlist/state-audit";
import { useWatchlist } from "@/lib/watchlist/use-watchlist-client";
import { useWatchlistEnrichedItems } from "@/lib/watchlist/use-watchlist-enriched-items";
import { cn } from "@/lib/utils";

/** Mobile: asset + price/1D + remove (row drag reorders). Desktop adds metric columns. */
const watchlistRowGridClass =
  "grid-cols-[minmax(0,1fr)_minmax(4.5rem,5.5rem)_40px] gap-x-1.5 sm:grid-cols-[minmax(0,2fr)_repeat(6,minmax(0,1fr))_40px] sm:gap-x-2";

const watchlistRowLinkGridClass =
  "grid-cols-[minmax(0,1fr)_minmax(4.5rem,5.5rem)] gap-x-1.5 sm:grid-cols-[minmax(0,2fr)_repeat(6,minmax(0,1fr))] sm:gap-x-2";

function globalTickerIndex(watchedTickers: string[], storageKey: string): number {
  const key = normalizeWatchlistStorageKey(storageKey);
  return watchedTickers.findIndex((ticker) => normalizeWatchlistStorageKey(ticker) === key);
}

function formatPrice(n: number | null, kind: "stock" | "crypto" | "index"): string {
  if (n == null || !Number.isFinite(n)) return "-";
  if (kind === "crypto" && Math.abs(n) < 1) {
    return `$${n.toLocaleString("en-US", { maximumFractionDigits: 6 })}`;
  }
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercentValue(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function ChangeCell({ value }: { value: number | null }) {
  const isMissing = value == null || !Number.isFinite(value);
  const positive = !isMissing && value! >= 0;
  return (
    <div
      className={`min-w-0 w-full text-right tabular-nums text-[14px] leading-5 font-medium ${
        isMissing ? "text-[#71717A]" : positive ? "text-[#16A34A]" : "text-[#DC2626]"
      }`}
    >
      {formatPercentValue(value)}
    </div>
  );
}

function PriceAndChangeCell({
  price,
  change1D,
  kind,
}: {
  price: number | null;
  change1D: number | null;
  kind: "stock" | "crypto" | "index";
}) {
  const hasPrice = price != null && Number.isFinite(price);
  const hasChange = change1D != null && Number.isFinite(change1D);
  const positive = (change1D ?? 0) >= 0;
  return (
    <div className="min-w-0 w-full text-right">
      <div
        className={`min-w-0 w-full font-['Inter'] text-[14px] font-semibold leading-5 tabular-nums ${
          hasPrice ? "text-[#0F0F0F]" : "text-[#71717A]"
        }`}
      >
        {hasPrice ? formatPrice(price, kind) : "-"}
      </div>
      <div
        className={`mt-0.5 min-w-0 w-full text-[12px] font-medium leading-4 tabular-nums ${
          !hasChange ? "text-[#71717A]" : positive ? "text-[#16A34A]" : "text-[#DC2626]"
        }`}
      >
        {formatPercentValue(change1D)}
      </div>
    </div>
  );
}

function WatchlistTableHeader() {
  return (
    <div
      className={cn(
        "grid min-h-[44px] items-center px-4 py-0 text-[14px] font-medium leading-5 text-[#71717A] max-md:hidden",
        watchlistRowGridClass,
        SCREENER_TABLE_HEADER_STICKY_CLASS,
      )}
    >
      <div className="text-left">Asset</div>
      <div className="min-w-0 w-full text-right">
        <span className="sm:hidden">Price</span>
        <span className="hidden sm:inline">Price</span>
      </div>
      <div className="hidden min-w-0 w-full text-right sm:block">1D %</div>
      <div className="hidden min-w-0 w-full text-right sm:block">1M %</div>
      <div className="hidden min-w-0 w-full text-right sm:block">YTD %</div>
      <div className="hidden min-w-0 w-full text-right sm:block">M.Cap</div>
      <div className="hidden min-w-0 w-full text-right sm:block">PE</div>
      <div aria-label="Remove from watchlist" />
    </div>
  );
}

function WatchlistTableSkeletonRow() {
  return (
    <div className={cn("grid min-h-[60px] items-center bg-white px-4", watchlistRowGridClass)}>
      <div className="flex min-w-0 items-center gap-3 pr-4 max-md:gap-2">
        <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-neutral-200" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-32 animate-pulse rounded bg-neutral-200" />
          <div className="h-3 w-14 animate-pulse rounded bg-neutral-100" />
        </div>
      </div>
      <div className="space-y-1.5 text-right sm:space-y-0">
        <div className="ml-auto h-4 w-14 animate-pulse rounded bg-neutral-100 sm:mx-0 sm:ml-auto sm:w-12" />
        <div className="ml-auto h-3 w-10 animate-pulse rounded bg-neutral-100 sm:hidden" />
      </div>
      {Array.from({ length: 5 }).map((_, j) => (
        <div key={j} className="hidden text-right sm:block">
          <div className="ml-auto h-4 w-12 animate-pulse rounded bg-neutral-100" />
        </div>
      ))}
      <div className="flex justify-center">
        <div className="h-5 w-5 max-w-[1.25rem] animate-pulse rounded bg-neutral-100" />
      </div>
    </div>
  );
}

function WatchlistTableSkeleton() {
  return (
    <ScreenerTableScroll>
      <div className="bg-white">
        <WatchlistTableHeader />
        <div className={SCREENER_TABLE_BODY_DIVIDE_CLASS}>
          {[0, 1, 2].map((i) => (
            <WatchlistTableSkeletonRow key={i} />
          ))}
        </div>
      </div>
    </ScreenerTableScroll>
  );
}

function WatchlistTableRow({
  row,
  globalIndex,
  sectionId,
  onRemove,
  onMoveItem,
}: {
  row: WatchlistEnrichedItem;
  globalIndex: number;
  sectionId: string | null;
  onRemove: (ticker: string) => void;
  onMoveItem: (fromIndex: number, target: WatchlistDropTarget) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      draggable={globalIndex >= 0}
      aria-label={`Reorder ${row.symbol}`}
      onDragStart={(event) => {
        if (globalIndex < 0) return;
        logWatchlistDragStart(row.storageKey, globalIndex, sectionId);
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
        logWatchlistDragEnd(payload.storageKey, { kind: "row", toIndex: globalIndex, sectionId });
        onMoveItem(payload.globalIndex, { kind: "row", toIndex: globalIndex, sectionId });
      }}
      className={cn(
        "group grid min-h-[60px] cursor-grab items-center bg-white px-4 transition-colors duration-75 active:cursor-grabbing max-md:touch-manipulation",
        watchlistRowGridClass,
        globalIndex < 0 && "cursor-default",
        dragOver ? "bg-[#E4E4E7]" : "hover:bg-neutral-50",
      )}
    >
      <Link
        href={row.href}
        draggable={false}
        className={cn(
          "col-span-2 col-start-1 grid min-h-[56px] min-w-0 w-full items-center justify-items-stretch no-underline text-[#0F0F0F] visited:text-[#0F0F0F] sm:col-span-7 sm:col-start-1 sm:min-h-[60px]",
          watchlistRowLinkGridClass,
        )}
        aria-label={`Open ${row.name} (${row.symbol})`}
      >
        <div className="flex min-w-0 items-center justify-start gap-3 pr-4 text-left max-md:gap-2">
          <CompanyLogo name={row.name} logoUrl={row.logoUrl ?? ""} symbol={row.symbol} />
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold leading-5 text-[#0F0F0F] underline-offset-2 decoration-[#71717A] group-hover:underline">
              {row.name}
            </div>
            <div className="text-[12px] font-normal leading-4 text-[#71717A] underline-offset-2 decoration-[#71717A] group-hover:underline">
              {row.kind === "crypto" ? eodhdCryptoSpotTickerDisplay(row.symbol) : row.symbol}
            </div>
          </div>
        </div>

        <div className="block sm:hidden">
          <PriceAndChangeCell price={row.price} change1D={row.pct1d} kind={row.kind} />
        </div>

        <div
          className={`hidden min-w-0 w-full text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums sm:block ${
            row.price == null || !Number.isFinite(row.price) ? "text-[#71717A]" : "text-[#0F0F0F]"
          }`}
        >
          {formatPrice(row.price, row.kind)}
        </div>

        <div className="hidden min-w-0 w-full sm:block">
          <ChangeCell value={row.pct1d} />
        </div>
        <div className="hidden min-w-0 w-full sm:block">
          <ChangeCell value={row.pct1m} />
        </div>
        <div className="hidden min-w-0 w-full sm:block">
          <ChangeCell value={row.ytd} />
        </div>
        <div className="hidden min-w-0 w-full text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-[#0F0F0F] sm:block">
          {row.mcapDisplay}
        </div>
        <div className="hidden min-w-0 w-full text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-[#0F0F0F] sm:block">
          {row.peDisplay}
        </div>
      </Link>

      <div className="flex justify-center opacity-100 transition-opacity duration-150 md:opacity-0 md:group-hover:opacity-100 md:has-[:focus-visible]:opacity-100">
        <WatchlistRowRemoveButton
          className="flex items-center justify-center"
          storageKey={row.storageKey}
          label={row.symbol}
          onRemove={onRemove}
        />
      </div>
    </div>
  );
}

function UserSectionGroup({
  label,
  sectionId,
  sectionIndex,
  rows,
  watchedTickers,
  onRemove,
  onMoveItem,
  onRenameSection,
  onDeleteSection,
  onReorderSection,
}: {
  label: string;
  sectionId: string;
  sectionIndex: number;
  rows: WatchlistEnrichedItem[];
  watchedTickers: string[];
  onRemove: (ticker: string) => void;
  onMoveItem: (fromIndex: number, target: WatchlistDropTarget) => void;
  onRenameSection: (sectionId: string, name: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onReorderSection: (fromSectionIndex: number, toSectionIndex: number) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      <WatchlistSectionHeader
        variant="card"
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

      {!collapsed &&
        rows.map((row) => (
          <WatchlistTableRow
            key={row.entryId}
            row={row}
            globalIndex={globalTickerIndex(watchedTickers, row.storageKey)}
            sectionId={sectionId}
            onRemove={onRemove}
            onMoveItem={onMoveItem}
          />
        ))}
    </>
  );
}

export function WatchlistTable() {
  const {
    watched,
    watchedTickers,
    removeFromActiveWatchlist,
    moveActiveWatchlistItem,
    createWatchlist,
    createActiveSection,
    renameActiveSection,
    deleteActiveSection,
    reorderActiveSection,
    renameActiveWatchlist,
    deleteActiveWatchlist,
    switchWatchlist,
    watchlists,
    activeWatchlistId,
    activeWatchlistName,
    activeSections,
    activeTickerSections,
    serverListWarning,
    storageHydrated,
    watchedUnion,
  } = useWatchlist();
  const { items, loading, ready, error } = useWatchlistEnrichedItems({ enabled: true });

  const tableGroups = partitionEnrichedItemsBySections(
    items,
    watchedTickers,
    activeSections,
    activeTickerSections,
  );

  const hasUsableRows = watched.size > 0 && items.length > 0;
  const empty = storageHydrated && watched.size === 0 && !error;
  const showBlockingSkeleton = storageHydrated && watched.size > 0 && !hasUsableRows && !error && !ready;
  const refreshing = loading && hasUsableRows;

  return (
    <div className="flex min-w-0 flex-col gap-5 max-md:gap-0 sm:gap-5">
      <div className="hidden min-w-0 items-center gap-3 sm:flex sm:justify-between">
        <WatchlistHeaderActions
          name={activeWatchlistName}
          watchlists={watchlists}
          activeWatchlistId={activeWatchlistId}
          onCreate={createWatchlist}
          onCreateSection={createActiveSection}
          onRename={renameActiveWatchlist}
          onDelete={deleteActiveWatchlist}
          onSwitch={switchWatchlist}
          storageHydrated={storageHydrated}
        />
        {refreshing ? (
          <span className="shrink-0 text-[12px] font-medium text-[#A1A1AA]" aria-live="polite">
            Updating…
          </span>
        ) : null}
      </div>

      {!storageHydrated ? <WatchlistTableSkeleton /> : null}

      {storageHydrated && serverListWarning && (watched.size > 0 || watchedUnion.size > 0) ? (
        <p className="text-[13px] leading-5 text-[#A16207]" role="status">
          {serverListWarning}
        </p>
      ) : null}

      {error ? <p className="text-[14px] leading-5 text-[#B91C1C]">{error}</p> : null}

      {storageHydrated && showBlockingSkeleton ? <WatchlistTableSkeleton /> : null}

      {storageHydrated && !showBlockingSkeleton && empty ? <WatchlistEmptyState /> : null}

      {storageHydrated && watched.size > 0 && hasUsableRows ? (
        <ScreenerTableScroll>
          <div className="bg-white">
            <WatchlistTableHeader />
            <div className={SCREENER_TABLE_BODY_DIVIDE_CLASS}>
              {tableGroups.unsectioned.map((row) => (
                <WatchlistTableRow
                  key={row.entryId}
                  row={row}
                  globalIndex={globalTickerIndex(watchedTickers, row.storageKey)}
                  sectionId={null}
                  onRemove={removeFromActiveWatchlist}
                  onMoveItem={moveActiveWatchlistItem}
                />
              ))}
              {tableGroups.sections.map(({ section, rows }, sectionIndex) => (
                <UserSectionGroup
                  key={section.id}
                  sectionId={section.id}
                  sectionIndex={sectionIndex}
                  label={section.name}
                  rows={rows}
                  watchedTickers={watchedTickers}
                  onRemove={removeFromActiveWatchlist}
                  onMoveItem={moveActiveWatchlistItem}
                  onRenameSection={renameActiveSection}
                  onDeleteSection={deleteActiveSection}
                  onReorderSection={reorderActiveSection}
                />
              ))}
            </div>
          </div>
        </ScreenerTableScroll>
      ) : null}
    </div>
  );
}

/** Route segment loading — shows immediately on navigation to /watchlist. */
export function WatchlistPageLoadingShell() {
  return (
    <div className="min-w-0 px-4 py-4 sm:px-9 sm:py-6">
      <WatchlistTableSkeleton />
    </div>
  );
}
