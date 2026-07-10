"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, LayoutList } from "@/lib/icons";

import { EarningsListSeeMoreMenu } from "@/components/earnings/earnings-list-see-more-menu";
import { EarningsOverflowHoverMenu } from "@/components/earnings/earnings-overflow-hover-menu";
import { EarningsPreviewModal } from "@/components/earnings/earnings-preview-modal";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import { PostMarketEarningsIcon } from "@/components/stock/post-market-earnings-icon";
import { PreMarketEarningsIcon } from "@/components/stock/pre-market-earnings-icon";
import { CompanyLogo } from "@/components/screener/company-logo";
import { SCREENER_TABLE_HEADER_STICKY_CLASS } from "@/components/screener/screener-table-scroll";
import { LogoSkeleton, SkeletonBox, TextSkeleton } from "@/components/markets/skeleton";
import type {
  EarningsCalendarItem,
  EarningsDayColumn,
  EarningsReportTiming,
  EarningsTimingBucket,
  EarningsWeekPayload,
} from "@/lib/market/earnings-calendar-types";
import {
  buildAllowedKeysFromPortfolio,
  earningsDayListItems,
  filterEarningsOverflowByKey,
  filterEarningsWeekPayload,
  type EarningsScopeFilter,
} from "@/lib/market/earnings-scope-filter";
import {
  computeWeekTimingGridRows,
  dedupeEarningsCalendarItems,
  EARNINGS_TIMING_GRID_COLS,
  EARNINGS_TIMING_GRID_ROWS,
  EARNINGS_TIMING_GRID_SLOTS,
  sortEarningsCalendarItemsByMarketCap,
  timingBucketHasContent,
  type WeekTimingGridRows,
} from "@/lib/market/earnings-week-grid-layout";
import {
  addDaysUtc,
  formatWeekMonthYearLabelFromYmds,
  toYmdUtc,
} from "@/lib/market/utc-calendar-dates";
import { formatEconomyLongDateUtc } from "@/lib/market/economy-format-display";
import { prefetchStockEarningsTabPayload } from "@/lib/market/stock-earnings-tab-client";
import { useWatchlist } from "@/lib/watchlist/use-watchlist-client";
import { whiteSurfaceButtonChromeClass } from "@/components/design-system";
import { cn } from "@/lib/utils";

/** Icon size inside 24px timing bars. */
const EARNINGS_CALENDAR_TIMING_ICON_PX = 16;

/** Max companies shown per day in list view before "See more". */
const EARNINGS_LIST_PREVIEW_COUNT = 10;

function splitEarningsDayListForView(day: EarningsDayColumn): {
  visibleItems: EarningsCalendarItem[];
  overflowCount: number;
  preloadedOverflow?: EarningsCalendarItem[];
} {
  const items = sortEarningsCalendarItemsByMarketCap(earningsDayListItems(day));
  const visibleItems = items.slice(0, EARNINGS_LIST_PREVIEW_COUNT);

  if (day.listItems?.length) {
    const overflowItems = items.slice(EARNINGS_LIST_PREVIEW_COUNT);
    return {
      visibleItems,
      overflowCount: overflowItems.length,
      preloadedOverflow: overflowItems.length > 0 ? overflowItems : undefined,
    };
  }

  const bucketOverflow =
    day.beforeMarket.overflowCount + day.afterMarket.overflowCount + day.timeTbd.overflowCount;
  const inlineOverflow = items.slice(EARNINGS_LIST_PREVIEW_COUNT);
  const overflowCount = inlineOverflow.length + bucketOverflow;

  return {
    visibleItems,
    overflowCount,
    preloadedOverflow:
      bucketOverflow > 0 ? undefined : inlineOverflow.length > 0 ? inlineOverflow : undefined,
  };
}

const earningsListColLayout = "grid grid-cols-[minmax(0,2fr)_minmax(5.5rem,max-content)_1fr_1fr] gap-x-2";

const earningsListTableHeaderClass = cn(
  earningsListColLayout,
  "min-h-[44px] items-center bg-white px-2 py-0 text-[12px] font-medium leading-5 text-[#71717A] sm:px-4 sm:text-[14px]",
);

const earningsListTableRowClass = cn(
  earningsListColLayout,
  "min-h-[60px] items-center bg-white px-2 transition-colors duration-75 hover:bg-neutral-50 sm:px-4",
);

const earningsListTimeHeaderClass = "min-w-0 w-full text-right";

const earningsListTimeCellClass = "flex min-w-0 w-full items-center justify-end";

