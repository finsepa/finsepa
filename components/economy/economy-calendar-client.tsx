"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Filter, LayoutList } from "@/lib/icons";

import { EconomyEventHistoryModal } from "@/components/economy/economy-event-history-modal";
import { SkeletonBox, TextSkeleton } from "@/components/markets/skeleton";
import {
  DEFAULT_TABLE_ROW_HOVER_PAD_CLASS,
  SCREENER_TABLE_DATA_ROW_CLASS,
  SCREENER_TABLE_HEADER_STICKY_CLASS,
  SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
  SCREENER_TABLE_ROUNDED_HEADER_CLASS,
  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
  SCREENER_TABLE_STROKE_INSET_CLASS,
  ScreenerTableScroll,
  TABLE_END_ALIGNED_PAD_CLASS,
  TABLE_START_ALIGNED_PAD_CLASS,
} from "@/components/screener/screener-table-scroll";
import { FormListboxSelect, type ListboxOption } from "@/components/ui/form-listbox-select";
import type { EconomyCalendarEvent, EconomyDayColumn, EconomyWeekPayload } from "@/lib/market/economy-calendar-types";
import {
  countryFlagEmoji,
  ECONOMY_TIMEZONE_OPTIONS,
  formatEconomyClockUtc,
  formatEconomyLongDateUtc,
  formatEconomyMetric,
  type EconomyTimezoneOption,
} from "@/lib/market/economy-format-display";
import {
  addDaysUtc,
  formatWeekMonthYearLabelFromYmds,
  toYmdUtc,
} from "@/lib/market/utc-calendar-dates";
import { SegmentedControl, whiteSurfaceButtonChromeClass } from "@/components/design-system";
import { cn } from "@/lib/utils";

const ECONOMY_COUNTRY_OPTIONS: ListboxOption[] = [
  { value: "US", label: `${countryFlagEmoji("US")} US` },
  { value: "GB", label: `${countryFlagEmoji("GB")} UK` },
  { value: "DE", label: `${countryFlagEmoji("DE")} DE` },
  { value: "FR", label: `${countryFlagEmoji("FR")} FR` },
  { value: "JP", label: `${countryFlagEmoji("JP")} JP` },
  { value: "CN", label: `${countryFlagEmoji("CN")} CN` },
  { value: "CA", label: `${countryFlagEmoji("CA")} CA` },
  { value: "AU", label: `${countryFlagEmoji("AU")} AU` },
  { value: "IT", label: `${countryFlagEmoji("IT")} IT` },
  { value: "ES", label: `${countryFlagEmoji("ES")} ES` },
];

type ImpactFilter = "all" | "major" | "notable" | "low";

const IMPACT_OPTIONS: ListboxOption<ImpactFilter>[] = [
  { value: "all", label: "All events" },
  { value: "major", label: "High impact" },
  { value: "notable", label: "Medium impact" },
  { value: "low", label: "Low impact" },
];

function todayYmdUtc(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function currentWeekMondayYmdUtc(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function eventTitle(e: EconomyCalendarEvent): string {
  let t = e.type;
  const c = (e.comparison ?? "").toLowerCase();
  if (c === "yoy") t += " YoY";
  else if (c === "mom") t += " MoM";
  else if (c === "qoq") t += " QoQ";
  return t;
}

function passesImpact(e: EconomyCalendarEvent, filter: ImpactFilter): boolean {
  if (filter === "all") return true;
  if (filter === "major") return e.importance >= 3;
  if (filter === "notable") return e.importance === 2;
  return e.importance <= 1;
}

function importanceBarClass(importance: EconomyCalendarEvent["importance"]): string {
  if (importance >= 3) return "bg-down";
  if (importance === 2) return "bg-orange";
  return "bg-up";
}

function importanceCircleClass(importance: EconomyCalendarEvent["importance"]): string {
  if (importance >= 3) return "bg-down-soft";
  if (importance === 2) return "bg-orange-soft";
  return "bg-up-soft";
}

function ImportanceBars({ importance }: { importance: EconomyCalendarEvent["importance"] }) {
  const bars: readonly number[] =
    importance >= 3 ? [7, 9, 11] : importance === 2 ? [7, 10] : [7];
  const barClass = importanceBarClass(importance);
  return (
    <div
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-[10px]",
        importanceCircleClass(importance),
      )}
      title="Impact"
      aria-hidden
    >
      <div className="flex h-[11px] items-end justify-center gap-0.5">
        {bars.map((h, i) => (
          <span key={i} className={cn("w-0.5 rounded-[10px]", barClass)} style={{ height: `${h}px` }} />
        ))}
      </div>
    </div>
  );
}

