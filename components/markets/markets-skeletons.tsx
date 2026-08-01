"use client";

import type { ReactNode } from "react";

import { LogoSkeleton, SkeletonBox, TextSkeleton } from "@/components/markets/skeleton";
import { MOBILE_PANEL_CARD_CLASS } from "@/components/design-system/card-surface-styles";
import {
  INDEX_CARD_SURFACE_CLASS,
  INDEX_CARDS_GRID_CLASS,
  INDEX_CARDS_SCROLL_CLASS,
  INDEX_CARDS_SCROLL_OUTER_CLASS,
} from "@/components/screener/index-cards";
import {
  SCREENER_TABLE_HEADER_STICKY_CLASS,
  SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
  SCREENER_TABLE_ROUNDED_HEADER_CLASS,
  SCREENER_TABLE_ROW_HOVER_PAD_CLASS,
  SCREENER_TABLE_STROKE_INSET_CLASS,
  ScreenerTableScroll,
} from "@/components/screener/screener-table-scroll";
import { SCREENER_COMPANIES_PAGE_SIZE } from "@/lib/screener/screener-markets-page-size";
import { cn } from "@/lib/utils";

/** Star sits outside; matches live tables after chrome update. */
const stocksRowGrid =
  "grid grid-cols-[22px_minmax(0,1fr)_minmax(4.5rem,5.5rem)] gap-x-1.5 sm:grid-cols-[48px_2fr_1fr_1fr_1fr_1fr_1fr_1fr] sm:gap-x-2";
const cryptoRowGrid =
  "grid grid-cols-[22px_minmax(0,1fr)_minmax(4.5rem,5.5rem)] gap-x-1.5 sm:grid-cols-[48px_2fr_1fr_1fr_1fr_1fr_1fr] sm:gap-x-2";
const indicesRowGrid =
  "grid grid-cols-[28px_minmax(0,2fr)_1fr] gap-x-2 sm:grid-cols-[48px_2fr_1fr_1fr_1fr_1fr] sm:gap-x-2";

const desktopNumericCellClass = "hidden min-w-0 w-full justify-end pr-3 sm:flex";

function TableHeaderShell({
  children,
  hideMobileHeader = false,
}: {
  children: ReactNode;
  hideMobileHeader?: boolean;
}) {
  return (
    <div
      className={cn(
        SCREENER_TABLE_HEADER_STICKY_CLASS,
        SCREENER_TABLE_ROUNDED_HEADER_CLASS,
        SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
        "md:border-b-0",
        hideMobileHeader && "max-md:hidden",
      )}
    >
      <div className={SCREENER_TABLE_ROW_HOVER_PAD_CLASS}>{children}</div>
      <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
    </div>
  );
}

function TableRowShell({
  children,
  showDivider,
}: {
  children: ReactNode;
  showDivider: boolean;
}) {
  return (
    <div>
      <div className={SCREENER_TABLE_ROW_HOVER_PAD_CLASS}>
        <div className="flex min-h-[60px] min-w-0 w-full items-center gap-x-1.5 sm:gap-x-2">
          {children}
        </div>
      </div>
      {showDivider ? <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden /> : null}
    </div>
  );
}

function StarSpacerSkeleton() {
  return (
    <div className="hidden w-6 shrink-0 items-center justify-center px-1 sm:flex sm:w-10 sm:px-3">
      <SkeletonBox className="h-4 w-4 rounded" />
    </div>
  );
}

function StarHeaderSpacer() {
  return <div className="hidden w-6 shrink-0 sm:block sm:w-10" aria-hidden />;
}

function CompanyCellSkeleton({ nameWidth }: { nameWidth: string }) {
  return (
    <div className="flex min-w-0 items-center justify-start gap-[12px] pr-0 sm:pr-4">
      <LogoSkeleton />
      <div className="min-w-0 flex-1 space-y-1.5">
        <TextSkeleton wClass={nameWidth} />
        <TextSkeleton wClass="w-10" hClass="h-3" />
      </div>
    </div>
  );
}