const earningsListNumericCellClass =
  "min-w-0 w-full text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-[#09090B]";

function EarningsListDayHeader({ dateYmd, isToday }: { dateYmd: string; isToday: boolean }) {
  return (
    <div
      className={cn(earningsListTableHeaderClass, isToday && "border-b-2 border-[#DC2626]")}
      role="row"
      aria-label={`${formatEconomyLongDateUtc(dateYmd)}, time, estimated revenue, estimated EPS`}
    >
      <div
        className={cn(
          "min-w-0 text-left text-[14px] font-semibold leading-5",
          isToday ? "text-[#DC2626]" : "text-[#09090B]",
        )}
      >
        {formatEconomyLongDateUtc(dateYmd)}
      </div>
      <div className={earningsListTimeHeaderClass}>Time</div>
      <div className={cn(earningsListNumericCellClass, "font-medium text-[#71717A]")}>Est. Revenue</div>
      <div className={cn(earningsListNumericCellClass, "font-medium text-[#71717A]")}>Est. EPS</div>
    </div>
  );
}

function formatEarningsListMetric(value: string | null | undefined): string {
  if (value == null || !value.trim()) return "—";
  return value;
}

function earningsListTimingDisplayLabel(timing: EarningsReportTiming): string {
  if (timing === "bmo") return "Before market";
  if (timing === "amc") return "After market";
  return "TBD";
}

function EarningsListTimingBadge({ timing }: { timing: EarningsReportTiming }) {
  const barClass =
    timing === "bmo"
      ? "bg-[#FFF7ED] text-[#EA580C]"
      : timing === "amc"
        ? "bg-[#EFF6FF] text-[#2563EB]"
        : "bg-[#FAFAFA] text-[#71717A]";

  const icon =
    timing === "bmo" ? (
      <PreMarketEarningsIcon size={12} />
    ) : timing === "amc" ? (
      <PostMarketEarningsIcon size={12} />
    ) : (
      <Clock className="text-[#71717A]" size={10} strokeWidth={2} />
    );

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-none whitespace-nowrap",
        barClass,
      )}
    >
      <span className="inline-flex shrink-0 items-center justify-center" aria-hidden>
        {icon}
      </span>
      {earningsListTimingDisplayLabel(timing)}
    </span>
  );
}

function EarningsListRow({
  item,
  estRevenueDisplay,
  estEpsDisplay,
  onOpen,
}: {
  item: EarningsCalendarItem;
  estRevenueDisplay: string | null | undefined;
  estEpsDisplay: string | null | undefined;
  onOpen: (item: EarningsCalendarItem) => void;
}) {
  return (
    <div
      className={cn(earningsListTableRowClass, "group cursor-pointer text-[14px] leading-5 text-[#09090B]")}
      onClick={() => onOpen(item)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(item);
        }
      }}
    >
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <CompanyLogo
          name={item.companyName || item.ticker}
          logoUrl={item.logoUrl}
          symbol={item.ticker}
        />
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold leading-5 text-[#09090B] underline-offset-2 group-hover:underline">
            {item.companyName}
          </div>
          <div className="text-[12px] font-normal leading-4 text-[#71717A] tabular-nums">{item.ticker}</div>
        </div>
      </div>
      <div className={earningsListTimeCellClass}>
        <EarningsListTimingBadge timing={item.timing} />
      </div>
      <div className={earningsListNumericCellClass}>{formatEarningsListMetric(estRevenueDisplay)}</div>
      <div className={earningsListNumericCellClass}>{formatEarningsListMetric(estEpsDisplay)}</div>
    </div>
  );
}

/** Matches logo (32px) + label + card padding in {@link EarningsCard}. */
const EARNINGS_TIMING_GRID_CELL_MIN_H_PX = 72;

function EarningsTimingSectionHeading({ timing, title }: { timing: EarningsReportTiming; title: string }) {
  const barClass =
    timing === "bmo"
      ? "bg-[#FFF7ED] text-[#EA580C]"
      : timing === "amc"
        ? "bg-[#EFF6FF] text-[#2563EB]"
        : "bg-[#FAFAFA] text-[#71717A]";

  const icon =
    timing === "bmo" ? (
      <PreMarketEarningsIcon size={EARNINGS_CALENDAR_TIMING_ICON_PX} />
    ) : timing === "amc" ? (
      <PostMarketEarningsIcon size={EARNINGS_CALENDAR_TIMING_ICON_PX} />
    ) : (
      <Clock className="text-[#71717A]" size={12} strokeWidth={2} />
    );

  const ariaLabel = timing === "bmo" ? "Before market" : timing === "amc" ? "After market" : "Time TBD";

  return (
    <div className="mb-2">
      <div className={cn("flex h-6 w-full items-center justify-center gap-1.5 rounded-lg", barClass)}>
        <span
          className="inline-flex shrink-0 items-center justify-center"
          title={ariaLabel}
          role="img"
          aria-label={ariaLabel}
        >
          {icon}
        </span>
        <span className="font-['Inter'] text-[11px] font-medium leading-none">{title}</span>
      </div>
    </div>
  );
}

