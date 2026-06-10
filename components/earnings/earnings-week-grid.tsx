"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "@/lib/icons";

import { EarningsOverflowHoverMenu } from "@/components/earnings/earnings-overflow-hover-menu";
import { EarningsPreviewModal } from "@/components/earnings/earnings-preview-modal";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import { PostMarketEarningsIcon } from "@/components/stock/post-market-earnings-icon";
import { PreMarketEarningsIcon } from "@/components/stock/pre-market-earnings-icon";
import { CompanyLogo } from "@/components/screener/company-logo";
import { SCREENER_TABLE_HEADER_STICKY_CLASS } from "@/components/screener/screener-table-scroll";
import { LogoSkeleton, TextSkeleton } from "@/components/markets/skeleton";
import { FormListboxSelect, type ListboxOption } from "@/components/ui/form-listbox-select";
import type {
  EarningsCalendarItem,
  EarningsDayColumn,
  EarningsReportTiming,
  EarningsTimingBucket,
  EarningsWeekPayload,
} from "@/lib/market/earnings-calendar-types";
import {
  buildAllowedKeysFromHoldings,
  buildAllowedKeysFromWatchlist,
  filterEarningsWeekPayload,
  type EarningsScopeFilter,
} from "@/lib/market/earnings-scope-filter";
import {
  computeWeekTimingGridRows,
  dedupeEarningsCalendarItems,
  EARNINGS_TIMING_GRID_COLS,
  EARNINGS_TIMING_GRID_ROWS,
  EARNINGS_TIMING_GRID_SLOTS,
  timingBucketHasContent,
  type WeekTimingGridRows,
} from "@/lib/market/earnings-week-grid-layout";
import {
  addDaysUtc,
  formatWeekMonthYearLabelFromYmds,
  toYmdUtc,
} from "@/lib/market/utc-calendar-dates";
import { prefetchStockEarningsTabPayload } from "@/lib/market/stock-earnings-tab-client";
import { useWatchlist } from "@/lib/watchlist/use-watchlist-client";
import { cn } from "@/lib/utils";

const EARNINGS_SCOPE_OPTIONS: ListboxOption<EarningsScopeFilter>[] = [
  { value: "all", label: "All companies" },
  { value: "watchlist", label: "My watchlist" },
  { value: "holdings", label: "My holdings" },
];

/** Icon size inside 24px timing bars. */
const EARNINGS_CALENDAR_TIMING_ICON_PX = 16;

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
}: {
  day: EarningsDayColumn;
  weekMondayYmd: string;
  onOpenCard: (item: EarningsCalendarItem) => void;
  allowedScopeKeys: ReadonlySet<string> | null;
  scope: EarningsScopeFilter;
  weekTimingGridRows: WeekTimingGridRows;
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
const weekNavBtnClass =
  "inline-flex h-9 shrink-0 items-center justify-center rounded-[10px] border border-[#E4E4E7] bg-white text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-all duration-100 hover:bg-[#F4F4F5]";

const weekNavArrowClass = cn(weekNavBtnClass, "w-9");

const weekNavTodayClass = cn(weekNavBtnClass, "px-3 text-[14px] font-medium leading-5");

/** Matches economy calendar toolbar listboxes. */
const earningsScopeDropdownTriggerClass =
  "border border-solid border-[#E4E4E7] bg-white shadow-[0px_1px_1px_0px_rgba(10,10,10,0.06)] hover:bg-[#FAFAFA]";

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

/**
 * Weekly earnings calendar — layout aligned with Figma (Web App Design, Earnings Calendar week view).
 * Weeks with no events still show the five-column grid; empty days display “No earnings”.
 */
export function EarningsWeekGrid({
  data,
  todayYmd,
  thisWeekMondayYmd,
  scope,
  weekTimingGridRows: weekTimingGridRowsFromServer,
}: {
  data: EarningsWeekPayload;
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
    (scope === "all" ||
      (scope === "watchlist" && watchlistHydrated) ||
      (scope === "holdings" && portfolioDisplayReady));

  const allowedScopeKeys = useMemo((): ReadonlySet<string> | null => {
    if (!scopeFilterReady || scope === "all") return null;
    if (scope === "watchlist") return buildAllowedKeysFromWatchlist(watched);
    const symbols = Object.values(holdingsByPortfolioId).flatMap((rows) =>
      rows.map((h) => h.symbol),
    );
    return buildAllowedKeysFromHoldings(symbols);
  }, [scopeFilterReady, scope, watched, holdingsByPortfolioId]);

  const filteredData = useMemo(
    () => filterEarningsWeekPayload(data, allowedScopeKeys),
    [data, allowedScopeKeys],
  );

  const weekTimingGridRowsClient = useMemo(
    () => computeWeekTimingGridRows(filteredData.days),
    [filteredData.days],
  );

  const weekTimingGridRows = scopeFilterReady
    ? weekTimingGridRowsClient
    : weekTimingGridRowsFromServer;

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

  const setScope = (next: EarningsScopeFilter) => {
    const qs = new URLSearchParams({ week: displayWeekMondayYmd });
    if (next !== "all") qs.set("scope", next);
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
          <FormListboxSelect
            aria-label="Earnings scope"
            value={scope}
            onChange={setScope}
            options={EARNINGS_SCOPE_OPTIONS}
            truncateLabel={false}
            className="w-max shrink-0"
            triggerClassName={earningsScopeDropdownTriggerClass}
          />
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
        </div>
      </div>

      <div className="flex min-w-0 flex-col">
        {isWeekLoading ? (
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
                    />
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        </div>
        )}
      </div>

      <EarningsPreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />
    </div>
  );
}
