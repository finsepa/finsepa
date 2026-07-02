"use client";

import { isPositivePriceChange } from "@/lib/chart/reconcile-price-change";
import { PostMarketEarningsIcon } from "@/components/stock/post-market-earnings-icon";
import { PreMarketEarningsIcon } from "@/components/stock/pre-market-earnings-icon";
import type { StockExtendedHoursHeader } from "@/lib/market/stock-extended-hours-header-types";
import { formatSignedPercent2dp, formatSignedUsdAmountGrouped2dp, formatUsdPrice } from "@/lib/market/key-stats-basic-format";

const EXTENDED_HOURS_TIMING_ICON_PX = 14;

type Props = {
  quote: StockExtendedHoursHeader | null;
  loading?: boolean;
};

const extendedHoursShellClass =
  "min-w-0 max-md:border-0 max-md:pl-0 sm:min-w-[9rem] sm:border-l sm:border-[#E4E4E7] sm:pl-6";

export function StockExtendedHoursPrice({ quote, loading = false }: Props) {
  if (!quote && !loading) return null;

  if (loading && !quote) {
    return (
      <div className={extendedHoursShellClass} aria-busy aria-label="Loading extended session price">
        <div className="space-y-1.5">
          <div className="flex items-baseline gap-2.5">
            <div className="h-7 w-[5.5rem] animate-pulse rounded-md bg-neutral-200/80" />
            <div className="h-5 w-[6.5rem] animate-pulse rounded-md bg-neutral-200/80" />
          </div>
          <div className="h-4 w-[8.5rem] animate-pulse rounded-md bg-neutral-200/80" />
        </div>
      </div>
    );
  }

  if (!quote) return null;

  const isPositive = isPositivePriceChange(quote.extendedChangeAbs, quote.extendedChangePct);
  const changeClass = isPositive ? "text-[#16A34A]" : "text-[#DC2626]";
  const changeText = `${formatSignedUsdAmountGrouped2dp(quote.extendedChangeAbs)} (${formatSignedPercent2dp(quote.extendedChangePct)})`;

  return (
    <div className={extendedHoursShellClass}>
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
        <span className="text-[22px] font-semibold leading-8 tabular-nums text-[#09090B] sm:text-[24px] sm:leading-8">
          {formatUsdPrice(quote.extendedPrice)}
        </span>
        <span className={`text-[15px] font-medium tabular-nums ${changeClass}`}>{changeText}</span>
      </div>
      <p className="mt-0.5 flex items-center gap-1.5 text-[13px] leading-5 text-[#71717A]">
        {quote.session === "pre" ? (
          <PreMarketEarningsIcon size={EXTENDED_HOURS_TIMING_ICON_PX} />
        ) : (
          <PostMarketEarningsIcon size={EXTENDED_HOURS_TIMING_ICON_PX} />
        )}
        <span>{quote.extendedTimestampLabel}</span>
      </p>
    </div>
  );
}