/** Matches {@link IndexCards} — stacked label / value / change, no sparkline. */
export function IndexCardSkeleton({ name }: { name: string }) {
  return (
    <div className={`${INDEX_CARD_SURFACE_CLASS} min-h-[112px]`}>
      <span className="text-[14px] font-medium leading-5 text-fg-muted">{name}</span>
      <SkeletonBox className="h-8 w-[7.5rem] max-w-full rounded-md" />
      <TextSkeleton wClass="w-14" hClass="h-3.5" />
    </div>
  );
}

function StocksRowSkeleton({ showDivider }: { showDivider: boolean }) {
  return (
    <TableRowShell showDivider={showDivider}>
      <StarSpacerSkeleton />
      <div className={cn(stocksRowGrid, "min-h-[56px] w-full items-center sm:min-h-[60px]")}>
        <div className="flex justify-center">
          <TextSkeleton wClass="w-4" hClass="h-3.5" />
        </div>
        <CompanyCellSkeleton nameWidth="w-[45%] max-w-[140px]" />
        <div className="flex justify-end sm:hidden">
          <TextSkeleton wClass="w-12" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={desktopNumericCellClass}>
            <TextSkeleton wClass={i === 4 ? "w-10" : "w-12"} />
          </div>
        ))}
      </div>
    </TableRowShell>
  );
}

export function StocksTableSkeleton({
  rows = 10,
  embeddedInMobileCard = false,
  hideMobileHeader = false,
}: {
  rows?: number;
  embeddedInMobileCard?: boolean;
  hideMobileHeader?: boolean;
}) {
  return (
    <ScreenerTableScroll embeddedInMobileCard={embeddedInMobileCard}>
      <div className="bg-surface">
        <TableHeaderShell hideMobileHeader={hideMobileHeader}>
          <div className="flex min-h-[44px] min-w-0 w-full items-center gap-x-1.5 py-0 sm:gap-x-2">
            <StarHeaderSpacer />
            <div className={cn(stocksRowGrid, "min-h-[44px] w-full items-center")}>
              <div className="flex justify-center">
                <SkeletonBox className="h-3 w-4 rounded" />
              </div>
              <div className="flex justify-start">
                <SkeletonBox className="h-3 w-16 rounded" />
              </div>
              <div className="flex min-w-0 w-full justify-end pr-3">
                <SkeletonBox className="h-3 w-10 rounded" />
              </div>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={desktopNumericCellClass}>
                  <SkeletonBox className="h-3 w-10 rounded" />
                </div>
              ))}
            </div>
          </div>
        </TableHeaderShell>
        <div>
          {Array.from({ length: rows }).map((_, i) => (
            <StocksRowSkeleton key={i} showDivider={i < rows - 1} />
          ))}
        </div>
      </div>
    </ScreenerTableScroll>
  );
}

function CryptoRowSkeleton({ showDivider }: { showDivider: boolean }) {
  return (
    <TableRowShell showDivider={showDivider}>
      <StarSpacerSkeleton />
      <div className={cn(cryptoRowGrid, "min-h-[56px] w-full items-center sm:min-h-[60px]")}>
        <div className="flex justify-center">
          <TextSkeleton wClass="w-4" hClass="h-3.5" />
        </div>
        <CompanyCellSkeleton nameWidth="w-[40%] max-w-[160px]" />
        <div className="flex justify-end sm:hidden">
          <TextSkeleton wClass="w-16" />
        </div>
        <div className={desktopNumericCellClass}>
          <TextSkeleton wClass="w-16" />
        </div>
        <div className={desktopNumericCellClass}>
          <TextSkeleton wClass="w-12" />
        </div>
        <div className={desktopNumericCellClass}>
          <TextSkeleton wClass="w-12" />
        </div>
        <div className={desktopNumericCellClass}>
          <TextSkeleton wClass="w-12" />
        </div>
        <div className={desktopNumericCellClass}>
          <TextSkeleton wClass="w-14" />
        </div>
      </div>
    </TableRowShell>
  );
}

