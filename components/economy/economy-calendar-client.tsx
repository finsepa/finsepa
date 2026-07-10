"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, LayoutList, Settings2 } from "@/lib/icons";

import { EconomyEventHistoryModal } from "@/components/economy/economy-event-history-modal";
import { SkeletonBox, TextSkeleton } from "@/components/markets/skeleton";
import { ScreenerTableScroll, SCREENER_TABLE_HEADER_STICKY_CLASS } from "@/components/screener/screener-table-scroll";
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
import { whiteSurfaceButtonChromeClass } from "@/components/design-system";
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

function ImportanceBars({ importance }: { importance: EconomyCalendarEvent["importance"] }) {
  const bars: readonly number[] =
    importance >= 3 ? [7, 9, 11] : importance === 2 ? [7, 10] : [7];
  return (
    <div
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[10px] bg-[#F4F4F5]"
      title="Impact"
      aria-hidden
    >
      <div className="flex h-[11px] items-end justify-center gap-0.5">
        {bars.map((h, i) => (
          <span key={i} className="w-0.5 rounded-[10px] bg-[#2563EB]" style={{ height: `${h}px` }} />
        ))}
      </div>
    </div>
  );
}

/** List row importance indicator — matches Figma bar proportions. */
function ImportanceBarsRow({ importance }: { importance: EconomyCalendarEvent["importance"] }) {
  const bars: readonly number[] =
    importance >= 3 ? [12, 16, 20] : importance === 2 ? [12, 17] : [12];
  return (
    <div className="flex h-8 w-7 shrink-0 items-end justify-center gap-1 pb-0.5 pt-1" title="Impact" aria-hidden>
      {bars.map((h, i) => (
        <span key={i} className="w-1 rounded-[10px] bg-[#2563EB]" style={{ height: `${h}px` }} />
      ))}
    </div>
  );
}

function eventHasData(e: EconomyCalendarEvent): boolean {
  return e.estimate != null || e.actual != null || e.previous != null;
}

function EconomyEventCard({
  event,
  offsetMinutes,
  onEventClick,
}: {
  event: EconomyCalendarEvent;
  offsetMinutes: number;
  onEventClick: (e: EconomyCalendarEvent) => void;
}) {
  const flag = countryFlagEmoji(event.country);
  const clickable = eventHasData(event);
  return (
    <article
      className={cn(
        "group w-full rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-colors",
        clickable && "cursor-pointer hover:bg-[#FAFAFA]",
      )}
      data-event-id={event.id}
      onClick={clickable ? () => onEventClick(event) : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEventClick(event); } } : undefined}
    >
      <div className="flex items-center gap-2">
        <ImportanceBars importance={event.importance} />
        <p className="min-w-0 flex-1 truncate text-left text-xs leading-4 text-[#09090B]">
          {formatEconomyClockUtc(event.instantMs, offsetMinutes)}
        </p>
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[14px] leading-none" aria-hidden>
          {flag || "•"}
        </span>
      </div>
      <h3 className={cn(
        "mt-1 text-left text-sm font-semibold leading-5 text-[#09090B]",
        clickable && "underline-offset-2 decoration-[#71717A] group-hover:underline",
      )}>{eventTitle(event)}</h3>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs leading-4">
        <dt className="text-[#71717A]">Forecast</dt>
        <dd className="text-right font-medium tabular-nums text-[#09090B]">{formatEconomyMetric(event.estimate)}</dd>
        <dt className="text-[#71717A]">Actual</dt>
        <dd className="text-right font-medium tabular-nums text-[#09090B]">{formatEconomyMetric(event.actual)}</dd>
        <dt className="text-[#71717A]">Prior</dt>
        <dd className="text-right font-medium tabular-nums text-[#09090B]">{formatEconomyMetric(event.previous)}</dd>
      </dl>
    </article>
  );
}

