"use client";

import { CompanyLogo } from "@/components/screener/company-logo";
import { formatNotificationTimestamp } from "@/lib/notifications/earnings-notification-model";
import {
  formatSuperinvestorActivitySummary,
  formatSuperinvestorQuarterLabel,
  parseSuperinvestorActivityPayload,
} from "@/lib/notifications/superinvestor-activity-model";
import type { NotificationItem } from "@/lib/notifications/use-notifications-client";
import { cn } from "@/lib/utils";

const notificationNameTextClass =
  "font-sans text-[14px] font-medium leading-[20px] tracking-normal text-fg";

const notificationPeriodTextClass =
  "font-sans text-[14px] font-semibold leading-[20px] tracking-normal text-fg";

const notificationMetaTextClass =
  "font-sans text-[14px] font-normal leading-[20px] tracking-normal text-fg-muted";

export function SuperinvestorActivityNotificationCard({
  item,
  className,
}: {
  item: NotificationItem;
  className?: string;
}) {
  const payload = parseSuperinvestorActivityPayload(item.payload);
  const managerName = payload?.managerName ?? item.title;
  const avatarSrc = payload?.avatarSrc ?? payload?.logoUrl ?? "";
  const quarterLabel = formatSuperinvestorQuarterLabel(
    payload?.quarterLabel || item.body.split("\n")[0] || "",
  );
  const summary = formatSuperinvestorActivitySummary(payload?.activityCount ?? 0);
  const hasSummary = Boolean(quarterLabel || summary);

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-start gap-2 pr-7">
        <CompanyLogo name={managerName} logoUrl={avatarSrc} symbol={managerName} size="40" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-1">
            <span
              className={cn(
                notificationNameTextClass,
                "underline-offset-2 group-hover:underline",
              )}
            >
              {managerName}
            </span>
          </div>
          <p className={notificationMetaTextClass}>{formatNotificationTimestamp(item.createdAt)}</p>
        </div>
      </div>

      {hasSummary ? (
        <div className="mt-3 ml-12 flex w-[calc(100%-3rem)] flex-col gap-0.5 rounded-[12px] bg-surface-muted px-4 py-2">
          {quarterLabel ? <p className={notificationPeriodTextClass}>{quarterLabel}</p> : null}
          <p className={notificationMetaTextClass}>{summary}</p>
        </div>
      ) : null}
    </div>
  );
}
