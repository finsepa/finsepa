"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X } from "lucide-react";

import { ScreenerRankBadge } from "@/components/earnings/screener-rank-badge";
import { CompanyLogo } from "@/components/screener/company-logo";
import { StockEarningsTabContent } from "@/components/stock/stock-earnings-tab";
import type { EarningsCalendarItem } from "@/lib/market/earnings-calendar-types";

export function EarningsPreviewModal({
  item,
  onClose,
}: {
  item: EarningsCalendarItem | null;
  onClose: () => void;
}) {
  const [bodyScrollEl, setBodyScrollEl] = useState<HTMLDivElement | null>(null);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!item) return;
    document.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [item, onKeyDown]);

  useEffect(() => {
    if (!item) setBodyScrollEl(null);
  }, [item]);

  if (!item) return null;

  const stockEarningsHref = `/stock/${encodeURIComponent(item.ticker.trim())}?tab=earnings`;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="earnings-preview-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close preview"
        onClick={onClose}
      />
      <div
        className="relative z-10 flex max-h-[min(90vh,880px)] w-full max-w-[min(960px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-[#E4E4E7] bg-white shadow-[0px_10px_16px_-3px_rgba(10,10,10,0.1),0px_4px_6px_0px_rgba(10,10,10,0.04)]"
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-[#E4E4E7] px-5 py-4">
          <Link
            href={stockEarningsHref}
            onClick={() => onClose()}
            className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-[10px] outline-none ring-offset-2 transition-colors hover:bg-[#F4F4F5] focus-visible:ring-2 focus-visible:ring-[#09090B]/15"
            id="earnings-preview-title"
            title={`Open ${item.ticker.trim()} — Earnings`}
          >
            <CompanyLogo name={item.companyName || item.ticker} logoUrl={item.logoUrl} symbol={item.ticker} size="lg" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="shrink-0 text-[18px] font-semibold leading-7 text-[#09090B]">{item.ticker}</span>
                {item.screenerRank != null ? <ScreenerRankBadge rank={item.screenerRank} /> : null}
              </span>
              <span className="min-w-0 truncate text-[14px] leading-5 text-[#71717A]">{item.companyName}</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[#71717A] transition-colors hover:bg-[#F4F4F5] hover:text-[#09090B]"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div
          ref={setBodyScrollEl}
          className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-5 pb-5 pt-2"
        >
          <StockEarningsTabContent ticker={item.ticker} scrollRoot={bodyScrollEl} showHeading={false} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
