"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { usSessionWallClockUnix } from "@/lib/market/chart-timestamp-format";
import { getUsEquityMarketSession, type UsEquityMarketSession } from "@/lib/market/us-equity-market-session";
import { cn } from "@/lib/utils";

const NY_TZ = "America/New_York";
const OPEN_DELAY_MS = 120;
const CLOSE_DELAY_MS = 100;

type SegmentId = "closed" | "pre" | "regular" | "post";

/** One trading day drawn from 8:00 PM ET (after-hours end) so the bar reads closed → pre → regular → after-hours. */
const SEGMENTS: readonly {
  id: SegmentId;
  label: string;
  start: [number, number];
  end: [number, number];
  minutes: number;
  dotClass: string;
}[] = [
  { id: "closed", label: "Closed", start: [20, 0], end: [4, 0], minutes: 8 * 60, dotClass: "bg-fg-muted" },
  {
    id: "pre",
    label: "Pre-market",
    start: [4, 0],
    end: [9, 30],
    minutes: 5.5 * 60,
    dotClass: "bg-[#EA580C] dark:bg-[var(--fs-orange)]",
  },
  { id: "regular", label: "Regular", start: [9, 30], end: [16, 0], minutes: 6.5 * 60, dotClass: "bg-up" },
  {
    id: "post",
    label: "After-hours",
    start: [16, 0],
    end: [20, 0],
    minutes: 4 * 60,
    dotClass: "bg-[#EA580C] dark:bg-[var(--fs-orange)]",
  },
];

const DAY_MINUTES = 24 * 60;
const BAR_ORIGIN_MIN = 20 * 60;

function nyParts(now: Date): { ymd: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: NY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "00";
  return { ymd: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

/** ET wall-clock time on today's New York date, shown in the viewer's own time zone. */
function formatEtWallClockLocal(ymd: string, [h, m]: [number, number], withZone: boolean): string {
  const sec = usSessionWallClockUnix(ymd, h, m, NY_TZ);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    ...(withZone ? { timeZoneName: "shortOffset" } : {}),
  }).format(new Date(sec * 1000));
}

function activeSegment(session: UsEquityMarketSession): SegmentId {
  return session === "pre" || session === "regular" || session === "post" ? session : "closed";
}

function TradingHoursCard({ now }: { now: Date }) {
  const { ymd, minutes } = nyParts(now);
  const active = activeSegment(getUsEquityMarketSession(now));
  const markerPct = (((minutes - BAR_ORIGIN_MIN + DAY_MINUTES) % DAY_MINUTES) / DAY_MINUTES) * 100;

  return (
    <div className="w-[min(calc(100vw-2rem),340px)] p-4">
      <p className="text-[15px] font-semibold leading-5 text-fg">Trading hours</p>
      <ul className="mt-3 space-y-1.5">
        {SEGMENTS.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-4 text-[13px] leading-5">
            <span className={cn("flex items-center gap-2", s.id === active ? "font-medium text-fg" : "text-fg-muted")}>
              <span className={cn("size-2 shrink-0 rounded-full", s.dotClass)} aria-hidden />
              {s.label}
            </span>
            <span className={cn("tabular-nums", s.id === active ? "font-medium text-fg" : "text-fg-muted")}>
              {formatEtWallClockLocal(ymd, s.start, false)} – {formatEtWallClockLocal(ymd, s.end, true)}
            </span>
          </li>
        ))}
      </ul>
      <div className="relative mt-4 flex h-1.5 w-full gap-px overflow-visible" aria-hidden>
        {SEGMENTS.map((s, i) => (
          <span
            key={s.id}
            className={cn(
              "h-full",
              s.dotClass,
              i === 0 && "rounded-l-full",
              i === SEGMENTS.length - 1 && "rounded-r-full",
              s.id !== active && "opacity-50",
            )}
            style={{ width: `${(s.minutes / DAY_MINUTES) * 100}%` }}
          />
        ))}
        <span
          className="absolute top-1/2 h-3.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg ring-2 ring-[var(--fs-panel)]"
          style={{ left: `${markerPct}%` }}
        />
      </div>
      <p className="mt-3 text-[12px] leading-4 text-fg-muted">Monday – Friday, except US market holidays</p>
    </div>
  );
}

/** Session badge copy (`State · Next phase in …`) with a dashed underline on the state — signals the trading-hours hover. */
export function SessionLabelWithHoverHint({ label }: { label: string }) {
  const sep = label.indexOf(" · ");
  const state = sep === -1 ? label : label.slice(0, sep);
  const rest = sep === -1 ? "" : label.slice(sep);
  return (
    <span suppressHydrationWarning>
      <span className="underline decoration-current/50 decoration-dashed decoration-1 underline-offset-[3px]">{state}</span>
      {rest}
    </span>
  );
}

/** Hover (or tap) the US market session status to see pre / regular / after-hours times in the viewer's time zone. */
export function UsEquityTradingHoursHover({ children, className }: { children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedule = useCallback((next: boolean, delay: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (next) setNow(new Date());
      setOpen(next);
    }, delay);
  }, []);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <button
          type="button"
          className={cn("cursor-default rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-fg/20", className)}
          onPointerEnter={(e) => {
            if (e.pointerType === "mouse") schedule(true, OPEN_DELAY_MS);
          }}
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") schedule(false, CLOSE_DELAY_MS);
          }}
          onClick={() => {
            setNow(new Date());
            setOpen((v) => !v);
          }}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          {children}
        </button>
      </PopoverAnchor>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-auto p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerEnter={() => schedule(true, 0)}
        onPointerLeave={() => schedule(false, CLOSE_DELAY_MS)}
      >
        <TradingHoursCard now={now} />
      </PopoverContent>
    </Popover>
  );
}
