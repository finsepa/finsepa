"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";

const VALUE_BLUE = "#2563EB";

type ChartSkeletonProps = {
  className?: string;
  /** Total block height in px (ignored when `fill` is true). */
  heightPx?: number;
  /** Fill parent height; parent must define a height (e.g. absolute chart pane). */
  fill?: boolean;
  /**
   * `detailed` — grid, axis tick pills, blue area preview (Overview-style), no outer chrome.
   * `minimal` — single soft gray area shape only (no grid/axes), for compact toolbars.
   */
  variant?: "detailed" | "minimal";
};

/**
 * Loading placeholder for time-series charts. Default: no border, shadow, or panel — sits flush on the page.
 */
export function ChartSkeleton({
  className,
  heightPx = 320,
  fill,
  variant = "detailed",
}: ChartSkeletonProps) {
  const gradId = `chartSkeletonArea-${useId().replace(/:/g, "")}`;
  const blobId = `chartSkeletonBlob-${useId().replace(/:/g, "")}`;

  if (variant === "minimal") {
    return (
      <div
        className={cn(
          "chart-skeleton-shimmer relative w-full min-w-0 overflow-hidden bg-transparent",
          fill && "h-full min-h-0",
          className,
        )}
        style={fill ? undefined : { height: heightPx }}
        aria-hidden
        role="presentation"
      >
        <svg
          className="h-full w-full"
          viewBox="0 0 400 120"
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <linearGradient id={blobId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E4E4E7" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#F4F4F5" stopOpacity="0.9" />
            </linearGradient>
          </defs>
          <path
            fill={`url(#${blobId})`}
            d="M0,120 L0,88 L32,92 L58,76 L88,82 L118,64 L152,71 L188,52 L222,58 L258,42 L292,48 L328,34 L362,38 L400,28 L400,120 Z"
          />
        </svg>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col overflow-hidden bg-transparent",
        fill && "h-full min-h-0",
        className,
      )}
      style={fill ? undefined : { height: heightPx }}
      aria-hidden
      role="presentation"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-2 pb-1 pt-1">
        <div className="flex min-h-0 flex-1 gap-3">
          <div className="flex w-8 shrink-0 flex-col justify-between py-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-2 w-6 max-w-full rounded-sm" />
            ))}
          </div>
          <div className="chart-skeleton-shimmer relative min-h-0 flex-1 overflow-hidden bg-transparent">
            <div className="pointer-events-none absolute inset-x-0 bottom-5 top-0 flex flex-col justify-between py-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-px w-full bg-[#F4F4F5]" />
              ))}
            </div>
            <svg
              className="absolute bottom-5 left-0 right-0 top-1 h-[calc(100%-1.25rem)] w-full"
              viewBox="0 0 400 108"
              preserveAspectRatio="none"
              aria-hidden
            >
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={VALUE_BLUE} stopOpacity="0.2" />
                  <stop offset="100%" stopColor={VALUE_BLUE} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M 0,78 C 55,72 95,58 140,52 C 185,46 230,28 280,22 C 320,17 360,18 400,12 L 400,108 L 0,108 Z"
                fill={`url(#${gradId})`}
              />
              <path
                d="M 0,78 C 55,72 95,58 140,52 C 185,46 230,28 280,22 C 320,17 360,18 400,12"
                fill="none"
                stroke={VALUE_BLUE}
                strokeOpacity="0.35"
                strokeWidth="2"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
        </div>
        <div className="flex shrink-0 justify-between gap-1 pl-11 pr-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-2 w-9 max-[480px]:w-7 rounded-sm" />
          ))}
        </div>
      </div>
    </div>
  );
}