/** List row importance indicator — matches Figma bar proportions. */
function ImportanceBarsRow({ importance }: { importance: EconomyCalendarEvent["importance"] }) {
  const bars: readonly number[] =
    importance >= 3 ? [12, 16, 20] : importance === 2 ? [12, 17] : [12];
  const barClass = importanceBarClass(importance);
  return (
    <div
      className={cn(
        "flex h-8 w-7 shrink-0 items-end justify-center gap-1 rounded-[10px] pb-0.5 pt-1",
        importanceCircleClass(importance),
      )}
      title="Impact"
      aria-hidden
    >
      {bars.map((h, i) => (
        <span key={i} className={cn("w-1 rounded-[10px]", barClass)} style={{ height: `${h}px` }} />
      ))}
    </div>
  );
}

function eventHasData(e: EconomyCalendarEvent): boolean {
  return e.estimate != null || e.actual != null || e.previous != null;
}

/** Day column — same screener/table card chrome as earnings week grid. 8px pad on mobile around events. */
const ECONOMY_WEEK_DAY_CARD_CLASS =
  "flex w-[min(100%,240px)] shrink-0 flex-col rounded-2xl border border-stroke-subtle bg-surface px-2 pt-1 pb-3 shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-04))] md:min-h-0 md:flex-1 md:shrink md:px-0 md:py-0";

/** Horizontal gap between day cards (12px). No outer shell — cards sit on the panel. */
const ECONOMY_WEEK_DAY_GAP_CLASS =
  "flex min-h-[min(60vh,716px)] w-max min-w-full gap-3 md:w-full md:flex-row md:items-stretch";

/** Weekday + day on one line, centered — same on mobile and desktop; table stroke under header. */
function EconomyWeekDayHeader({
  weekdayLabel,
  dayNumber,
  isToday,
}: {
  weekdayLabel: string;
  dayNumber: string;
  isToday: boolean;
}) {
  return (
    <div
      className={cn(
        "-mx-2 rounded-t-2xl px-2 pt-0 pb-0 max-md:border-b max-md:border-solid max-md:border-table-row-stroke md:mx-0 md:pt-1",
        SCREENER_TABLE_HEADER_STICKY_CLASS,
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center justify-center gap-1 py-0.5 text-center text-[18px] leading-6",
          isToday ? "text-down" : "text-fg",
        )}
      >
        <span className="font-normal">{weekdayLabel}</span>
        <span className="font-semibold tabular-nums">{dayNumber}</span>
      </div>
      <div className="mt-1" aria-hidden>
        <div className={cn("h-0.5 w-full", isToday ? "bg-down" : "bg-transparent")} />
      </div>
    </div>
  );
}

/**
 * Between-event stroke — table row stroke color/behavior, 20px side inset from the day card edge.
 * On mobile the day column already has 8px (`px-2`), so content-bleed + `mx-5` still needs a full-bleed row.
 */
const ECONOMY_EVENT_STROKE_CLASS =
  "screener-row-stroke mx-5 border-b border-solid border-table-row-stroke transition-opacity duration-75";

/** Events stack inside day column — horizontal full-bleed for 20px strokes; re-apply 8px pad on each row. */
const ECONOMY_EVENTS_STACK_CLASS = "flex min-h-[120px] flex-col -mx-2 pt-2 pb-4 md:mx-0 md:overflow-visible";

/** 8px from day column edge (mobile) then 12px inside each event surface. */
const ECONOMY_EVENT_OUTER_PAD_CLASS = "px-2 md:px-2";
const ECONOMY_EVENT_INNER_PAD_CLASS = "p-3";

