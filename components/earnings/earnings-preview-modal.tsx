"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ScreenerRankBadge } from "@/components/earnings/screener-rank-badge";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { AppModalCloseButton, AppModalShell } from "@/components/ui/app-modal-shell";
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
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [item, onKeyDown]);

  useEffect(() => {
    if (!item) setBodyScrollEl(null);
  }, [item]);

  if (!item) return null;

  const stockEarningsHref = `/stock/${encodeURIComponent(item.ticker.trim())}?tab=earnings`;

  return (
    <AppModalOverlay open={item != null} onClose={onClose} zIndex={300}>
      <AppModalShell
        titleId="earnings-preview-title"
        maxWidthClass="w-full max-w-[min(960px,calc(100vw-2rem))]"
        maxHeightClass="max-h-[min(90vh,880px)]"
        header={
          <div className="flex w-full items-center gap-3">
            <Link
              href={stockEarningsHref}
              onClick={() => onClose()}
              className="group flex min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-[10px] outline-none ring-offset-2 transition-colors hover:bg-[#F4F4F5] focus-visible:ring-2 focus-visible:ring-[#09090B]/15"
              id="earnings-preview-title"
              title={`Open ${item.ticker.trim()} — Earnings`}
            >
              <CompanyLogo name={item.companyName || item.ticker} logoUrl={item.logoUrl} symbol={item.ticker} size="lg" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="shrink-0 text-[18px] font-semibold leading-7 text-[#09090B] underline-offset-2 decoration-[#09090B] group-hover:underline">
                    {item.ticker}
                  </span>
                  {item.screenerRank != null ? <ScreenerRankBadge rank={item.screenerRank} /> : null}
                </span>
                <span className="min-w-0 truncate text-[14px] leading-5 text-[#71717A] underline-offset-2 decoration-[#71717A] group-hover:underline">
                  {item.companyName}
                </span>
              </span>
            </Link>
            <AppModalCloseButton onClick={onClose} />
          </div>
        }
        headerClassName="px-5 py-4"
        bodyClassName="min-h-0 min-w-0 px-5 pb-5 pt-2"
        cardClassName="overflow-hidden shadow-none"
      >
        <div ref={setBodyScrollEl} className="min-h-0 min-w-0">
          <StockEarningsTabContent ticker={item.ticker} scrollRoot={bodyScrollEl} previewMode />
        </div>
      </AppModalShell>
    </AppModalOverlay>
  );
}
