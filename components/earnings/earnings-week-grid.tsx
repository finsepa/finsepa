"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { EarningsPreviewModal } from "@/components/earnings/earnings-preview-modal";
import { CompanyLogo } from "@/components/screener/company-logo";
import type {
  EarningsCalendarItem,
  EarningsDayColumn,
  EarningsWeekPayload,
} from "@/lib/market/earnings-calendar-types";

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
  const displayName = companyName.length > 48 ? `${companyName.slice(0, 46)}…` : companyName;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-xl border border-[#E4E4E7] bg-[#FAFAFA]/80 px-3 py-2.5 text-left transition-colors hover:bg-[#F4F4F5]"
    >
      <div className="flex items-start gap-2.5">
        <CompanyLogo name={companyName || ticker} logoUrl={logoUrl} symbol={ticker} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold leading-5 tabular-nums text-[#09090B]">{ticker}</span>
          </div>
          <p className="mt-0.5 line-clamp-2 text-[12px] leading-4 text-[#52525B]">{displayName}</p>
        </div>
      </div>
    </button>
  );
}

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

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold leading-8 tracking-tight text-[#09090B]">Earnings Calendar</h1>
          <p className="mt-1 text-[14px] leading-5 text-[#71717A]">{data.weekLabel}</p>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={`/earnings?week=${encodeURIComponent(prevWeekYmd)}`}
            prefetch={false}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E4E4E7] bg-white text-[#09090B] transition-colors hover:bg-[#F4F4F5]"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <Link
            href={`/earnings?week=${encodeURIComponent(nextWeekYmd)}`}
            prefetch={false}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E4E4E7] bg-white text-[#09090B] transition-colors hover:bg-[#F4F4F5]"
            aria-label="Next week"
          >
            <ChevronRight className="h-5 w-5" />
          </Link>
        </div>
      </div>

      {!data.hasAnyEvents ? (
        <div className="rounded-xl border border-dashed border-[#E4E4E7] bg-[#FAFAFA] px-6 py-16 text-center">
          <p className="text-[14px] leading-5 text-[#71717A]">No earnings events found for this week.</p>
        </div>
      ) : (
        <div className="-mx-1 overflow-x-auto pb-1 md:mx-0 md:overflow-visible">
          <div className="flex min-w-0 gap-3 md:grid md:grid-cols-5 md:gap-4">
            {data.days.map((day: EarningsDayColumn, i: number) => (
              <div
                key={day.date}
                className={`flex w-[min(100%,220px)] shrink-0 flex-col md:w-auto md:shrink ${
                  i > 0 ? "md:border-l md:border-[#E4E4E7] md:pl-4" : ""
                }`}
              >
                <div className="mb-3 border-b border-[#E4E4E7] pb-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[#A1A1AA]">
                    {day.weekdayLabel}
                  </div>
                  <div className="text-[15px] font-semibold tabular-nums text-[#09090B]">{day.dayNumber}</div>
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
      )}

      <EarningsPreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />
    </div>
  );
}
