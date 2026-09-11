"use client";

import { useMemo } from "react";
import { CompanyLogo } from "@/components/screener/company-logo";
import { IntentPrefetchLink } from "@/components/layout/intent-prefetch-link";
import { ChangeCaretIcon, ChangePct, formatSignedChangePct } from "@/components/screener/change-pct";
import { IndicesTableSkeleton } from "@/components/markets/markets-skeletons";
import { TABLE_END_ALIGNED_PAD_CLASS } from "@/components/screener/screener-table-pad";
import {
  SCREENER_TABLE_DATA_ROW_CLASS,
  SCREENER_TABLE_HEADER_STICKY_CLASS,
  SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
  SCREENER_TABLE_ROUNDED_HEADER_CLASS,
  SCREENER_TABLE_ROW_HOVER_PAD_CLASS,
  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
  SCREENER_TABLE_STROKE_INSET_CLASS,
  ScreenerTableScroll,
} from "@/components/screener/screener-table-scroll";
import { WatchlistStarToggle } from "@/components/watchlist/watchlist-star-button";
import type { EtfTableRow } from "@/lib/screener/screener-etfs-universe";
import { SCREENER_ETFS_PAGE_SIZE } from "@/lib/screener/screener-markets-page-size";
import { useWatchlist } from "@/lib/watchlist/use-watchlist-client";
import { cn } from "@/lib/utils";

