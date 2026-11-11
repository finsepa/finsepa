"use client";

import { CompanyLogo } from "@/components/screener/company-logo";
import { formatNotificationTimestamp, resolveNotificationTicker } from "@/lib/notifications/earnings-notification-model";
import {
  MARKET_HIGH_LOW_KIND,
  formatUsdPrice,
  highLowLevelLabel,
  type HighLowLevel,
} from "@/lib/notifications/market-alerts-model";
import type { NotificationItem } from "@/lib/notifications/use-notifications-client";
import { readScreenerCompanyIdentity } from "@/lib/screener/screener-company-identity-storage";
import { cn } from "@/lib/utils";

const tickerTextClass = "font-sans text-[14px] font-medium leading-[20px] tracking-normal text-fg";
const metaTextClass = "font-sans text-[14px] font-normal leading-[20px] tracking-normal text-fg-muted";

const HIGH_LOW_LEVELS: readonly HighLowLevel[] = ["all_time_high", "52w_high", "all_time_low", "52w_low"];

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** ±5% / ±10% daily moves and new 52-week / all-time highs and lows. */
export function MarketAlertNotificationCard({ item, className }: { item: NotificationItem; className?: string }) {
  const payload = item.payload ?? {};
  const ticker = str(payload.symbol) ?? resolveNotificationTicker(item).replace(/^CRYPTO:/, "");
  const identity = payload.assetKind === "crypto" ? null : readScreenerCompanyIdentity(ticker);
  const companyName = str(payload.companyName) ?? identity?.name ?? ticker;
  const logoUrl = str(payload.logoUrl) ?? identity?.logoUrl ?? "";
  const price = num(payload.price);
  const changePct = num(payload.changePct);
  const levelRaw = str(payload.level);
  const level = HIGH_LOW_LEVELS.find((l) => l === levelRaw) ?? null;
  const isHighLow = item.kind === MARKET_HIGH_LOW_KIND && level != null;
  const up = isHighLow ? level.endsWith("high") : (changePct ?? 0) >= 0;
  const headline = isHighLow
    ? `hit a new ${highLowLevelLabel(level)}`
    : `is ${up ? "up" : "down"}${changePct != null ? ` ${Math.abs(changePct).toFixed(1)}%` : ""} today`;

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-start gap-2 pr-7">
        <CompanyLogo name={companyName} logoUrl={logoUrl} symbol={ticker} size="40" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-1">
            <span className={cn(tickerTextClass, "underline-offset-2 group-hover:underline")}>{ticker}</span>
            <span className={metaTextClass}>{headline}</span>
          </div>
          <p className={metaTextClass}>{formatNotificationTimestamp(item.createdAt)}</p>
        </div>
      </div>

      {price != null ? (
        <div className="mt-3 ml-12 flex w-[calc(100%-3rem)] flex-col gap-0.5 rounded-[12px] bg-surface-muted px-4 py-2">
          <p className="font-sans text-[14px] font-semibold leading-[20px] text-fg">{companyName}</p>
          <p className="flex flex-wrap items-baseline gap-1 font-sans text-[14px] leading-[20px]">
            <span className="text-fg">{formatUsdPrice(price)}</span>
            {changePct != null ? (
              <span className={changePct >= 0 ? "text-up" : "text-down"}>
                {changePct >= 0 ? "+" : "−"}
                {Math.abs(changePct).toFixed(2)}%
              </span>
            ) : null}
          </p>
        </div>
      ) : null}
    </div>
  );
}