export function CryptoTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <ScreenerTableScroll>
      <div className="bg-surface">
        <TableHeaderShell>
          <div className="flex min-h-[44px] min-w-0 w-full items-center gap-x-1.5 py-0 sm:gap-x-2">
            <StarHeaderSpacer />
            <div className={cn(cryptoRowGrid, "min-h-[44px] w-full items-center")}>
              <div className="flex justify-center">
                <SkeletonBox className="h-3 w-4 rounded" />
              </div>
              <div className="flex justify-start">
                <SkeletonBox className="h-3 w-16 rounded" />
              </div>
              <div className="flex min-w-0 w-full justify-end pr-3">
                <SkeletonBox className="h-3 w-10 rounded" />
              </div>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={desktopNumericCellClass}>
                  <SkeletonBox className="h-3 w-10 rounded" />
                </div>
              ))}
            </div>
          </div>
        </TableHeaderShell>
        <div>
          {Array.from({ length: rows }).map((_, i) => (
            <CryptoRowSkeleton key={i} showDivider={i < rows - 1} />
          ))}
        </div>
      </div>
    </ScreenerTableScroll>
  );
}

function IndicesRowSkeleton({ showDivider }: { showDivider: boolean }) {
  return (
    <TableRowShell showDivider={showDivider}>
      <StarSpacerSkeleton />
      <div className={cn(indicesRowGrid, "min-h-[56px] w-full items-center sm:min-h-[60px]")}>
        <div className="flex justify-center">
          <TextSkeleton wClass="w-4" hClass="h-3.5" />
        </div>
        <div className="flex min-w-0 justify-start">
          <TextSkeleton wClass="w-[45%] max-w-[180px]" />
        </div>
        <div className="flex justify-end sm:hidden">
          <TextSkeleton wClass="w-20" />
        </div>
        <div className={desktopNumericCellClass}>
          <TextSkeleton wClass="w-20" />
        </div>
        <div className={desktopNumericCellClass}>
          <TextSkeleton wClass="w-12" />
        </div>
        <div className={desktopNumericCellClass}>
          <TextSkeleton wClass="w-12" />
        </div>
        <div className={desktopNumericCellClass}>
          <TextSkeleton wClass="w-12" />
        </div>
      </div>
    </TableRowShell>
  );
}

export function IndicesTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <ScreenerTableScroll minWidthClassName="min-w-0" className="h-fit">
      <div className="bg-surface">
        <TableHeaderShell>
          <div className="flex min-h-[44px] min-w-0 w-full items-center gap-x-1.5 py-0 sm:gap-x-2">
            <StarHeaderSpacer />
            <div className={cn(indicesRowGrid, "min-h-[44px] w-full items-center")}>
              <div className="flex justify-center">
                <SkeletonBox className="h-3 w-4 rounded" />
              </div>
              <div className="flex justify-start">
                <SkeletonBox className="h-3 w-12 rounded" />
              </div>
              <div className="flex min-w-0 w-full justify-end pr-3">
                <SkeletonBox className="h-3 w-10 rounded" />
              </div>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={desktopNumericCellClass}>
                  <SkeletonBox className="h-3 w-10 rounded" />
                </div>
              ))}
            </div>
          </div>
        </TableHeaderShell>
        <div>
          {Array.from({ length: rows }).map((_, i) => (
            <IndicesRowSkeleton key={i} showDivider={i < rows - 1} />
          ))}
        </div>
      </div>
    </ScreenerTableScroll>
  );
}

