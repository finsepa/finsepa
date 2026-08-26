"use client";

import Link from "next/link";
import { useState } from "react";

import { eodhdCryptoSpotTickerDisplay } from "@/lib/crypto/eodhd-crypto-ticker-display";
import { CompanyLogo } from "@/components/screener/company-logo";
import {
  SCREENER_TABLE_DATA_ROW_CLASS,
  SCREENER_TABLE_HEADER_STICKY_CLASS,
  SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
  SCREENER_TABLE_ROUNDED_HEADER_CLASS,
  SCREENER_TABLE_ROW_HOVER_PAD_CLASS,
  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
  SCREENER_TABLE_STROKE_INSET_CLASS,
  ScreenerTableScroll,
  TABLE_END_ALIGNED_PAD_CLASS,
  TABLE_START_ALIGNED_PAD_CLASS,
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

function formatPrice(n: number | null, kind: "stock" | "crypto" | "index" | "forex"): string {
  if (n == null || !Number.isFinite(n)) return "-";
  if (kind === "forex") {
    const digits = n >= 20 ? 2 : 4;
    return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
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
        isMissing ? "text-fg-muted" : positive ? "text-up" : "text-down"
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
  kind: "stock" | "crypto" | "index" | "forex";
}) {
  const hasPrice = price != null && Number.isFinite(price);
  const hasChange = change1D != null && Number.isFinite(change1D);
  const positive = (change1D ?? 0) >= 0;
  return (
    <div className="min-w-0 w-full text-right">
      <div
        className={`min-w-0 w-full font-['Inter'] text-[14px] font-semibold leading-5 tabular-nums ${
          hasPrice ? "text-fg" : "text-fg-muted"
        }`}
      >
        {hasPrice ? formatPrice(price, kind) : "-"}
      </div>
      <div
        className={`mt-0.5 min-w-0 w-full text-[12px] font-medium leading-4 tabular-nums ${
          !hasChange ? "text-fg-muted" : positive ? "text-up" : "text-down"
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
        SCREENER_TABLE_HEADER_STICKY_CLASS,
        SCREENER_TABLE_ROUNDED_HEADER_CLASS,
        SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
        "max-md:hidden md:border-b-0",
      )}
    >
      <div className={SCREENER_TABLE_ROW_HOVER_PAD_CLASS}>
        <div
          className={cn(
            "grid min-h-[44px] items-center py-0 text-[14px] font-medium leading-5 text-fg-muted",
            watchlistRowGridClass,
          )}
        >
          <div className={cn("text-left", TABLE_START_ALIGNED_PAD_CLASS)}>Asset</div>
          <div className={cn("min-w-0 w-full text-right", TABLE_END_ALIGNED_PAD_CLASS)}>Price</div>
          <div className={cn("hidden min-w-0 w-full text-right sm:block", TABLE_END_ALIGNED_PAD_CLASS)}>
            1D %
          </div>
          <div className={cn("hidden min-w-0 w-full text-right sm:block", TABLE_END_ALIGNED_PAD_CLASS)}>
            1M %
          </div>
          <div className={cn("hidden min-w-0 w-full text-right sm:block", TABLE_END_ALIGNED_PAD_CLASS)}>
            YTD %
          </div>
          <div className={cn("hidden min-w-0 w-full text-right sm:block", TABLE_END_ALIGNED_PAD_CLASS)}>
            M.Cap
          </div>
          <div className={cn("hidden min-w-0 w-full text-right sm:block", TABLE_END_ALIGNED_PAD_CLASS)}>
            PE
          </div>
          <div className={TABLE_END_ALIGNED_PAD_CLASS} aria-label="Remove from watchlist" />
        </div>
      </div>
      <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
    </div>
  );
}

function WatchlistTableSkeletonRow({ showDivider }: { showDivider: boolean }) {
  return (
    <div className={SCREENER_TABLE_DATA_ROW_CLASS}>
      <div className={SCREENER_TABLE_ROW_HOVER_PAD_CLASS}>
        <div className={cn("grid min-h-[60px] items-center bg-surface", watchlistRowGridClass)}>
          <div
            className={cn(
              "flex min-w-0 items-center gap-3 pr-4 max-md:gap-2",
              TABLE_START_ALIGNED_PAD_CLASS,
            )}
          >
            <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-skeleton" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-32 animate-pulse rounded bg-skeleton" />
              <div className="h-3 w-14 animate-pulse rounded bg-skeleton" />
            </div>
          </div>
          <div className={cn("space-y-1.5 text-right sm:space-y-0", TABLE_END_ALIGNED_PAD_CLASS)}>
            <div className="ml-auto h-4 w-14 animate-pulse rounded bg-skeleton sm:mx-0 sm:ml-auto sm:w-12" />
            <div className="ml-auto h-3 w-10 animate-pulse rounded bg-skeleton sm:hidden" />
          </div>
          {Array.from({ length: 5 }).map((_, j) => (
            <div key={j} className={cn("hidden text-right sm:block", TABLE_END_ALIGNED_PAD_CLASS)}>
              <div className="ml-auto h-4 w-12 animate-pulse rounded bg-skeleton" />
            </div>
          ))}
          <div className={cn("flex justify-center", TABLE_END_ALIGNED_PAD_CLASS)}>
            <div className="h-5 w-5 max-w-[1.25rem] animate-pulse rounded bg-skeleton" />
          </div>
        </div>
      </div>
      {showDivider ? <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden /> : null}
    </div>
  );
}

function WatchlistTableSkeleton() {
  return (
    <ScreenerTableScroll>
      <div className="bg-surface">
        <WatchlistTableHeader />
        {[0, 1, 2].map((i) => (
          <WatchlistTableSkeletonRow key={i} showDivider={i < 2} />
        ))}
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
  showDivider = false,
}: {
  row: WatchlistEnrichedItem;
  globalIndex: number;
  sectionId: string | null;
  onRemove: (ticker: string) => void;
  onMoveItem: (fromIndex: number, target: WatchlistDropTarget) => void;
  /** Mobile inset stroke under the row (desktop uses parent `divide-y`). */
  showDivider?: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div className={SCREENER_TABLE_DATA_ROW_CLASS}>
      <div className={SCREENER_TABLE_ROW_HOVER_PAD_CLASS}>
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
            "group grid min-h-[60px] cursor-grab items-center transition-colors duration-75 active:cursor-grabbing max-md:touch-manipulation",
            watchlistRowGridClass,
            SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
            globalIndex < 0 && "cursor-default",
            // Match screener tables: dark-mode `table-row-hover` (never light `neutral-50`).
            dragOver ? "bg-stroke" : "max-md:hover:bg-table-row-hover",
          )}
        >
          <Link
            href={row.href}
            draggable={false}
            className={cn(
              "col-span-2 col-start-1 grid min-h-[56px] min-w-0 w-full items-center justify-items-stretch no-underline text-fg visited:text-fg sm:col-span-7 sm:col-start-1 sm:min-h-[60px]",
              watchlistRowLinkGridClass,
            )}
            aria-label={`Open ${row.name} (${row.symbol})`}
          >
            <div
              className={cn(
                "flex min-w-0 items-center justify-start gap-3 pr-4 text-left max-md:gap-2",
                TABLE_START_ALIGNED_PAD_CLASS,
              )}
            >
              <CompanyLogo name={row.name} logoUrl={row.logoUrl ?? ""} symbol={row.symbol} />
              <div className="min-w-0">
                <div className="truncate text-[14px] font-semibold leading-5 text-fg underline-offset-2 decoration-fg-muted group-hover:underline">
                  {row.name}
                </div>
                <div className="text-[12px] font-normal leading-4 text-fg-muted underline-offset-2 decoration-fg-muted group-hover:underline">
                  {row.kind === "crypto" ? eodhdCryptoSpotTickerDisplay(row.symbol) : row.symbol}
                </div>
              </div>
            </div>

            <div className={cn("block sm:hidden", TABLE_END_ALIGNED_PAD_CLASS)}>
              <PriceAndChangeCell price={row.price} change1D={row.pct1d} kind={row.kind} />
            </div>

            <div
              className={cn(
                "hidden min-w-0 w-full text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums sm:block",
                TABLE_END_ALIGNED_PAD_CLASS,
                row.price == null || !Number.isFinite(row.price) ? "text-fg-muted" : "text-fg",
              )}
            >
              {formatPrice(row.price, row.kind)}
            </div>

            <div className={cn("hidden min-w-0 w-full sm:block", TABLE_END_ALIGNED_PAD_CLASS)}>
              <ChangeCell value={row.pct1d} />
            </div>
            <div className={cn("hidden min-w-0 w-full sm:block", TABLE_END_ALIGNED_PAD_CLASS)}>
              <ChangeCell value={row.pct1m} />
            </div>
            <div className={cn("hidden min-w-0 w-full sm:block", TABLE_END_ALIGNED_PAD_CLASS)}>
              <ChangeCell value={row.ytd} />
            </div>
            <div
              className={cn(
                "hidden min-w-0 w-full text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-fg sm:block",
                TABLE_END_ALIGNED_PAD_CLASS,
              )}
            >
              {row.mcapDisplay}
            </div>
            <div
              className={cn(
                "hidden min-w-0 w-full text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-fg sm:block",
                TABLE_END_ALIGNED_PAD_CLASS,
              )}
            >
              {row.peDisplay}
            </div>
          </Link>

          <div
            className={cn(
              "flex justify-center opacity-100 transition-opacity duration-150 md:opacity-0 md:group-hover:opacity-100 md:has-[:focus-visible]:opacity-100",
              TABLE_END_ALIGNED_PAD_CLASS,
            )}
          >
            <WatchlistRowRemoveButton
              className="flex items-center justify-center"
              storageKey={row.storageKey}
              label={row.symbol}
              onRemove={onRemove}
            />
          </div>
        </div>
      </div>
      {showDivider ? <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden /> : null}
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
  showTrailingSectionStroke,
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
  /** Inset rule after this section when another section follows. */
  showTrailingSectionStroke: boolean;
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
        rows.map((row, i) => {
          const isLastInSection = i === rows.length - 1;
          const showDivider = !isLastInSection || showTrailingSectionStroke;
          return (
            <WatchlistTableRow
              key={row.entryId}
              row={row}
              globalIndex={globalTickerIndex(watchedTickers, row.storageKey)}
              sectionId={sectionId}
              onRemove={onRemove}
              onMoveItem={onMoveItem}
              showDivider={showDivider}
            />
          );
        })}
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
  const { items, ready, error } = useWatchlistEnrichedItems({ enabled: true });

  const tableGroups = partitionEnrichedItemsBySections(
    items,
    watchedTickers,
    activeSections,
    activeTickerSections,
  );

  const hasUsableRows = watched.size > 0 && items.length > 0;
  const empty = storageHydrated && watched.size === 0 && !error;
  const showBlockingSkeleton = storageHydrated && watched.size > 0 && !hasUsableRows && !error && !ready;

  return (
    <div className="flex min-w-0 flex-col gap-5 max-md:gap-0 sm:gap-5">
      <div className="hidden min-w-0 items-center gap-3 sm:flex sm:justify-between">
        <WatchlistHeaderActions
          name={activeWatchlistName}
          watchlists={watchlists}
          activeWatchlistId={activeWatchlistId}
          assetCount={watchedTickers.length}
          onCreate={createWatchlist}
          onCreateSection={createActiveSection}
          onRename={renameActiveWatchlist}
          onDelete={deleteActiveWatchlist}
          onSwitch={switchWatchlist}
          storageHydrated={storageHydrated}
        />
      </div>

      {!storageHydrated ? <WatchlistTableSkeleton /> : null}

      {storageHydrated && serverListWarning && (watched.size > 0 || watchedUnion.size > 0) ? (
        <p className="text-[13px] leading-5 text-[#A16207]" role="status">
          {serverListWarning}
        </p>
      ) : null}

      {error ? <p className="text-[14px] leading-5 text-down">{error}</p> : null}

      {storageHydrated && showBlockingSkeleton ? <WatchlistTableSkeleton /> : null}

      {storageHydrated && !showBlockingSkeleton && empty ? <WatchlistEmptyState /> : null}

      {storageHydrated && watched.size > 0 && hasUsableRows ? (
        <ScreenerTableScroll>
          <div className="bg-surface">
            <WatchlistTableHeader />
            {tableGroups.unsectioned.map((row, i) => {
              const isLastUnsectioned = i === tableGroups.unsectioned.length - 1;
              const showDivider = !isLastUnsectioned || tableGroups.sections.length > 0;
              return (
                <WatchlistTableRow
                  key={row.entryId}
                  row={row}
                  globalIndex={globalTickerIndex(watchedTickers, row.storageKey)}
                  sectionId={null}
                  onRemove={removeFromActiveWatchlist}
                  onMoveItem={moveActiveWatchlistItem}
                  showDivider={showDivider}
                />
              );
            })}
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
                showTrailingSectionStroke={sectionIndex < tableGroups.sections.length - 1}
              />
            ))}
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