/** Grid columns aligned with screener tables (`gap-x-2`, right-aligned numeric cols). */
const ECONOMY_LIST_GRID =
  "grid w-full min-w-0 grid-cols-[32px_76px_minmax(0,2fr)_1fr_1fr_1fr] items-center gap-x-2";

/** Same numeric styling as screener value cells — 12px end inset. */
const ECONOMY_NUMERIC_CELL = cn(
  "min-w-0 w-full text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-fg",
  TABLE_END_ALIGNED_PAD_CLASS,
);

function EconomyEventCard({
  event,
  offsetMinutes,
  onEventClick,
  showDivider,
}: {
  event: EconomyCalendarEvent;
  offsetMinutes: number;
  onEventClick: (e: EconomyCalendarEvent) => void;
  showDivider: boolean;
}) {
  const flag = countryFlagEmoji(event.country);
  const clickable = eventHasData(event);
  return (
    <div
      className={cn(SCREENER_TABLE_DATA_ROW_CLASS, clickable && "cursor-pointer")}
      data-event-id={event.id}
      onClick={clickable ? () => onEventClick(event) : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onEventClick(event);
              }
            }
          : undefined
      }
    >
      <div className={ECONOMY_EVENT_OUTER_PAD_CLASS}>
        <article
          className={cn(
            "group w-full",
            ECONOMY_EVENT_INNER_PAD_CLASS,
            SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
          )}
        >
          <div className="flex items-center gap-2">
            <ImportanceBars importance={event.importance} />
            <p className="min-w-0 flex-1 truncate text-left text-xs leading-4 text-fg">
              {formatEconomyClockUtc(event.instantMs, offsetMinutes)}
            </p>
            <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[14px] leading-none" aria-hidden>
              {flag || "•"}
            </span>
          </div>
          <h3
            className={cn(
              "mt-1 text-left text-sm font-semibold leading-5 text-fg",
              clickable && "underline-offset-2 decoration-fg-muted group-hover/row:underline",
            )}
          >
            {eventTitle(event)}
          </h3>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs leading-4">
            <dt className="text-fg-muted">Forecast</dt>
            <dd className="text-right font-medium tabular-nums text-fg">{formatEconomyMetric(event.estimate)}</dd>
            <dt className="text-fg-muted">Actual</dt>
            <dd className="text-right font-medium tabular-nums text-fg">{formatEconomyMetric(event.actual)}</dd>
            <dt className="text-fg-muted">Prior</dt>
            <dd className="text-right font-medium tabular-nums text-fg">{formatEconomyMetric(event.previous)}</dd>
          </dl>
        </article>
      </div>
      {showDivider ? <div className={ECONOMY_EVENT_STROKE_CLASS} aria-hidden /> : null}
    </div>
  );
}

function EconomyListRow({
  event,
  offsetMinutes,
  onEventClick,
  showDivider,
}: {
  event: EconomyCalendarEvent;
  offsetMinutes: number;
  onEventClick: (e: EconomyCalendarEvent) => void;
  showDivider: boolean;
}) {
  const clickable = eventHasData(event);
  return (
    <div
      className={cn(SCREENER_TABLE_DATA_ROW_CLASS, clickable && "cursor-pointer")}
      onClick={clickable ? () => onEventClick(event) : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onEventClick(event);
              }
            }
          : undefined
      }
    >
      <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
        <div
          className={cn(
            ECONOMY_LIST_GRID,
            "min-h-[60px] text-[14px] leading-5 text-fg",
            SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
          )}
        >
          <div className={cn("flex justify-center", TABLE_START_ALIGNED_PAD_CLASS)}>
            <ImportanceBarsRow importance={event.importance} />
          </div>
          <span className="min-w-0 tabular-nums">{formatEconomyClockUtc(event.instantMs, offsetMinutes)}</span>
          <span
            className={cn(
              "min-w-0 truncate font-semibold",
              clickable && "underline-offset-2 decoration-fg-muted group-hover/row:underline",
            )}
          >
            {eventTitle(event)}
          </span>
          <div className={ECONOMY_NUMERIC_CELL}>{formatEconomyMetric(event.estimate)}</div>
          <div className={ECONOMY_NUMERIC_CELL}>{formatEconomyMetric(event.actual)}</div>
          <div className={ECONOMY_NUMERIC_CELL}>{formatEconomyMetric(event.previous)}</div>
        </div>
      </div>
      {showDivider ? <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden /> : null}
    </div>
  );
}