function EconomyListRow({
  event,
  offsetMinutes,
  onEventClick,
}: {
  event: EconomyCalendarEvent;
  offsetMinutes: number;
  onEventClick: (e: EconomyCalendarEvent) => void;
}) {
  const clickable = eventHasData(event);
  return (
    <div
      className={cn(
        listTableRowClass,
        "group text-[14px] leading-5 text-[#09090B]",
        clickable && "cursor-pointer",
      )}
      onClick={clickable ? () => onEventClick(event) : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEventClick(event); } } : undefined}
    >
      <div className="flex justify-center">
        <ImportanceBarsRow importance={event.importance} />
      </div>
      <span className="min-w-0 tabular-nums">{formatEconomyClockUtc(event.instantMs, offsetMinutes)}</span>
      <span className={cn(
        "min-w-0 truncate font-semibold",
        clickable && "underline-offset-2 decoration-[#71717A] group-hover:underline",
      )}>{eventTitle(event)}</span>
      <div className={listNumericCellClass}>{formatEconomyMetric(event.estimate)}</div>
      <div className={listNumericCellClass}>{formatEconomyMetric(event.actual)}</div>
      <div className={listNumericCellClass}>{formatEconomyMetric(event.previous)}</div>
    </div>
  );
}

const weekNavBtnClass = cn(
  "inline-flex h-9 shrink-0 items-center justify-center rounded-[10px] text-[#09090B] transition-all duration-100 hover:bg-[#F4F4F5]",
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

function EconomyEventCardSkeleton() {
  return (
    <div className="w-full rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]">
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
        <div className="flex w-max min-w-full flex-col rounded-2xl bg-[#F4F4F5] p-1 md:w-full">
          <div className="flex min-h-[min(60vh,716px)] w-max min-w-full gap-1 rounded-2xl bg-[#F4F4F5] md:w-full md:flex-row md:items-stretch">
            {days.map((day) => {
              const isToday = day.date === todayYmd;
              return (
                <div
                  key={day.date}
                  className="flex w-[min(100%,240px)] shrink-0 flex-col rounded-xl border border-[#E4E4E7] bg-white px-2 py-3 md:min-h-0 md:flex-1 md:shrink md:px-0 md:py-0"
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
                      className={cn(
                        "text-[15px] font-semibold tabular-nums",
                        isToday ? "text-[#DC2626]" : "text-[#09090B]",
                      )}
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
                      className={cn(
                        "flex flex-wrap items-center justify-center gap-1 py-0.5 text-center text-[18px] leading-6",
                        isToday ? "text-[#DC2626]" : "text-[#09090B]",
                      )}
                    >
                      <span className="font-normal">{day.weekdayLabel}</span>
                      <span className="font-semibold tabular-nums">{day.dayNumber}</span>
                    </div>
                    <div className="mt-1" aria-hidden>
                      <div className={cn("h-0.5 w-full", isToday ? "bg-[#DC2626]" : "bg-transparent")} />
                    </div>
                  </div>
                  <div className="flex min-h-[120px] flex-col gap-2 px-2 pt-2 pb-4 md:overflow-visible">
                    <EconomyEventCardSkeleton />
                    <EconomyEventCardSkeleton />
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

function EconomyWeekListSkeleton() {
  return (
    <div className="flex min-w-0 flex-col space-y-0" aria-busy="true" aria-label="Loading economy calendar">
      <div className="divide-y divide-[#E4E4E7] rounded-xl border border-[#E4E4E7] bg-white">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className={cn(listTableRowClass, "gap-y-2 py-3")}>
            <SkeletonBox className="mx-auto h-8 w-7 rounded-md" />
            <TextSkeleton wClass="w-14" hClass="h-3.5" />
            <TextSkeleton wClass="w-full max-w-[200px]" hClass="h-3.5" />
            <TextSkeleton wClass="w-full" hClass="h-3.5" />
            <TextSkeleton wClass="w-full" hClass="h-3.5" />
            <TextSkeleton wClass="w-full" hClass="h-3.5" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Matches toolbar listboxes elsewhere (e.g. heatmap): do not set `px-*` here — label padding is inside the component. */
const dropdownTriggerClass =
  "border border-solid border-[#E4E4E7] bg-white shadow-[0px_1px_1px_0px_rgba(10,10,10,0.06)] hover:bg-[#FAFAFA]";

/** Grid columns aligned with screener tables (`gap-x-2`, right-aligned numeric cols). */
const economyListColLayout =
  "grid grid-cols-[32px_76px_minmax(0,2fr)_1fr_1fr_1fr] gap-x-2";

const listTableHeaderClass = cn(
  economyListColLayout,
  "min-h-[44px] items-center bg-white px-2 py-0 text-[12px] font-medium leading-5 text-[#71717A] sm:px-4 sm:text-[14px]",
);

const listTableRowClass = cn(
  economyListColLayout,
  "min-h-[60px] items-center bg-white px-2 transition-colors duration-75 hover:bg-neutral-50 sm:px-4",
);

/** Same numeric styling as screener value cells (e.g. M Cap / PE). */
const listNumericCellClass =
  "min-w-0 w-full text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-[#09090B]";

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
      <div className="relative z-30 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="min-w-0 text-2xl font-semibold leading-9 tracking-tight text-[#09090B]">
            {displayWeekLabel}
          </h1>

          <div className="flex w-full flex-wrap items-center justify-end gap-3 sm:w-auto sm:shrink-0">
            {/* Mobile: settings toggle button */}
            <button
              type="button"
              onClick={() => setMobileSettingsOpen((v) => !v)}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-[10px] border border-[#E4E4E7] bg-white px-3 text-sm font-medium text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-colors hover:bg-[#F4F4F5] sm:hidden",
                mobileSettingsOpen && "bg-[#F4F4F5]",
              )}
              aria-expanded={mobileSettingsOpen}
              aria-label="Settings"
            >
              <Settings2 className="h-4 w-4" strokeWidth={1.75} />
              <span>Settings</span>
            </button>

            {/* Desktop: always visible controls */}
            <div className="hidden shrink-0 items-center gap-3 sm:flex">
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

              <FormListboxSelect
                aria-label="Impact filter"
                value={impactFilter}
                onChange={setImpactFilter}
                options={IMPACT_OPTIONS}
                truncateLabel={false}
                className="w-max shrink-0"
                triggerClassName={dropdownTriggerClass}
              />
              <FormListboxSelect
                aria-label="Timezone"
                value={tzId}
                onChange={setTzId}
                options={tzOptions}
                truncateLabel={false}
                className="w-max shrink-0"
                triggerClassName={dropdownTriggerClass}
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
                triggerClassName={dropdownTriggerClass}
              />
            </div>

            <div className="flex shrink-0 items-center gap-3">
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

        {/* Mobile settings panel */}
        {mobileSettingsOpen && (
          <div className="relative z-30 flex flex-col gap-3 sm:hidden">
            <div className="flex shrink-0 self-start rounded-[10px] bg-[#F4F4F5] p-0.5">
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
            <FormListboxSelect
              aria-label="Impact filter"
              value={impactFilter}
              onChange={setImpactFilter}
              options={IMPACT_OPTIONS}
              truncateLabel={false}
              className="w-full"
              triggerClassName={dropdownTriggerClass}
            />
            <FormListboxSelect
              aria-label="Timezone"
              value={tzId}
              onChange={setTzId}
              options={tzOptions}
              truncateLabel={false}
              className="w-full"
              triggerClassName={dropdownTriggerClass}
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
              triggerClassName={dropdownTriggerClass}
            />
          </div>
        )}

      {view === "grid" ? (
        isWeekLoading ? (
          <EconomyWeekGridSkeleton weekMondayYmd={displayWeekMondayYmd} todayYmd={todayKey} />
        ) : (
        <div className="flex min-w-0 flex-col">
          <div className="-mx-1 flex flex-col overflow-x-auto pb-1 md:mx-0 md:overflow-x-hidden md:overflow-y-visible">
            <div className="flex w-max min-w-full flex-col rounded-2xl bg-[#F4F4F5] p-1 md:w-full">
              <div className="flex min-h-[min(60vh,716px)] w-max min-w-full gap-1 rounded-2xl bg-[#F4F4F5] md:w-full md:flex-row md:items-stretch">
              {filteredDays.map((day) => {
                const isToday = day.date === todayKey;
                return (
                <div
                  key={day.date}
                  className="flex w-[min(100%,240px)] shrink-0 flex-col rounded-xl border border-[#E4E4E7] bg-white px-2 py-3 md:min-h-0 md:flex-1 md:shrink md:px-0 md:py-0"
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
                      className={cn(
                        "text-[15px] font-semibold tabular-nums",
                        isToday ? "text-[#DC2626]" : "text-[#09090B]",
                      )}
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
                      className={cn(
                        "flex flex-wrap items-center justify-center gap-1 py-0.5 text-center text-[18px] leading-6",
                        isToday ? "text-[#DC2626]" : "text-[#09090B]",
                      )}
                    >
                      <span className="font-normal">{day.weekdayLabel}</span>
                      <span className="font-semibold tabular-nums">{day.dayNumber}</span>
                    </div>
                    <div className="mt-1" aria-hidden>
                      <div className={cn("h-0.5 w-full", isToday ? "bg-[#DC2626]" : "bg-transparent")} />
                    </div>
                  </div>
                  <div className="flex min-h-[120px] flex-col gap-2 px-2 pt-2 pb-4 md:overflow-visible">
                    {day.events.length === 0 ? (
                      <div className="flex flex-1 flex-col items-center justify-center rounded-lg bg-white px-3 py-6 text-center">
                        <p className="text-sm leading-5 text-[#09090B]">No scheduled Reports</p>
                      </div>
                    ) : (
                      day.events.map((ev) => (
                        <EconomyEventCard key={ev.id} event={ev} offsetMinutes={offsetMinutes} onEventClick={handleEventClick} />
                      ))
                    )}
                  </div>
                </div>
                );
              })}
              </div>
            </div>
          </div>
        </div>
        )
      ) : isWeekLoading ? (
        <EconomyWeekListSkeleton />
      ) : (
        <div className="flex min-w-0 flex-col space-y-0">
          {totalFilteredEvents === 0 ? (
            <div className="rounded-xl border border-[#E4E4E7] bg-white px-4 py-12 text-center text-sm text-[#71717A]">
              No scheduled reports
            </div>
          ) : (
            <ScreenerTableScroll>
              <div className="divide-y divide-[#E4E4E7] bg-white">
                {filteredDays.map((day) => (
                  <section key={day.date} id={`economy-list-${day.date}`} className="divide-y divide-[#E4E4E7]">
                    <div
                      className={cn(
                        "px-2 py-2 text-[14px] font-semibold leading-5 text-[#09090B] sm:px-4 sm:py-3",
                        day.date === todayKey && "border-b-2 border-[#DC2626]",
                      )}
                    >
                      {formatEconomyLongDateUtc(day.date)}
                    </div>

                    <div
                      className={cn(listTableHeaderClass, day.date === todayKey && "border-t-0")}
                      role="row"
                      aria-label="Impact, time, event, forecast, actual, prior"
                    >
                      {/* In-flow placeholders: `sr-only` is position:absolute and skips grid tracks, which broke alignment. */}
                      <div aria-hidden className="min-w-0" />
                      <div aria-hidden className="min-w-0" />
                      <div className="min-w-0 text-left">Event</div>
                      <div className={cn(listNumericCellClass, "font-medium text-[#71717A]")}>Forecast</div>
                      <div className={cn(listNumericCellClass, "font-medium text-[#71717A]")}>Actual</div>
                      <div className={cn(listNumericCellClass, "font-medium text-[#71717A]")}>Prior</div>
                    </div>

                    {day.events.length === 0 ? (
                      <div className="flex min-h-[60px] items-center justify-center px-2 py-6 text-[14px] leading-5 text-[#71717A] sm:px-4">
                        No scheduled reports
                      </div>
                    ) : (
                      day.events.map((ev) => <EconomyListRow key={ev.id} event={ev} offsetMinutes={offsetMinutes} onEventClick={handleEventClick} />)
                    )}
                  </section>
                ))}
              </div>
            </ScreenerTableScroll>
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