function formatValue(v: number): string {
  if (!Number.isFinite(v)) return "-";
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ChangeCell({ value }: { value: number | null }) {
  return <ChangePct value={value} />;
}

function ValueAndChangeCell({ value, change1D }: { value: number; change1D: number | null }) {
  const hasValue = Number.isFinite(value);
  const hasChange = change1D != null && Number.isFinite(change1D);
  const positive = (change1D ?? 0) >= 0;
  return (
    <div className="min-w-0 w-full text-right">
      <div className="min-w-0 w-full font-['Inter'] text-[14px] font-semibold leading-5 tabular-nums text-fg">
        {hasValue ? formatValue(value) : "-"}
      </div>
      <div
        className={cn(
          "mt-0.5 inline-flex min-w-0 w-full items-center justify-end gap-1 text-[12px] font-medium leading-4 tabular-nums",
          !hasChange ? "text-fg-muted" : positive ? "text-up" : "text-down",
        )}
      >
        {hasChange ? (
          <>
            <ChangeCaretIcon direction={positive ? "up" : "down"} />
            <span className="min-w-0 truncate">{formatSignedChangePct(change1D!)}</span>
          </>
        ) : (
          "-"
        )}
      </div>
    </div>
  );
}

/** Mobile: # + ETF + price. `sm+`: # + ETF + … (star sits outside the link). */
const rowLinkGrid =
  "grid grid-cols-[28px_minmax(0,2fr)_1fr] gap-x-2 sm:grid-cols-[48px_2fr_1fr_1fr_1fr_1fr] sm:gap-x-2";

const desktopNumericCellClass = cn(
  "hidden min-w-0 w-full text-right sm:block",
  TABLE_END_ALIGNED_PAD_CLASS,
);

const mobileRankCellClass =
  "text-center text-[14px] font-semibold leading-5 tabular-nums text-fg-muted";

export function EtfsTable({
  initialRows,
  rankOffset = 0,
}: {
  initialRows?: EtfTableRow[];
  /** Global rank for first row when paginated (same as {@link CryptoTable}). */
  rankOffset?: number;
}) {
  const rows = Array.isArray(initialRows) ? initialRows : [];
  const { watchedUnion, loaded, storageHydrated, toggleTicker, watchlists, activeWatchlistId } =
    useWatchlist();

  const safeRows = useMemo(() => rows, [rows]);

  if (safeRows.length === 0) {
    return <IndicesTableSkeleton rows={SCREENER_ETFS_PAGE_SIZE} />;
  }

  return (
    <ScreenerTableScroll minWidthClassName="min-w-0" className="h-fit">
      <div className="bg-surface">
        <div
          className={cn(
            SCREENER_TABLE_HEADER_STICKY_CLASS,
            SCREENER_TABLE_ROUNDED_HEADER_CLASS,
            SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
            "md:border-b-0",
          )}
        >
          <div className={SCREENER_TABLE_ROW_HOVER_PAD_CLASS}>
            <div className="flex min-h-[44px] min-w-0 w-full items-center gap-x-1.5 py-0 text-[14px] font-medium leading-5 text-fg-muted sm:gap-x-2">
              <div className="hidden w-6 shrink-0 sm:block sm:w-10" aria-hidden />
              <div className={cn(rowLinkGrid, "min-h-[44px] w-full items-center")}>
                <div className={cn(mobileRankCellClass, "text-[14px] font-medium")}>#</div>
                <div className="min-w-0 w-full text-left">ETF</div>
                <div className={cn("min-w-0 w-full text-right", TABLE_END_ALIGNED_PAD_CLASS)}>Price</div>
                <div className={cn(desktopNumericCellClass, "truncate")}>1D %</div>
                <div className={cn(desktopNumericCellClass, "truncate")}>1M %</div>
                <div className={cn(desktopNumericCellClass, "truncate")}>YTD %</div>
              </div>
            </div>
          </div>
          <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
        </div>

        <div>
          {safeRows.map((r, i) => {
            const wlKey = r.symbol.trim().toUpperCase();
            return (
              <div key={r.symbol} className={SCREENER_TABLE_DATA_ROW_CLASS}>
                <div className={SCREENER_TABLE_ROW_HOVER_PAD_CLASS}>
                  <div
                    className={cn(
                      "flex min-h-[60px] min-w-0 w-full items-center gap-x-1.5 max-md:gap-x-1.5 sm:gap-x-2",
                      SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
                    )}
                  >
                    <WatchlistStarToggle
                      className="hidden w-6 shrink-0 items-center justify-center px-1 sm:flex sm:w-10 sm:px-3"
                      storageKey={wlKey}
                      label={r.name}
                      watched={watchedUnion}
                      loaded={loaded}
                      storageHydrated={storageHydrated}
                      toggleTicker={toggleTicker}
                      watchlists={watchlists}
                      activeWatchlistId={activeWatchlistId}
                    />
                    <IntentPrefetchLink
                      href={`/stock/${encodeURIComponent(wlKey)}`}
                      prefetch={false}
                      pendingAsset={{
                        kind: "stock",
                        symbol: wlKey,
                        name: r.name,
                        price: r.value,
                        changePct: r.change1D,
                      }}
                      className={cn(
                        rowLinkGrid,
                        "min-h-[56px] w-full cursor-pointer items-center justify-items-stretch no-underline text-fg visited:text-fg sm:min-h-[60px]",
                      )}
                      aria-label={`Open ${r.name} (${wlKey})`}
                    >
                      <div className={mobileRankCellClass}>{rankOffset + i + 1}</div>
                      <div className="flex min-w-0 items-center justify-start gap-[12px] pr-0 text-left sm:pr-4">
                        <CompanyLogo name={r.name} logoUrl="" symbol={wlKey} />
                        <div className="min-w-0">
                          <div className="truncate text-[14px] font-semibold leading-5 text-fg underline-offset-2 decoration-fg-muted group-hover/row:underline">
                            {wlKey}
                          </div>
                          <div className="truncate text-[12px] font-normal leading-4 text-fg-muted">
                            <span>{r.name}</span>
                          </div>
                        </div>
                      </div>
                      <div className="block sm:hidden">
                        <ValueAndChangeCell value={r.value} change1D={r.change1D} />
                      </div>
                      <div
                        className={cn(
                          desktopNumericCellClass,
                          "font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-fg",
                        )}
                      >
                        {formatValue(r.value)}
                      </div>
                      <div className={desktopNumericCellClass}>
                        <ChangeCell value={r.change1D} />
                      </div>
                      <div className={desktopNumericCellClass}>
                        <ChangeCell value={r.change1M} />
                      </div>
                      <div className={desktopNumericCellClass}>
                        <ChangeCell value={r.changeYTD} />
                      </div>
                    </IntentPrefetchLink>
                  </div>
                </div>
                {i < safeRows.length - 1 ? (
                  <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </ScreenerTableScroll>
  );
}