function EconomyListDayHeader() {
  return (
    <div
      className={cn(
        SCREENER_TABLE_HEADER_STICKY_CLASS,
        SCREENER_TABLE_ROUNDED_HEADER_CLASS,
        SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
        "md:border-b-0",
      )}
    >
      <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
        <div
          className={cn(
            ECONOMY_LIST_GRID,
            "min-h-[44px] text-[14px] font-medium leading-5 text-fg-muted",
          )}
          role="row"
          aria-label="Impact, time, event, forecast, actual, prior"
        >
          {/* In-flow placeholders: `sr-only` is position:absolute and skips grid tracks. */}
          <div aria-hidden className={cn("min-w-0", TABLE_START_ALIGNED_PAD_CLASS)} />
          <div aria-hidden className="min-w-0" />
          <div className="min-w-0 text-left">Event</div>
          <div className={cn(ECONOMY_NUMERIC_CELL, "font-medium text-fg-muted")}>Forecast</div>
          <div className={cn(ECONOMY_NUMERIC_CELL, "font-medium text-fg-muted")}>Actual</div>
          <div className={cn(ECONOMY_NUMERIC_CELL, "font-medium text-fg-muted")}>Prior</div>
        </div>
      </div>
      <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
    </div>
  );
}

const weekNavBtnClass = cn(
  "inline-flex h-9 shrink-0 items-center justify-center rounded-[10px] text-fg transition-all duration-100 hover:bg-surface-muted",
  whiteSurfaceButtonChromeClass,
);

const weekNavArrowClass = cn(weekNavBtnClass, "w-9");

const weekNavTodayClass = cn(weekNavBtnClass, "px-3 text-sm font-medium leading-5");

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

function EconomyEventCardSkeleton({ showDivider }: { showDivider: boolean }) {
  return (
    <div className={SCREENER_TABLE_DATA_ROW_CLASS} aria-hidden>
      <div className={ECONOMY_EVENT_OUTER_PAD_CLASS}>
        <div className={cn("w-full", ECONOMY_EVENT_INNER_PAD_CLASS, SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS)}>
          <div className="flex items-center gap-2">
            <SkeletonBox className="h-5 w-5 shrink-0 rounded-[10px]" />
            <TextSkeleton wClass="w-14" hClass="h-3" />
            <SkeletonBox className="ml-auto h-4 w-4 shrink-0 rounded" />
          </div>
          <SkeletonBox className="mt-2 h-4 w-[85%] rounded-md" />
          <div className="mt-2 space-y-1.5">
            <div className="flex justify-between gap-3">
              <TextSkeleton wClass="w-14" hClass="h-3" />
              <TextSkeleton wClass="w-10" hClass="h-3" />
            </div>
            <div className="flex justify-between gap-3">
              <TextSkeleton wClass="w-12" hClass="h-3" />
              <TextSkeleton wClass="w-10" hClass="h-3" />
            </div>
            <div className="flex justify-between gap-3">
              <TextSkeleton wClass="w-10" hClass="h-3" />
              <TextSkeleton wClass="w-10" hClass="h-3" />
            </div>
          </div>
        </div>
      </div>
      {showDivider ? <div className={ECONOMY_EVENT_STROKE_CLASS} aria-hidden /> : null}
    </div>
  );
}