type EarningsTimingGridSlot =
  | { kind: "item"; item: EarningsCalendarItem }
  | { kind: "expand" }
  | { kind: "empty" };

const EMPTY_TIMING_BUCKET: EarningsTimingBucket = { items: [], overflowCount: 0 };

function buildEarningsTimingGridSlots(
  items: EarningsCalendarItem[],
  showExpandTile: boolean,
): EarningsTimingGridSlot[] {
  const expandSlotIndex = EARNINGS_TIMING_GRID_SLOTS - 1;
  const maxItems = showExpandTile ? expandSlotIndex : EARNINGS_TIMING_GRID_SLOTS;
  const slots: EarningsTimingGridSlot[] = Array.from({ length: EARNINGS_TIMING_GRID_SLOTS }, () => ({
    kind: "empty",
  }));

  items.slice(0, maxItems).forEach((item, index) => {
    slots[index] = { kind: "item", item };
  });

  if (showExpandTile) {
    slots[expandSlotIndex] = { kind: "expand" };
  }

  return slots;
}

function EarningsTimingBlock({
  title,
  bucket,
  timing,
  weekMondayYmd,
  dayYmd,
  onOpenCard,
  stackOffset,
  allowedScopeKeys,
  gridRows,
  preloadedOverflow,
}: {
  title: string;
  bucket: EarningsTimingBucket;
  timing: EarningsReportTiming;
  weekMondayYmd: string;
  dayYmd: string;
  onOpenCard: (item: EarningsCalendarItem) => void;
  /** Vertical stack index within the day column (0 = Before Market). */
  stackOffset: number;
  /** When set, overflow fetches are filtered to these canonical ticker keys. */
  allowedScopeKeys: ReadonlySet<string> | null;
  /** Week-wide row height for this timing band — shorter days keep empty rows for alignment. */
  gridRows: number;
  preloadedOverflow?: EarningsCalendarItem[];
}) {
  const gridItems = useMemo(() => dedupeEarningsCalendarItems(bucket.items), [bucket.items]);

  const showExpandTile = bucket.overflowCount > 0;
  const gridSlots = useMemo(
    () => buildEarningsTimingGridSlots(gridItems, showExpandTile),
    [gridItems, showExpandTile],
  );

  const visibleSlots = gridSlots.slice(0, gridRows * EARNINGS_TIMING_GRID_COLS);

  const showTopSpacing = stackOffset > 0;

  return (
    <div className={cn(showTopSpacing && "mt-3")}>
      <EarningsTimingSectionHeading timing={timing} title={title} />
      <div
        className="grid grid-cols-3 gap-1"
        style={{
          gridTemplateRows: `repeat(${gridRows}, minmax(${EARNINGS_TIMING_GRID_CELL_MIN_H_PX}px, auto))`,
        }}
      >
        {visibleSlots.map((slot, index) => (
          <div
            key={`${timing}-slot-${index}`}
            className="min-w-0"
            style={{ minHeight: EARNINGS_TIMING_GRID_CELL_MIN_H_PX }}
          >
            {slot.kind === "item" ? (
              <EarningsCard
                ticker={slot.item.ticker}
                companyName={slot.item.companyName}
                logoUrl={slot.item.logoUrl}
                onOpen={() => onOpenCard(slot.item)}
              />
            ) : slot.kind === "expand" ? (
              <EarningsOverflowHoverMenu
                count={bucket.overflowCount}
                preloadedItems={preloadedOverflow}
                weekMondayYmd={weekMondayYmd}
                dayYmd={dayYmd}
                timing={timing}
                title={title}
                allowedScopeKeys={allowedScopeKeys}
                onOpenCard={onOpenCard}
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

const EARNINGS_DAY_TIMING_SECTIONS: readonly {
  timing: EarningsReportTiming;
  title: string;
  bucketKey: keyof Pick<EarningsDayColumn, "beforeMarket" | "afterMarket" | "timeTbd">;
}[] = [
  { timing: "bmo", title: "Before Market", bucketKey: "beforeMarket" },
  { timing: "amc", title: "After Market", bucketKey: "afterMarket" },
  { timing: "unknown", title: "Time TBD", bucketKey: "timeTbd" },
];

function EarningsDayColumnBody({
  day,
  weekMondayYmd,
  onOpenCard,
  allowedScopeKeys,
  scope,
  weekTimingGridRows,
  overflowByKey,
}: {
  day: EarningsDayColumn;
  weekMondayYmd: string;
  onOpenCard: (item: EarningsCalendarItem) => void;
  allowedScopeKeys: ReadonlySet<string> | null;
  scope: EarningsScopeFilter;
  weekTimingGridRows: WeekTimingGridRows;
  overflowByKey: Record<string, EarningsCalendarItem[]>;
}) {
  const { date } = day;
  const totalSignals =
    day.beforeMarket.items.length +
    day.beforeMarket.overflowCount +
    day.afterMarket.items.length +
    day.afterMarket.overflowCount +
    day.timeTbd.items.length +
    day.timeTbd.overflowCount;

  if (totalSignals === 0) {
    return (
      <div className="flex flex-col">
        <p className="flex items-center gap-1.5 text-[12px] leading-4 text-[#A1A1AA]">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
          No earnings
        </p>
      </div>
    );
  }

  // Any timing band active elsewhere in the week is rendered on every earning day (empty grid when needed)
  // so Before / After / Time TBD headers line up across Mon–Fri.
  const sections = EARNINGS_DAY_TIMING_SECTIONS.flatMap((section) => {
    const gridRows = weekTimingGridRows[section.timing];
    if (gridRows === 0) return [];

    const bucket = day[section.bucketKey];
    const hasContent = timingBucketHasContent(bucket);
    return [{ ...section, bucket: hasContent ? bucket : EMPTY_TIMING_BUCKET, gridRows }];
  });

  return (
    <div className="min-w-0">
      {sections.map((section, index) => (
        <EarningsTimingBlock
          key={`${section.timing}-${scope}`}
          title={section.title}
          bucket={section.bucket}
          timing={section.timing}
          weekMondayYmd={weekMondayYmd}
          dayYmd={date}
          onOpenCard={onOpenCard}
          stackOffset={index}
          allowedScopeKeys={allowedScopeKeys}
          gridRows={section.gridRows}
          preloadedOverflow={overflowByKey[`${date}:${section.timing}`]}
        />
      ))}
    </div>
  );
}

function EarningsCard({
  ticker,
  companyName,
  logoUrl,
  onOpen,
}: {
  ticker: string;
  companyName: string;
  logoUrl: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      onPointerEnter={() => prefetchStockEarningsTabPayload(ticker, true)}
      onFocus={() => prefetchStockEarningsTabPayload(ticker, true)}
      className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl px-1 py-1.5 text-center transition-colors hover:bg-[#F4F4F5]"
    >
      <CompanyLogo name={companyName || ticker} logoUrl={logoUrl} symbol={ticker} size="md" fill />
      <span className="w-full min-w-0 truncate text-[13px] font-semibold leading-5 tabular-nums text-[#09090B]">
        {ticker}
      </span>
    </button>
  );
}

/** Week nav — bordered controls (arrows + Today), aligned with toolbar squircles. */
const weekNavBtnClass = cn(
  "inline-flex h-9 shrink-0 items-center justify-center rounded-[10px] text-[#09090B] transition-all duration-100 hover:bg-[#F4F4F5]",
  whiteSurfaceButtonChromeClass,
);

const weekNavArrowClass = cn(weekNavBtnClass, "w-9");

const weekNavTodayClass = cn(weekNavBtnClass, "px-3 text-[14px] font-medium leading-5");

function EarningsHoldingsWatchlistSwitch({
  pressed,
  onPressedChange,
  "aria-label": ariaLabel,
}: {
  pressed: boolean;
  onPressedChange: (next: boolean) => void;
  "aria-label": string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={pressed}
      aria-label={ariaLabel}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15",
        pressed ? "bg-[#2563EB]" : "bg-[#E4E4E7]",
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform",
          pressed && "translate-x-4",
        )}
        aria-hidden
      />
    </button>
  );
}

function earningsWeekHref(weekYmd: string, scope: EarningsScopeFilter): string {
  const qs = new URLSearchParams({ week: weekYmd });
  if (scope !== "all") qs.set("scope", scope);
  return `/earnings?${qs.toString()}`;
}

type WeekDayDateStub = {
  date: string;
  weekdayLabel: string;
  dayNumber: string;
};

function buildWeekDayDateStubs(weekMondayYmd: string): WeekDayDateStub[] {
  const monday = new Date(Date.parse(`${weekMondayYmd}T12:00:00.000Z`));
  return Array.from({ length: 5 }, (_, i) => {
    const d = addDaysUtc(monday, i);
    return {
      date: toYmdUtc(d),
      weekdayLabel: d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
      dayNumber: String(d.getUTCDate()),
    };
  });
}

function EarningsTimingSectionSkeleton({ timing, title }: { timing: EarningsReportTiming; title: string }) {
  return (
    <div className="mt-3 first:mt-0">
      <EarningsTimingSectionHeading timing={timing} title={title} />
      <div className="grid grid-cols-3 gap-1">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="flex min-h-[72px] flex-col items-center justify-center gap-1.5 px-1 py-1.5"
          >
            <LogoSkeleton sizeClass="h-8 w-8" />
            <TextSkeleton wClass="w-10" hClass="h-3.5" />
          </div>
        ))}
      </div>
    </div>
  );
}

function EarningsWeekGridSkeleton({
  weekMondayYmd,
  todayYmd,
}: {
  weekMondayYmd: string;
  todayYmd: string;
}) {
  const days = useMemo(() => buildWeekDayDateStubs(weekMondayYmd), [weekMondayYmd]);

  return (
    <div className="flex min-w-0 flex-col" aria-busy="true" aria-label="Loading earnings calendar">
      <div className="-mx-1 flex flex-col overflow-x-auto pb-1 md:mx-0 md:overflow-x-hidden md:overflow-y-visible">
        <div className="flex w-max min-w-full flex-col rounded-2xl bg-[#F4F4F5] p-1 md:w-full">
          <div className="flex w-max min-w-full gap-1 rounded-2xl bg-[#F4F4F5] md:w-full md:flex-row md:items-stretch">
            {days.map((day) => {
              const isToday = day.date === todayYmd;
              return (
                <div
                  key={day.date}
                  className="flex w-[min(100%,220px)] shrink-0 flex-col rounded-xl border border-[#E4E4E7] bg-white px-2 py-3 md:min-h-0 md:flex-1 md:shrink md:px-0 md:py-0"
                >
                  <div
                    className={cn(
                      "-mx-2 mb-3 rounded-t-xl px-2 pb-2 md:hidden",
                      SCREENER_TABLE_HEADER_STICKY_CLASS,
                    )}
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[#A1A1AA]">
                      {day.weekdayLabel}
                    </div>
                    <div
                      className={`text-[15px] font-semibold tabular-nums ${
                        isToday ? "text-[#DC2626]" : "text-[#09090B]"
                      }`}
                    >
                      {day.dayNumber}
                    </div>
                  </div>
                  <div
                    className={cn(
                      "hidden rounded-t-xl pt-1 pb-0 md:block",
                      SCREENER_TABLE_HEADER_STICKY_CLASS,
                    )}
                  >
                    <div
                      className={`flex flex-wrap items-center justify-center gap-1 py-0.5 text-center text-[18px] leading-6 ${
                        isToday ? "text-[#DC2626]" : "text-[#09090B]"
                      }`}
                    >
                      <span className="font-normal">{day.weekdayLabel}</span>
                      <span className="font-semibold tabular-nums">{day.dayNumber}</span>
                    </div>
                    <div className="mt-1" aria-hidden>
                      <div className={`h-0.5 w-full ${isToday ? "bg-[#DC2626]" : "bg-transparent"}`} />
                    </div>
                  </div>
                  <div className="flex flex-col px-2 pt-2 pb-4 md:overflow-visible">
                    <EarningsTimingSectionSkeleton timing="bmo" title="Before Market" />
                    <EarningsTimingSectionSkeleton timing="amc" title="After Market" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const earningsListDayCardClass = "overflow-hidden rounded-xl border border-[#E4E4E7] bg-white";

function EarningsWeekListSkeleton() {
  return (
    <div
      className="-mx-1 flex flex-col overflow-x-auto pb-1 md:mx-0 md:overflow-x-hidden md:overflow-y-visible"
      aria-busy="true"
      aria-label="Loading earnings calendar"
    >
      <div className="flex w-full min-w-0 flex-col rounded-2xl bg-[#F4F4F5] p-1">
        <div className="flex flex-col gap-1">
          <div className={cn(earningsListDayCardClass, "divide-y divide-[#E4E4E7]")}>
            <div className={earningsListTableHeaderClass}>
              <TextSkeleton wClass="w-40" hClass="h-3.5" />
              <TextSkeleton wClass="w-10" hClass="h-3.5" />
              <TextSkeleton wClass="w-full" hClass="h-3.5" />
              <TextSkeleton wClass="w-full" hClass="h-3.5" />
            </div>
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className={cn(earningsListTableRowClass, "gap-y-2 py-3")}>
                <div className="flex min-w-0 items-center gap-2.5">
                  <SkeletonBox className="h-8 w-8 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <TextSkeleton wClass="w-16" hClass="h-3.5" />
                    <TextSkeleton wClass="w-full max-w-[180px]" hClass="h-3.5" />
                  </div>
                </div>
                <SkeletonBox className="mx-auto h-5 w-12 rounded-md" />
                <TextSkeleton wClass="w-full" hClass="h-3.5" />
                <TextSkeleton wClass="w-full" hClass="h-3.5" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Weekly earnings calendar — layout aligned with Figma (Web App Design, Earnings Calendar week view).
 * Weeks with no events still show the five-column grid; empty days display “No earnings”.
 */
export function EarningsWeekGrid({
  data,
  overflowByKey,
  todayYmd,
  thisWeekMondayYmd,
  scope,
  weekTimingGridRows: weekTimingGridRowsFromServer,
}: {
  data: EarningsWeekPayload;
  /** SSR overflow rows keyed by `${dayYmd}:${timing}` — avoids lazy API when present. */
  overflowByKey: Record<string, EarningsCalendarItem[]>;
  /** UTC calendar day from the server — avoids SSR/client date drift for “today” styling. */
  todayYmd: string;
  /** Monday YMD of the week containing today (UTC), from the server. */
  thisWeekMondayYmd: string;
  /** From server `searchParams` — avoids `useSearchParams` hydration drift. */
  scope: EarningsScopeFilter;
  /** SSR snapshot of band row heights — used until client scope filters are ready. */
  weekTimingGridRows: WeekTimingGridRows;
}) {
  const router = useRouter();
  const [, startWeekTransition] = useTransition();
  const { watched, storageHydrated: watchlistHydrated } = useWatchlist();
  const { holdingsByPortfolioId, portfolioDisplayReady } = usePortfolioWorkspace();
  const [clientReady, setClientReady] = useState(false);
  const [pendingWeekMondayYmd, setPendingWeekMondayYmd] = useState<string | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");

  useEffect(() => {
    setClientReady(true);
  }, []);

  useEffect(() => {
    if (pendingWeekMondayYmd && pendingWeekMondayYmd === data.weekMondayYmd) {
      setPendingWeekMondayYmd(null);
    }
  }, [data.weekMondayYmd, pendingWeekMondayYmd]);

  // Keep the first client render identical to SSR; apply scope filters only after mount.
  const scopeFilterReady =
    clientReady &&
    (scope === "all" || (scope === "portfolio" && watchlistHydrated && portfolioDisplayReady));

  const allowedScopeKeys = useMemo((): ReadonlySet<string> | null => {
    if (!scopeFilterReady || scope === "all") return null;
    const symbols = Object.values(holdingsByPortfolioId).flatMap((rows) =>
      rows.map((h) => h.symbol),
    );
    return buildAllowedKeysFromPortfolio(watched, symbols);
  }, [scopeFilterReady, scope, watched, holdingsByPortfolioId]);

  const filteredOverflowByKey = useMemo(
    () => filterEarningsOverflowByKey(overflowByKey, allowedScopeKeys),
    [overflowByKey, allowedScopeKeys],
  );

  const filteredData = useMemo(
    () => filterEarningsWeekPayload(data, allowedScopeKeys, overflowByKey),
    [data, allowedScopeKeys, overflowByKey],
  );

  const weekTimingGridRowsClient = useMemo(
    () => computeWeekTimingGridRows(filteredData.days),
    [filteredData.days],
  );

  const weekTimingGridRows = scopeFilterReady
    ? weekTimingGridRowsClient
    : weekTimingGridRowsFromServer;

  const totalListItems = useMemo(
    () => filteredData.days.reduce((n, day) => n + earningsDayListItems(day).length, 0),
    [filteredData.days],
  );

  const displayWeekMondayYmd = pendingWeekMondayYmd ?? data.weekMondayYmd;
  const isWeekLoading =
    pendingWeekMondayYmd !== null && pendingWeekMondayYmd !== data.weekMondayYmd;

  const displayMonday = useMemo(() => {
    const t = Date.parse(`${displayWeekMondayYmd}T12:00:00.000Z`);
    return Number.isFinite(t) ? new Date(t) : new Date();
  }, [displayWeekMondayYmd]);

  const displayWeekLabel = useMemo(() => {
    if (!isWeekLoading && data.days.length > 0) {
      return formatWeekMonthYearLabelFromYmds(data.days.map((day) => day.date));
    }
    const stubYmds = Array.from({ length: 5 }, (_, i) => toYmdUtc(addDaysUtc(displayMonday, i)));
    return formatWeekMonthYearLabelFromYmds(stubYmds);
  }, [isWeekLoading, data.days, displayMonday]);

  const displayPrevWeekYmd = useMemo(
    () => toYmdUtc(addDaysUtc(displayMonday, -7)),
    [displayMonday],
  );

  const displayNextWeekYmd = useMemo(
    () => toYmdUtc(addDaysUtc(displayMonday, 7)),
    [displayMonday],
  );

  const navigateWeek = useCallback(
    (weekYmd: string) => {
      if (weekYmd === displayWeekMondayYmd && !isWeekLoading) return;
      setPendingWeekMondayYmd(weekYmd);
      startWeekTransition(() => {
        router.push(earningsWeekHref(weekYmd, scope));
      });
    },
    [displayWeekMondayYmd, isWeekLoading, router, scope],
  );

  const setHoldingsWatchlistFilter = (enabled: boolean) => {
    const qs = new URLSearchParams({ week: displayWeekMondayYmd });
    if (enabled) qs.set("scope", "portfolio");
    router.push(`/earnings?${qs.toString()}`);
  };

  const [previewItem, setPreviewItem] = useState<EarningsCalendarItem | null>(null);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="relative z-30 flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="min-w-0 text-[24px] font-semibold leading-9 tracking-tight text-[#09090B]">
          {displayWeekLabel}
        </h1>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-medium leading-5 text-[#71717A]">Holdings &amp; Watchlist</span>
            <EarningsHoldingsWatchlistSwitch
              pressed={scope === "portfolio"}
              onPressedChange={setHoldingsWatchlistFilter}
              aria-label="Show only holdings and watchlist"
            />
          </div>
          <button
            type="button"
            onClick={() => navigateWeek(displayPrevWeekYmd)}
            className={weekNavArrowClass}
            aria-label="Previous week"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={() => navigateWeek(thisWeekMondayYmd)}
            className={weekNavTodayClass}
            aria-label="Go to this week"
            aria-current={displayWeekMondayYmd === thisWeekMondayYmd ? "page" : undefined}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => navigateWeek(displayNextWeekYmd)}
            className={weekNavArrowClass}
            aria-label="Next week"
          >
            <ChevronRight className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <div className="flex shrink-0 rounded-[10px] bg-[#F4F4F5] p-0.5">
            <button
              type="button"
              onClick={() => setView("grid")}
              className={cn(
                "flex h-8 w-9 items-center justify-center rounded-[10px] transition-colors",
                view === "grid"
                  ? "bg-white shadow-[0px_1px_2px_0px_rgba(10,10,10,0.12),0px_1px_1px_0px_rgba(10,10,10,0.07)]"
                  : "text-[#52525B] hover:text-[#09090B]",
              )}
              aria-pressed={view === "grid"}
              aria-label="Week grid view"
            >
              <CalendarDays className="h-5 w-5" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={cn(
                "flex h-8 w-9 items-center justify-center rounded-[10px] transition-colors",
                view === "list"
                  ? "bg-white shadow-[0px_1px_2px_0px_rgba(10,10,10,0.12),0px_1px_1px_0px_rgba(10,10,10,0.07)]"
                  : "text-[#52525B] hover:text-[#09090B]",
              )}
              aria-pressed={view === "list"}
              aria-label="List view"
            >
              <LayoutList className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col">
        {view === "grid" ? (
        isWeekLoading ? (
          <EarningsWeekGridSkeleton weekMondayYmd={displayWeekMondayYmd} todayYmd={todayYmd} />
        ) : (
        <div className="-mx-1 flex flex-col overflow-x-auto pb-1 md:mx-0 md:overflow-x-hidden md:overflow-y-visible">
          <div className="flex w-max min-w-full flex-col rounded-2xl bg-[#F4F4F5] p-1 md:w-full">
            <div className="flex w-max min-w-full gap-1 rounded-2xl bg-[#F4F4F5] md:w-full md:flex-row md:items-stretch">
            {filteredData.days.map((day: EarningsDayColumn) => {
              const isToday = day.date === todayYmd;
              return (
                <div
                  key={day.date}
                  className="flex w-[min(100%,220px)] shrink-0 flex-col rounded-xl border border-[#E4E4E7] bg-white px-2 py-3 md:min-h-0 md:flex-1 md:shrink md:px-0 md:py-0"
                >
                  <div
                    className={cn(
                      "-mx-2 mb-3 rounded-t-xl px-2 pb-2 md:hidden",
                      SCREENER_TABLE_HEADER_STICKY_CLASS,
                    )}
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[#A1A1AA]">
                      {day.weekdayLabel}
                    </div>
                    <div
                      className={`text-[15px] font-semibold tabular-nums ${
                        isToday ? "text-[#DC2626]" : "text-[#09090B]"
                      }`}
                    >
                      {day.dayNumber}
                    </div>
                  </div>
                  <div
                    className={cn(
                      "hidden rounded-t-xl pt-1 pb-0 md:block",
                      SCREENER_TABLE_HEADER_STICKY_CLASS,
                    )}
                  >
                    <div
                      className={`flex flex-wrap items-center justify-center gap-1 py-0.5 text-center text-[18px] leading-6 ${
                        isToday ? "text-[#DC2626]" : "text-[#09090B]"
                      }`}
                    >
                      <span className="font-normal">{day.weekdayLabel}</span>
                      <span className="font-semibold tabular-nums">{day.dayNumber}</span>
                    </div>
                    <div className="mt-1" aria-hidden>
                      <div className={`h-0.5 w-full ${isToday ? "bg-[#DC2626]" : "bg-transparent"}`} />
                    </div>
                  </div>
                  <div className="flex flex-col px-2 pt-2 pb-4 md:overflow-visible">
                    <EarningsDayColumnBody
                      day={day}
                      weekMondayYmd={filteredData.weekMondayYmd}
                      onOpenCard={setPreviewItem}
                      allowedScopeKeys={allowedScopeKeys}
                      scope={scope}
                      weekTimingGridRows={weekTimingGridRows}
                      overflowByKey={filteredOverflowByKey}
                    />
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        </div>
        )
        ) : isWeekLoading ? (
          <EarningsWeekListSkeleton />
        ) : (
        <div className="flex min-w-0 flex-col space-y-0">
          {totalListItems === 0 ? (
            <div className="rounded-xl border border-[#E4E4E7] bg-white px-4 py-12 text-center text-sm text-[#71717A]">
              No scheduled earnings
            </div>
          ) : (
            <div className="-mx-1 flex flex-col overflow-x-auto pb-1 md:mx-0 md:overflow-x-hidden md:overflow-y-visible">
              <div className="flex w-full min-w-0 flex-col rounded-2xl bg-[#F4F4F5] p-1">
                <div className="flex flex-col gap-1">
                  {filteredData.days.map((day) => {
                    const { visibleItems, overflowCount, preloadedOverflow } = splitEarningsDayListForView(day);
                    if (visibleItems.length === 0 && overflowCount === 0) return null;
                    const isToday = day.date === todayYmd;
                    return (
                      <section
                        key={day.date}
                        id={`earnings-list-${day.date}`}
                        className={cn(earningsListDayCardClass, "divide-y divide-[#E4E4E7]")}
                      >
                        <EarningsListDayHeader dateYmd={day.date} isToday={isToday} />

                        {visibleItems.map((item) => (
                          <EarningsListRow
                            key={`${item.ticker}:${item.reportDate}`}
                            item={item}
                            estRevenueDisplay={item.estRevenueDisplay}
                            estEpsDisplay={item.estEpsDisplay}
                            onOpen={setPreviewItem}
                          />
                        ))}

                        {overflowCount > 0 ? (
                          <EarningsListSeeMoreMenu
                            overflowCount={overflowCount}
                            preloadedItems={preloadedOverflow}
                            weekMondayYmd={filteredData.weekMondayYmd}
                            dayYmd={day.date}
                            allowedScopeKeys={allowedScopeKeys}
                            listOffset={visibleItems.length}
                            onOpenCard={setPreviewItem}
                          />
                        ) : null}
                      </section>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
        )}
      </div>

      <EarningsPreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />
    </div>
  );
}