function CryptoMoverCardSkeleton({ title }: { title: string }) {
  return (
    <div
      className={cn(
        "flex min-h-[188px] min-w-0 flex-col gap-[12px] px-4 py-3 sm:px-5 sm:py-3",
        MOBILE_PANEL_CARD_CLASS,
      )}
    >
      <span className="h-5 text-[14px] font-semibold leading-5 text-fg-muted">{title}</span>
      <div className="flex w-full flex-col gap-[12px]">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-[8px]">
            <LogoSkeleton sizeClass="h-6 w-6" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <TextSkeleton wClass="w-[55%] max-w-[140px]" />
              <TextSkeleton wClass="w-12" hClass="h-3" />
            </div>
            <TextSkeleton wClass="w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}

function FearGreedCardSkeleton() {
  return (
    <div
      className={cn(
        "flex h-[188px] flex-col gap-[12px] px-4 pt-3 pb-3 sm:px-5",
        MOBILE_PANEL_CARD_CLASS,
      )}
    >
      <SkeletonBox className="h-5 w-32 rounded" />
      <div className="flex flex-1 flex-col items-center justify-center">
        <SkeletonBox className="h-[120px] w-[120px] rounded-full" />
        <div className="mt-3">
          <TextSkeleton wClass="w-16" hClass="h-4" />
        </div>
      </div>
    </div>
  );
}

/** Gainers & Losers sub-tab while `/api/screener/companies?gainersLosers=1` loads. */
export function StocksGainersLosersSkeleton({
  rows = 10,
  embeddedInMobileCard = false,
  hideMobileHeader = false,
}: {
  rows?: number;
  embeddedInMobileCard?: boolean;
  hideMobileHeader?: boolean;
}) {
  const tableChrome = { embeddedInMobileCard, hideMobileHeader };
  return (
    <div className="flex flex-col">
      <div>
        <div className="mb-5 hidden h-5 w-36 rounded skeleton md:block" />
        <StocksTableSkeleton rows={rows} {...tableChrome} />
      </div>
      <div className={cn(embeddedInMobileCard ? "max-md:mt-4 md:mt-5" : "mt-5")}>
        <div className="mb-5 hidden h-5 w-36 rounded skeleton md:block" />
        <StocksTableSkeleton rows={rows} {...tableChrome} />
      </div>
    </div>
  );
}

export type ScreenerMarketTabSkeletonVariant = "Stocks" | "Crypto" | "Indices" | "ETF's";

/** Matches {@link MarketTabs} / {@link UnderlineTabs} chrome while tabs are not yet interactive. */
export function MarketTabsSkeleton() {
  const tabWidths = ["w-12", "w-14", "w-14", "w-11"] as const;

  return (
    <div className="mb-5 hidden border-b border-solid border-stroke md:block">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 md:gap-x-3">
        <nav className="flex min-w-0 flex-1 flex-nowrap items-start gap-4 pb-px md:gap-5" aria-hidden>
          {tabWidths.map((width, index) => (
            <SkeletonBox key={index} className={`h-6 shrink-0 rounded ${width}`} />
          ))}
        </nav>
        <div className="hidden shrink-0 md:block md:pb-[9px] md:pl-2">
          <SkeletonBox className="h-5 w-28 rounded" />
        </div>
      </div>
    </div>
  );
}

/** Shown while the server payload for the selected market tab is still loading. */
export function ScreenerMarketTabSkeleton({ tab }: { tab: ScreenerMarketTabSkeletonVariant }) {
  if (tab === "Crypto") {
    return (
      <div className="min-w-0 w-full max-w-full">
        <div className="mb-5 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-4">
          <CryptoMoverCardSkeleton title="Largest Gainers" />
          <CryptoMoverCardSkeleton title="Largest Losers" />
          <FearGreedCardSkeleton />
        </div>
        <CryptoTableSkeleton rows={10} />
      </div>
    );
  }

  if (tab === "Indices") {
    return (
      <div className="min-w-0 w-full max-w-full">
        <IndicesTableSkeleton rows={10} />
      </div>
    );
  }

  if (tab === "ETF's") {
    return (
      <div className="min-w-0 w-full max-w-full">
        <IndicesTableSkeleton rows={10} />
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full max-w-full">
      <div className={INDEX_CARDS_SCROLL_OUTER_CLASS}>
        <div className={INDEX_CARDS_SCROLL_CLASS}>
          <div className={INDEX_CARDS_GRID_CLASS}>
            {["S&P 500", "Nasdaq 100", "Dow Jones", "Russell 2000", "VIX"].map((name) => (
              <IndexCardSkeleton key={name} name={name} />
            ))}
          </div>
        </div>
      </div>
      <div className="mb-5 h-9 w-full rounded-[10px] skeleton md:w-48" />
      <StocksTableSkeleton rows={SCREENER_COMPANIES_PAGE_SIZE} />
    </div>
  );
}