function EconomyWeekGridSkeleton({
  weekMondayYmd,
  todayYmd,
}: {
  weekMondayYmd: string;
  todayYmd: string;
}) {
  const days = useMemo(() => buildWeekDayDateStubs(weekMondayYmd), [weekMondayYmd]);

  return (
    <div className="flex min-w-0 flex-col" aria-busy="true" aria-label="Loading economy calendar">
      <div className="-mx-1 flex flex-col overflow-x-auto pb-1 md:mx-0 md:overflow-x-hidden md:overflow-y-visible">
        <div className={ECONOMY_WEEK_DAY_GAP_CLASS}>
            {days.map((day) => {
              const isToday = day.date === todayYmd;
              return (
                <div key={day.date} className={ECONOMY_WEEK_DAY_CARD_CLASS}>
                  <EconomyWeekDayHeader
                    weekdayLabel={day.weekdayLabel}
                    dayNumber={day.dayNumber}
                    isToday={isToday}
                  />
                  <div className={ECONOMY_EVENTS_STACK_CLASS}>
                    <EconomyEventCardSkeleton showDivider />
                    <EconomyEventCardSkeleton showDivider={false} />
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

function EconomyWeekListSkeleton() {
  return (
    <div className="flex min-w-0 flex-col space-y-5" aria-busy="true" aria-label="Loading economy calendar">
      {Array.from({ length: 2 }, (_, dayIdx) => (
        <section key={dayIdx} className="w-full min-w-0">
          <SkeletonBox className="mb-5 h-7 w-56 rounded-md" />
          <ScreenerTableScroll>
            <div className="bg-surface">
              <EconomyListDayHeader />
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className={SCREENER_TABLE_DATA_ROW_CLASS} aria-hidden>
                  <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
                    <div
                      className={cn(
                        ECONOMY_LIST_GRID,
                        "min-h-[60px]",
                        SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
                      )}
                    >
                      <div className={cn("flex justify-center", TABLE_START_ALIGNED_PAD_CLASS)}>
                        <SkeletonBox className="h-8 w-7 rounded-md" />
                      </div>
                      <TextSkeleton wClass="w-14" hClass="h-3.5" />
                      <TextSkeleton wClass="w-full max-w-[200px]" hClass="h-3.5" />
                      <div className={cn("flex justify-end", TABLE_END_ALIGNED_PAD_CLASS)}>
                        <TextSkeleton wClass="w-12" hClass="h-3.5" />
                      </div>
                      <div className={cn("flex justify-end", TABLE_END_ALIGNED_PAD_CLASS)}>
                        <TextSkeleton wClass="w-12" hClass="h-3.5" />
                      </div>
                      <div className={cn("flex justify-end", TABLE_END_ALIGNED_PAD_CLASS)}>
                        <TextSkeleton wClass="w-12" hClass="h-3.5" />
                      </div>
                    </div>
                  </div>
                  {i < 3 ? <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden /> : null}
                </div>
              ))}
            </div>
          </ScreenerTableScroll>
        </section>
      ))}
    </div>
  );
}

export function EconomyCalendarClient({
  data,
  country,
}: {
  data: EconomyWeekPayload;
  country: string;
}) {
  const router = useRouter();
  const [, startWeekTransition] = useTransition();
  const todayKey = useMemo(() => todayYmdUtc(), []);
  const thisWeekMondayYmd = useMemo(() => currentWeekMondayYmdUtc(), []);

  const [pendingWeekMondayYmd, setPendingWeekMondayYmd] = useState<string | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>("major");
  const [tzId, setTzId] = useState<EconomyTimezoneOption["id"]>("utc+4");

  const offsetMinutes = useMemo(() => {
    const opt = ECONOMY_TIMEZONE_OPTIONS.find((o) => o.id === tzId);
    return opt?.offsetMinutes ?? 0;
  }, [tzId]);

  const tzOptions: ListboxOption<EconomyTimezoneOption["id"]>[] = ECONOMY_TIMEZONE_OPTIONS.map((o) => ({
    value: o.id,
    label: o.label,
  }));

  const filteredDays: EconomyDayColumn[] = useMemo(
    () =>
      data.days.map((day) => ({
        ...day,
        events: day.events.filter((e) => passesImpact(e, impactFilter)),
      })),
    [data.days, impactFilter],
  );

  const weekHref = useCallback(
    (weekYmd: string) =>
      `/economy?week=${encodeURIComponent(weekYmd)}&country=${encodeURIComponent(country)}`,
    [country],
  );

  useEffect(() => {
    if (pendingWeekMondayYmd && pendingWeekMondayYmd === data.weekMondayYmd) {
      setPendingWeekMondayYmd(null);
    }
  }, [data.weekMondayYmd, pendingWeekMondayYmd]);

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
        router.push(weekHref(weekYmd));
      });
    },
    [displayWeekMondayYmd, isWeekLoading, router, weekHref],
  );

  const totalFilteredEvents = filteredDays.reduce((n, d) => n + d.events.length, 0);

  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [historyEvent, setHistoryEvent] = useState<EconomyCalendarEvent | null>(null);
  const handleEventClick = useCallback((ev: EconomyCalendarEvent) => {
    setHistoryEvent(ev);
  }, []);
  const handleModalClose = useCallback(() => {
    setHistoryEvent(null);
  }, []);

  return (
    <div className="space-y-6">
      {/* Mobile: title + grid/list on one row; Settings + week nav below. Desktop: title left, all controls right. */}
      <div className="relative z-40 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center justify-between gap-3 sm:contents">
          <h1 className="min-w-0 text-2xl font-semibold leading-9 tracking-tight text-fg">
            {displayWeekLabel}
          </h1>
          <div className="shrink-0 sm:hidden">
            <SegmentedControl
              aria-label="Economy calendar view"
              value={view}
              onChange={setView}
              options={[
                {
                  value: "grid",
                  "aria-label": "Week grid view",
                  label: <CalendarDays className="h-5 w-5" strokeWidth={1.75} aria-hidden />,
                },
                {
                  value: "list",
                  "aria-label": "List view",
                  label: <LayoutList className="h-5 w-5" strokeWidth={1.75} aria-hidden />,
                },
              ]}
            />
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center justify-start gap-3 sm:w-auto sm:shrink-0 sm:justify-end">
          {/* Mobile: settings toggle button */}
          <button
            type="button"
            onClick={() => setMobileSettingsOpen((v) => !v)}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-[10px] border border-stroke bg-surface px-3 text-sm font-medium text-fg shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-06))] transition-colors hover:bg-surface-muted sm:hidden",
              mobileSettingsOpen && "bg-surface-muted",
            )}
            aria-expanded={mobileSettingsOpen}
            aria-label="Filters"
          >
            <Filter className="h-4 w-4" strokeWidth={1.75} />
            <span>Filters</span>
          </button>

          {/* Desktop: always visible controls */}
          <div className="hidden shrink-0 items-center gap-3 sm:flex">
            <SegmentedControl
              aria-label="Economy calendar view"
              value={view}
              onChange={setView}
              options={[
                {
                  value: "grid",
                  "aria-label": "Week grid view",
                  label: <CalendarDays className="h-5 w-5" strokeWidth={1.75} aria-hidden />,
                },
                {
                  value: "list",
                  "aria-label": "List view",
                  label: <LayoutList className="h-5 w-5" strokeWidth={1.75} aria-hidden />,
                },
              ]}
            />

            <FormListboxSelect
              aria-label="Impact filter"
              value={impactFilter}
              onChange={setImpactFilter}
              options={IMPACT_OPTIONS}
              truncateLabel={false}
              className="w-max shrink-0"
            />
            <FormListboxSelect
              aria-label="Timezone"
              value={tzId}
              onChange={setTzId}
              options={tzOptions}
              truncateLabel={false}
              className="w-max shrink-0"
            />
            <FormListboxSelect
              aria-label="Country"
              value={ECONOMY_COUNTRY_OPTIONS.some((o) => o.value === country) ? country : "US"}
              onChange={(next) => {
                const qs = new URLSearchParams({
                  week: displayWeekMondayYmd,
                  country: next,
                });
                router.push(`/economy?${qs.toString()}`);
              }}
              options={ECONOMY_COUNTRY_OPTIONS}
              truncateLabel={false}
              truncateOptions={false}
              className="w-max shrink-0"
            />
          </div>

          <div className="flex shrink-0 items-center gap-2">
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
      </div>

      {/* Mobile settings panel (filters only — view toggle lives on the title row) */}
      {mobileSettingsOpen && (
        <div className="relative z-40 flex flex-col gap-3 sm:hidden">
          <FormListboxSelect
            aria-label="Impact filter"
            value={impactFilter}
            onChange={setImpactFilter}
            options={IMPACT_OPTIONS}
            truncateLabel={false}
            className="w-full"
          />
          <FormListboxSelect
            aria-label="Timezone"
            value={tzId}
            onChange={setTzId}
            options={tzOptions}
            truncateLabel={false}
            className="w-full"
          />
          <FormListboxSelect
            aria-label="Country"
            value={ECONOMY_COUNTRY_OPTIONS.some((o) => o.value === country) ? country : "US"}
            onChange={(next) => {
              const qs = new URLSearchParams({
                week: displayWeekMondayYmd,
                country: next,
              });
              router.push(`/economy?${qs.toString()}`);
            }}
            options={ECONOMY_COUNTRY_OPTIONS}
            truncateLabel={false}
            truncateOptions={false}
            className="w-full"
          />
        </div>
      )}

      {view === "grid" ? (
        isWeekLoading ? (
          <EconomyWeekGridSkeleton weekMondayYmd={displayWeekMondayYmd} todayYmd={todayKey} />
        ) : (
        <div className="flex min-w-0 flex-col">
          <div className="-mx-1 flex flex-col overflow-x-auto pb-1 md:mx-0 md:overflow-x-hidden md:overflow-y-visible">
            <div className={ECONOMY_WEEK_DAY_GAP_CLASS}>
              {filteredDays.map((day) => {
                const isToday = day.date === todayKey;
                return (
                <div key={day.date} className={ECONOMY_WEEK_DAY_CARD_CLASS}>
                  <EconomyWeekDayHeader
                    weekdayLabel={day.weekdayLabel}
                    dayNumber={day.dayNumber}
                    isToday={isToday}
                  />
                  <div className={ECONOMY_EVENTS_STACK_CLASS}>
                    {day.events.length === 0 ? (
                      <div className="flex flex-1 flex-col items-center justify-center px-2 py-6 text-center md:px-2">
                        <p className="text-sm leading-5 text-fg">No scheduled Reports</p>
                      </div>
                    ) : (
                      day.events.map((ev, index) => (
                        <EconomyEventCard
                          key={ev.id}
                          event={ev}
                          offsetMinutes={offsetMinutes}
                          onEventClick={handleEventClick}
                          showDivider={index < day.events.length - 1}
                        />
                      ))
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        </div>
        )
      ) : isWeekLoading ? (
        <EconomyWeekListSkeleton />
      ) : (
        <div className="flex min-w-0 flex-col space-y-5">
          {totalFilteredEvents === 0 ? (
            <div className="rounded-2xl border border-stroke-subtle bg-surface px-4 py-12 text-center text-sm text-fg-muted shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-04))]">
              No scheduled reports
            </div>
          ) : (
            filteredDays.map((day) => {
              const isToday = day.date === todayKey;
              return (
                <section key={day.date} id={`economy-list-${day.date}`} className="w-full min-w-0">
                  <h3
                    className={cn(
                      "mb-5 text-xl font-semibold tracking-tight",
                      isToday ? "text-down" : "text-fg",
                    )}
                  >
                    {formatEconomyLongDateUtc(day.date)}
                  </h3>
                  <ScreenerTableScroll>
                    <div className="bg-surface">
                      <EconomyListDayHeader />
                      {day.events.length === 0 ? (
                        <div className="flex min-h-[60px] items-center justify-center px-4 py-6 text-[14px] leading-5 text-fg-muted">
                          No scheduled reports
                        </div>
                      ) : (
                        day.events.map((ev, i) => (
                          <EconomyListRow
                            key={ev.id}
                            event={ev}
                            offsetMinutes={offsetMinutes}
                            onEventClick={handleEventClick}
                            showDivider={i < day.events.length - 1}
                          />
                        ))
                      )}
                    </div>
                  </ScreenerTableScroll>
                </section>
              );
            })
          )}
        </div>
      )}

      {historyEvent && (
        <EconomyEventHistoryModal
          open={!!historyEvent}
          onClose={handleModalClose}
          event={historyEvent}
          country={country}
        />
      )}
    </div>
  );
}
