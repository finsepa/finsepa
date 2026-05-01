"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, LayoutList } from "lucide-react";

import { ScreenerTableScroll } from "@/components/screener/screener-table-scroll";
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
import { cn } from "@/lib/utils";

const ECONOMY_COUNTRY_OPTIONS: ListboxOption[] = [
  { value: "US", label: `${countryFlagEmoji("US")} United States` },
  { value: "GB", label: `${countryFlagEmoji("GB")} United Kingdom` },
  { value: "DE", label: `${countryFlagEmoji("DE")} Germany` },
  { value: "FR", label: `${countryFlagEmoji("FR")} France` },
  { value: "JP", label: `${countryFlagEmoji("JP")} Japan` },
  { value: "CN", label: `${countryFlagEmoji("CN")} China` },
  { value: "CA", label: `${countryFlagEmoji("CA")} Canada` },
  { value: "AU", label: `${countryFlagEmoji("AU")} Australia` },
  { value: "IT", label: `${countryFlagEmoji("IT")} Italy` },
  { value: "ES", label: `${countryFlagEmoji("ES")} Spain` },
];

type ImpactFilter = "all" | "notable" | "major";

const IMPACT_OPTIONS: ListboxOption<ImpactFilter>[] = [
  { value: "all", label: "All impact levels" },
  { value: "notable", label: "Medium impact +" },
  { value: "major", label: "High impact only" },
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
  return e.importance >= 2;
}

