"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { EarningsPreviewModal } from "@/components/earnings/earnings-preview-modal";
import { CompanyLogo } from "@/components/screener/company-logo";
import type {
  EarningsCalendarItem,
  EarningsDayColumn,
  EarningsWeekPayload,
} from "@/lib/market/earnings-calendar-types";

function todayYmdUtc(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Monday `YYYY-MM-DD` (UTC) for the week containing today — matches `mondayOfWeekUtc` + `toYmdUtc` on the server. */
function currentWeekMondayYmdUtc(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
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
      className="w-full rounded-xl border border-[#E4E4E7] bg-white px-3 py-2.5 text-left shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-colors hover:bg-[#FAFAFA]"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <CompanyLogo name={companyName || ticker} logoUrl={logoUrl} symbol={ticker} size="sm" />
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="shrink-0 text-[13px] font-semibold leading-5 tabular-nums text-[#09090B]">
            {ticker}
          </span>
          <span className="min-w-0 truncate text-[12px] leading-4 text-[#52525B]">{companyName}</span>
        </div>
      </div>
    </button>
  );
}

const navBtnClass =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[#09090B] transition-colors hover:bg-[#F4F4F5]";

/** Matches `topbarSquircleIconClass` in `topbar.tsx` — bordered squircle, same shadow/hover. */
const todayBtnClass =
  "inline-flex h-9 shrink-0 items-center justify-center rounded-[10px] border border-[#E4E4E7] bg-white px-3 text-[14px] font-medium leading-5 text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-all duration-100 hover:bg-[#F4F4F5]";

/**
 * Weekly earnings calendar — layout aligned with Figma (Web App Design, Earnings Calendar week view).
 * Weeks with no events still show the five-column grid; empty days display “No reports”.
 */
export function EarningsWeekGrid({
  data,
  prevWeekYmd,
  nextWeekYmd,
}: {
  data: EarningsWeekPayload;
  prevWeekYmd: string;
  nextWeekYmd: string;
}) {
  const [previewItem, setPreviewItem] = useState<EarningsCalendarItem | null>(null);
  const todayKey = useMemo(() => todayYmdUtc(), []);
  const thisWeekMondayYmd = useMemo(() => currentWeekMondayYmdUtc(), []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <p className="text-[16px] font-normal leading-6 text-[#71717A]">Earnings Calendar</p>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="text-[24px] font-semibold leading-9 tracking-tight text-[#09090B]">{data.weekLabel}</h1>
            <div className="flex shrink-0 items-center gap-1">
              <Link
                href={`/earnings?week=${encodeURIComponent(prevWeekYmd)}`}
                prefetch={false}
                className={navBtnClass}
                aria-label="Previous week"
              >
                <ChevronLeft className="h-5 w-5" strokeWidth={1.75} />
              </Link>
              <Link
                href={`/earnings?week=${encodeURIComponent(nextWeekYmd)}`}
                prefetch={false}
                className={navBtnClass}
                aria-label="Next week"
              >
                <ChevronRight className="h-5 w-5" strokeWidth={1.75} />
              </Link>
            </div>
          </div>
          <Link
            href={`/earnings?week=${encodeURIComponent(thisWeekMondayYmd)}`}
            prefetch={false}
            className={todayBtnClass}
            aria-label="Go to this week"
            aria-current={data.weekMondayYmd === thisWeekMondayYmd ? "page" : undefined}
          >
            Today
          </Link>
        </div>
      </div>

      <div className="flex min-w-0 flex-col">
        {/* Desktop: weekday strip + today indicator — matches Figma */}
        <div className="relative hidden border-b border-t border-[#E4E4E7] pt-2 pb-0 md:block">
          <div className="flex w-full gap-6 text-center text-[18px] leading-7">
            {data.days.map((day: EarningsDayColumn) => {
              const isToday = day.date === todayKey;
              return (
                <div
                  key={day.date}
                  className={`flex min-h-px min-w-0 flex-1 flex-wrap items-center justify-center gap-1 py-1 ${
                    isToday ? "text-[#DC2626]" : "text-[#09090B]"
                  }`}
                >
                  <span className="font-normal">{day.weekdayLabel}</span>
                  <span className="font-semibold tabular-nums">{day.dayNumber}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex w-full gap-6" aria-hidden>
            {data.days.map((day: EarningsDayColumn) => {
              const isToday = day.date === todayKey;
              return (
                <div key={`u-${day.date}`} className="min-h-px min-w-0 flex-1">
                  <div className={`h-0.5 w-full ${isToday ? "bg-[#DC2626]" : "bg-transparent"}`} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="-mx-1 overflow-x-auto pb-1 md:mx-0 md:overflow-visible">
          <div className="flex min-h-[min(60vh,716px)] min-w-0 md:grid md:grid-cols-5 md:gap-0">
            {data.days.map((day: EarningsDayColumn, i: number) => (
              <div
                key={day.date}
                className={`flex w-[min(100%,220px)] shrink-0 flex-col border-[#E4E4E7] px-2 py-3 md:w-auto md:border-r md:px-3 md:py-4 ${
                  i === data.days.length - 1 ? "md:border-r-0" : ""
                }`}
              >
                <div className="mb-3 border-b border-[#E4E4E7] pb-2 md:hidden">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[#A1A1AA]">
                    {day.weekdayLabel}
                  </div>
                  <div
                    className={`text-[15px] font-semibold tabular-nums ${
                      day.date === todayKey ? "text-[#DC2626]" : "text-[#09090B]"
                    }`}
                  >
                    {day.dayNumber}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {day.items.length === 0 ? (
                    <p className="text-[12px] leading-4 text-[#A1A1AA]">No reports</p>
                  ) : (
                    day.items.map((item) => (
                      <EarningsCard
                        key={`${item.ticker}-${item.reportDate}`}
                        ticker={item.ticker}
                        companyName={item.companyName}
                        logoUrl={item.logoUrl}
                        onOpen={() => setPreviewItem(item)}
                      />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <EarningsPreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />
    </div>
  );
}
