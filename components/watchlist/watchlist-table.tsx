"use client";

import Link from "next/link";
import { useState } from "react";
import { GripVertical } from "@/lib/icons";

import { eodhdCryptoSpotTickerDisplay } from "@/lib/crypto/eodhd-crypto-ticker-display";
import { CompanyLogo } from "@/components/screener/company-logo";
import { WatchlistEmptyState } from "@/components/watchlist/watchlist-empty-state";
import { WatchlistHeaderActions } from "@/components/watchlist/watchlist-header-actions";
import { WatchlistRowRemoveButton } from "@/components/watchlist/watchlist-star-button";
import { WatchlistSectionHeader } from "@/components/watchlist/watchlist-section-header";
import type { WatchlistEnrichedItem } from "@/lib/watchlist/enriched-types";
import { partitionEnrichedItemsBySections } from "@/lib/watchlist/sections";
import { normalizeWatchlistStorageKey } from "@/lib/watchlist/normalize-storage-key";
import type { WatchlistDropTarget } from "@/lib/watchlist/watchlist-drag";
import { readWatchlistDragData, writeWatchlistDragData } from "@/lib/watchlist/watchlist-drag";
import { useWatchlist } from "@/lib/watchlist/use-watchlist-client";
import { useWatchlistEnrichedItems } from "@/lib/watchlist/use-watchlist-enriched-items";
import { cn } from "@/lib/utils";

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

function ChangeCell({ value }: { value: number | null }) {
  if (value == null || !Number.isFinite(value)) {
    return <td className="px-4 text-right text-[14px] leading-5 tabular-nums text-[#71717A]">-</td>;
  }
  const positive = value >= 0;
  return (
    <td
      className={`px-4 text-right text-[14px] leading-5 tabular-nums font-medium ${
        positive ? "text-[#16A34A]" : "text-[#DC2626]"
      }`}
    >
      {positive ? "+" : ""}
      {value.toFixed(2)}%
    </td>
  );
}


function WatchlistTableSkeleton() {
  return (
    <div className="min-w-0 -mx-4 overflow-x-auto pb-1 sm:mx-0">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr className="border-t border-b border-[#E4E4E7] bg-white">
            <th className="w-8 px-1 py-3" aria-hidden />
            <th className="py-3 pr-4 text-left text-[14px] font-semibold leading-5 text-[#71717A]">Asset</th>
            {["Price", "1D %", "1M %", "YTD %", "M.Cap", "PE"].map((h) => (
              <th key={h} className="px-4 py-3 text-right text-[14px] font-semibold leading-5 text-[#71717A]">
                {h}
              </th>
            ))}
            <th className="w-10 px-4 py-3 text-center" aria-label="Remove from watchlist" />
          </tr>
        </thead>
        <tbody>
          {[0, 1, 2].map((i) => (
            <tr key={i} className="h-[60px] border-b border-[#E4E4E7]">
              <td className="w-8 px-1" aria-hidden />
              <td className="py-2 pr-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-neutral-200" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-4 w-32 animate-pulse rounded bg-neutral-200" />
                    <div className="h-3 w-14 animate-pulse rounded bg-neutral-100" />
                  </div>
                </div>
              </td>
              {Array.from({ length: 6 }).map((_, j) => (
                <td key={j} className="px-4 text-right">
                  <div className="ml-auto h-4 w-12 animate-pulse rounded bg-neutral-100" />
                </td>
              ))}
              <td className="w-10 px-4 text-center">
                <div className="mx-auto h-5 w-5 max-w-[1.25rem] animate-pulse rounded bg-neutral-100" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
    <tr
      draggable={globalIndex >= 0}
      aria-label={`Reorder ${row.symbol}`}
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
        "group h-[60px] max-h-[60px] cursor-pointer border-b border-[#E4E4E7] transition-colors duration-75 last:border-b-0",
        dragOver ? "bg-[#E4E4E7]" : "hover:bg-neutral-50",
      )}
    >
      <td className="w-8 px-1 align-middle">
        <div
          className={cn(
            "flex h-5 w-5 items-center justify-center text-[#71717A] opacity-0 transition-opacity group-hover:opacity-100",
            globalIndex >= 0 ? "cursor-grab active:cursor-grabbing" : "invisible",
          )}
          aria-hidden
        >
          <GripVertical className="h-4 w-4" strokeWidth={2} />
        </div>
      </td>

      <td className="py-0 pr-4 text-left align-middle">
        <Link
          href={row.href}
          draggable={false}
          className="flex items-center gap-3 text-left text-[#09090B] no-underline visited:text-[#09090B]"
        >
          <CompanyLogo name={row.name} logoUrl={row.logoUrl ?? ""} symbol={row.symbol} />
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold leading-5 underline-offset-2 decoration-[#71717A] group-hover:underline">
              {row.name}
            </div>
            <div className="text-[12px] font-normal leading-4 text-[#71717A] underline-offset-2 decoration-[#71717A] group-hover:underline">
              {row.kind === "crypto" ? eodhdCryptoSpotTickerDisplay(row.symbol) : row.symbol}
            </div>
          </div>
        </Link>
      </td>

      <td className="px-4 text-right text-[14px] font-normal tabular-nums leading-5 text-[#09090B]">
        {formatPrice(row.price, row.kind)}
      </td>

      <ChangeCell value={row.pct1d} />
      <ChangeCell value={row.pct1m} />
      <ChangeCell value={row.ytd} />

      <td className="px-4 text-right text-[14px] font-normal tabular-nums leading-5 text-[#09090B]">
        {row.mcapDisplay}
      </td>
      <td className="px-4 text-right text-[14px] font-normal tabular-nums leading-5 text-[#09090B]">
        {row.peDisplay}
      </td>

      <td className="w-10 px-4 align-middle">
        <div className="flex justify-center">
          <WatchlistRowRemoveButton
            className="flex items-center justify-center"
            storageKey={row.storageKey}
            label={row.symbol}
            onRemove={onRemove}
          />
        </div>
      </td>
    </tr>
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
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex min-w-0 items-center justify-between gap-3">
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

      {storageHydrated &&
      serverListWarning &&
      watched.size > 0 &&
      ready &&
      !error &&
      !hasUsableRows ? (
        <p className="text-[13px] leading-5 text-[#A16207]" role="status">
          {serverListWarning}
        </p>
      ) : null}

      {error ? <p className="text-[14px] leading-5 text-[#B91C1C]">{error}</p> : null}

      {storageHydrated && showBlockingSkeleton ? <WatchlistTableSkeleton /> : null}

      {storageHydrated && !showBlockingSkeleton && empty ? <WatchlistEmptyState /> : null}

      {storageHydrated && watched.size > 0 && hasUsableRows ? (
        <div className="min-w-0 -mx-4 overflow-x-auto pb-1 sm:mx-0">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-t border-b border-[#E4E4E7] bg-white">
                <th className="w-8 px-1 py-3" aria-hidden />
                <th className="py-3 pr-4 text-left text-[14px] font-semibold leading-5 text-[#71717A]">Asset</th>
                {["Price", "1D %", "1M %", "YTD %", "M.Cap", "PE"].map((h) => (
                  <th key={h} className="px-4 py-3 text-right text-[14px] font-semibold leading-5 text-[#71717A]">
                    {h}
                  </th>
                ))}
                <th className="w-10 px-4 py-3 text-center" aria-label="Remove from watchlist" />
              </tr>
            </thead>
            <tbody>
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
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
