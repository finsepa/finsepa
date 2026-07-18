"use client";

import { Briefcase } from "@/lib/icons";
import { CHART_SCREENSHOT_ASSET_HEADER_HEIGHT_PX } from "@/lib/chart/chart-screenshot-constants";

type ChartScreenshotPortfolioHeaderProps = {
  portfolioName: string;
  logoUrl?: string | null;
  /** Tighter header when nested inside the allocation card. */
  compact?: boolean;
};

export function ChartScreenshotPortfolioHeader({
  portfolioName,
  logoUrl,
  compact = false,
}: ChartScreenshotPortfolioHeaderProps) {
  const title = portfolioName.trim() || "Portfolio";
  const resolvedLogo = logoUrl?.trim() || "";

  return (
    <div
      className="flex w-full min-w-0 shrink-0 items-center justify-center gap-3"
      style={
        compact
          ? undefined
          : {
              height: CHART_SCREENSHOT_ASSET_HEADER_HEIGHT_PX,
            }
      }
    >
      <div
        className={
          compact
            ? "flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-[#E4E4E7] bg-[#F4F4F5]"
            : "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-[#E4E4E7] bg-[#F4F4F5]"
        }
      >
        {resolvedLogo ? (
          // eslint-disable-next-line @next/next/no-img-element -- brokerage logo URL
          <img src={resolvedLogo} alt="" className="h-full w-full object-contain p-1" />
        ) : (
          <Briefcase
            className={compact ? "h-4 w-4 text-[#71717A]" : "h-5 w-5 text-[#71717A]"}
            strokeWidth={2}
            aria-hidden
          />
        )}
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={
            compact
              ? "truncate text-[16px] font-semibold leading-5 text-[#0F0F0F]"
              : "truncate text-[18px] font-semibold leading-6 text-[#0F0F0F]"
          }
        >
          {title}
        </span>
        <span
          className={
            compact
              ? "shrink-0 text-[16px] font-normal leading-5 text-[#71717A]"
              : "shrink-0 text-[18px] font-normal leading-6 text-[#71717A]"
          }
          aria-hidden
        >
          ·
        </span>
        <span
          className={
            compact
              ? "shrink-0 text-[16px] font-semibold leading-5 text-[#71717A]"
              : "shrink-0 text-[18px] font-semibold leading-6 text-[#71717A]"
          }
        >
          Allocation
        </span>
      </div>
    </div>
  );
}
