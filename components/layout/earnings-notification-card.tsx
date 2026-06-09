"use client";

import { CompanyLogo } from "@/components/screener/company-logo";
import {
  earningsMetricLinesFromPayload,
  formatNotificationTimestamp,
  formatPeriodLabelForDisplay,
  parseEarningsNotificationPayload,
  surpriseToneClass,
  type EarningsMetricLine,
} from "@/lib/notifications/earnings-notification-model";
import type { NotificationItem } from "@/lib/notifications/use-notifications-client";
import { readScreenerCompanyIdentity } from "@/lib/screener/screener-company-identity-storage";
import { cn } from "@/lib/utils";

/** Figma — Inter Medium 14px / 20px line-height, 0 tracking, #09090B. */
const notificationTickerTextClass =
  "font-sans text-[14px] font-medium leading-[20px] tracking-normal text-[#09090B]";

/** Figma — Inter Semi Bold 14px / 20px line-height, 0 tracking, #09090B. */
const notificationPeriodTextClass =
  "font-sans text-[14px] font-semibold leading-[20px] tracking-normal text-[#09090B]";

/** Figma — Inter Regular 14px / 20px line-height, 0 tracking, #71717A. */
const notificationMetaTextClass =
  "font-sans text-[14px] font-normal leading-[20px] tracking-normal text-[#71717A]";

function MetricRow({ line }: { line: EarningsMetricLine }) {
  return (
    <p className="flex flex-wrap items-baseline gap-0.5 font-sans text-[14px] leading-[20px]">
      <span className="font-normal text-[#09090B]">{line.label}:</span>
      <span className="font-normal text-[#71717A]">{line.actualDisplay}</span>
      {line.estimateDisplay != null ? (
        <>
          <span className="font-normal text-[#71717A]">vs</span>
          <span className="font-normal text-[#71717A]">
            {line.estimateDisplay} est
          </span>
        </>
      ) : null}
      {line.surpriseDisplay ? (
        <span className={cn("font-normal", surpriseToneClass(line.surprisePct))}>
          {line.surpriseDisplay}
        </span>
      ) : null}
    </p>
  );
}

export function EarningsNotificationCard({
  item,
  className,
}: {
  item: NotificationItem;
  unread?: boolean;
  className?: string;
}) {
  const payload = parseEarningsNotificationPayload(item.payload);
  const identity = readScreenerCompanyIdentity(item.ticker);
  const companyName = payload?.companyName ?? identity?.name ?? item.ticker;
  const logoUrl = payload?.logoUrl ?? identity?.logoUrl ?? "";
  const periodLabel = formatPeriodLabelForDisplay(
    payload?.fiscalPeriodLabel ?? item.body,
    payload?.fiscalPeriodEndYmd,
  );
  const metricLines = payload ? earningsMetricLinesFromPayload(payload) : [];

  const hasSummary = Boolean(periodLabel || metricLines.length > 0);

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-start gap-2 pr-7">
        <CompanyLogo name={companyName} logoUrl={logoUrl} symbol={item.ticker} size="40" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-1">
            <span
              className={cn(
                notificationTickerTextClass,
                "underline-offset-2 group-hover:underline",
              )}
            >
              {item.ticker}
            </span>
            <span className={notificationMetaTextClass}>reported earnings</span>
          </div>
          <p className={notificationMetaTextClass}>{formatNotificationTimestamp(item.createdAt)}</p>
        </div>
      </div>

      {hasSummary ? (
        <div className="mt-3 ml-12 flex w-[calc(100%-3rem)] flex-col gap-0.5 rounded-[12px] bg-[#F4F4F5] px-4 py-2">
          {periodLabel ? <p className={notificationPeriodTextClass}>{periodLabel}</p> : null}
          {metricLines.map((line) => (
            <MetricRow key={line.label} line={line} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