function ImportanceBars({ importance }: { importance: EconomyCalendarEvent["importance"] }) {
  const heights =
    importance >= 3 ? ([7, 9, 11] as const) : importance === 2 ? ([6, 8, 10] as const) : ([5, 6, 7] as const);
  return (
    <div
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[10px] bg-[#F4F4F5]"
      title="Impact"
      aria-hidden
    >
      <div className="flex h-[11px] items-end justify-center gap-0.5">
        {heights.map((h, i) => (
          <span key={i} className="w-0.5 rounded-[10px] bg-[#2563EB]" style={{ height: `${h}px` }} />
        ))}
      </div>
    </div>
  );
}

/** List row importance indicator — matches Figma bar proportions. */
function ImportanceBarsRow({ importance }: { importance: EconomyCalendarEvent["importance"] }) {
  const heights =
    importance >= 3 ? ([12, 16, 20] as const) : importance === 2 ? ([10, 14, 18] as const) : ([8, 10, 12] as const);
  return (
    <div className="flex h-8 w-7 shrink-0 items-end justify-center gap-1 pb-0.5 pt-1" title="Impact" aria-hidden>
      {heights.map((h, i) => (
        <span key={i} className="w-1 rounded-[10px] bg-[#2563EB]" style={{ height: `${h}px` }} />
      ))}
    </div>
  );
}

function EconomyEventCard({
  event,
  offsetMinutes,
}: {
  event: EconomyCalendarEvent;
  offsetMinutes: number;
}) {
  const flag = countryFlagEmoji(event.country);
  return (
    <article
      className="w-full rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]"
      data-event-id={event.id}
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
      <h3 className="mt-1 text-left text-sm font-semibold leading-5 text-[#09090B]">{eventTitle(event)}</h3>
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

/** Week grid column headers only (list view does not show this strip). */
function EconomyWeekdayStrip({
  days,
  highlightYmd,
}: {
  days: Pick<EconomyDayColumn, "date" | "weekdayLabel" | "dayNumber">[];
  highlightYmd: string;
}) {
  return (
    <div className="relative border-b border-t border-[#E4E4E7] py-2 pb-0">
      <div className="flex w-full gap-6 text-center text-lg leading-7">
        {days.map((day) => {
          const active = day.date === highlightYmd;
          return (
            <div
              key={day.date}
              className={cn(
                "flex min-h-px min-w-0 flex-1 flex-wrap items-center justify-center gap-1 py-1",
                active ? "text-[#DC2626]" : "text-[#09090B]",
              )}
            >
              <span className="font-normal">{day.weekdayLabel}</span>
              <span className="font-semibold tabular-nums">{day.dayNumber}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex w-full gap-6" aria-hidden>
        {days.map((day) => {
          const active = day.date === highlightYmd;
          return (
            <div key={`u-${day.date}`} className="min-h-px min-w-0 flex-1">
              <div className={cn("h-0.5 w-full", active ? "bg-[#DC2626]" : "bg-transparent")} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EconomyListRow({
  event,
  offsetMinutes,
}: {
  event: EconomyCalendarEvent;
  offsetMinutes: number;
}) {
  const flag = countryFlagEmoji(event.country);
  return (
    <div className={cn(listTableRowClass, "text-[14px] leading-5 text-[#09090B]")}>
      <div className="flex justify-center">
        <ImportanceBarsRow importance={event.importance} />
      </div>
      <span className="min-w-0 tabular-nums">{formatEconomyClockUtc(event.instantMs, offsetMinutes)}</span>
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center text-base leading-none" aria-hidden>
          {flag || "•"}
        </span>
        <span className="min-w-0 truncate font-normal">{event.country}</span>
      </div>
      <span className="min-w-0 truncate font-semibold">{eventTitle(event)}</span>
      <div className={listNumericCellClass}>{formatEconomyMetric(event.estimate)}</div>
      <div className={listNumericCellClass}>{formatEconomyMetric(event.actual)}</div>
      <div className={listNumericCellClass}>{formatEconomyMetric(event.previous)}</div>
    </div>
  );
}

const navBtnClass =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[#09090B] transition-colors hover:bg-[#F4F4F5]";

/** Matches toolbar listboxes elsewhere (e.g. heatmap): do not set `px-*` here — label padding is inside the component. */
const dropdownTriggerClass =
  "border border-solid border-[#E4E4E7] bg-white shadow-[0px_1px_1px_0px_rgba(10,10,10,0.06)] hover:bg-[#FAFAFA]";

/** Grid columns aligned with screener tables (`gap-x-2`, right-aligned numeric cols). */
const economyListColLayout =
  "grid grid-cols-[32px_76px_minmax(96px,1fr)_minmax(0,2fr)_1fr_1fr_1fr] gap-x-2";

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
  prevWeekYmd,
  nextWeekYmd,
  country,
}: {
  data: EconomyWeekPayload;
  prevWeekYmd: string;
  nextWeekYmd: string;
  country: string;
}) {
  const router = useRouter();
  const todayKey = useMemo(() => todayYmdUtc(), []);
  const thisWeekMondayYmd = useMemo(() => currentWeekMondayYmdUtc(), []);

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

  const weekHref = (weekYmd: string) =>
    `/economy?week=${encodeURIComponent(weekYmd)}&country=${encodeURIComponent(country)}`;

  const totalFilteredEvents = filteredDays.reduce((n, d) => n + d.events.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-0.5">
        <p className="text-base font-normal leading-6 text-[#71717A]">Economy Calendar</p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold leading-9 tracking-tight text-[#09090B]">{data.weekLabel}</h1>
            <div className="flex shrink-0 items-center gap-3">
              <Link href={weekHref(prevWeekYmd)} prefetch={false} className={navBtnClass} aria-label="Previous week">
                <ChevronLeft className="h-5 w-5" strokeWidth={1.75} />
              </Link>
              <Link
                href={weekHref(thisWeekMondayYmd)}
                prefetch={false}
                className="inline-flex h-9 shrink-0 items-center justify-center rounded-[10px] border border-[#E4E4E7] bg-white px-3 text-sm font-medium leading-5 text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-all duration-100 hover:bg-[#F4F4F5]"
                aria-label="Go to this week"
                aria-current={data.weekMondayYmd === thisWeekMondayYmd ? "page" : undefined}
              >
                Today
              </Link>
              <Link href={weekHref(nextWeekYmd)} prefetch={false} className={navBtnClass} aria-label="Next week">
                <ChevronRight className="h-5 w-5" strokeWidth={1.75} />
              </Link>
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center justify-end gap-3 sm:w-auto sm:shrink-0">
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
              className="max-w-[min(100%,280px)] shrink-0 sm:w-max sm:max-w-none"
              triggerClassName={dropdownTriggerClass}
            />
            <FormListboxSelect
              aria-label="Timezone"
              value={tzId}
              onChange={setTzId}
              options={tzOptions}
              truncateLabel={false}
              className="max-w-[min(100%,200px)] shrink-0 sm:w-max sm:max-w-none"
              triggerClassName={dropdownTriggerClass}
            />
            <FormListboxSelect
              aria-label="Country"
              value={ECONOMY_COUNTRY_OPTIONS.some((o) => o.value === country) ? country : "US"}
              onChange={(next) => {
                const qs = new URLSearchParams({
                  week: data.weekMondayYmd,
                  country: next,
                });
                router.push(`/economy?${qs.toString()}`);
              }}
              options={ECONOMY_COUNTRY_OPTIONS}
              truncateLabel={false}
              truncateOptions={false}
              className="max-w-[min(100%,220px)] shrink-0 sm:w-max sm:max-w-none"
              triggerClassName={dropdownTriggerClass}
            />
          </div>
        </div>
      </div>

      {view === "grid" ? (
        <div className="flex min-w-0 flex-col">
          <div className="relative hidden md:block">
            <EconomyWeekdayStrip days={filteredDays} highlightYmd={todayKey} />
          </div>

          <div className="-mx-1 overflow-x-auto pb-1 md:mx-0 md:overflow-visible">
            <div className="flex min-h-[min(60vh,716px)] min-w-0 md:grid md:grid-cols-5 md:gap-0">
              {filteredDays.map((day, i) => (
                <div
                  key={day.date}
                  className={cn(
                    "flex w-[min(100%,240px)] shrink-0 flex-col border-[#E4E4E7] px-2 py-3 md:w-auto md:border-r md:px-3 md:py-4",
                    i === filteredDays.length - 1 ? "md:border-r-0" : "",
                  )}
                >
                  <div className="mb-3 border-b border-[#E4E4E7] pb-2 md:hidden">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[#A1A1AA]">{day.weekdayLabel}</div>
                    <div
                      className={cn(
                        "text-[15px] font-semibold tabular-nums",
                        day.date === todayKey ? "text-[#DC2626]" : "text-[#09090B]",
                      )}
                    >
                      {day.dayNumber}
                    </div>
                  </div>
                  <div className="flex min-h-[120px] flex-col gap-2">
                    {day.events.length === 0 ? (
                      <div className="flex flex-1 flex-col items-center justify-center rounded-lg bg-white px-3 py-6 text-center">
                        <p className="text-sm leading-5 text-[#09090B]">No scheduled Reports</p>
                      </div>
                    ) : (
                      day.events.map((ev) => (
                        <EconomyEventCard key={ev.id} event={ev} offsetMinutes={offsetMinutes} />
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
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
                      aria-label="Impact, time, country, event, forecast, actual, prior"
                    >
                      {/* In-flow placeholders: `sr-only` is position:absolute and skips grid tracks, which broke alignment. */}
                      <div aria-hidden className="min-w-0" />
                      <div aria-hidden className="min-w-0" />
                      <div className="min-w-0 text-left">Country</div>
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
                      day.events.map((ev) => <EconomyListRow key={ev.id} event={ev} offsetMinutes={offsetMinutes} />)
                    )}
                  </section>
                ))}
              </div>
            </ScreenerTableScroll>
          )}
        </div>
      )}
    </div>
  );
}
