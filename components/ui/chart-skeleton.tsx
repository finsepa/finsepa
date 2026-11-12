"use client";

import { resolveFsColor } from "@/lib/theme/resolve-fs-color";
import { useId } from "react";

import { cn } from "@/lib/utils";


type ChartSkeletonProps = {
  className?: string;
  /** Total block height in px (ignored when `fill` is true). */
  heightPx?: number;
  /** Fill parent height; parent must define a height (e.g. absolute chart pane). */
  fill?: boolean;
  /**
   * `detailed` — grid, axis tick pills, blue area preview (Overview-style), no outer chrome.
   * `minimal` — muted sparkline only (no gridlines, baseline or axis pills).
   */
  variant?: "detailed" | "minimal";
};

const SPARK_VIEW_W = 400;
const SPARK_VIEW_H = 120;

/** Deterministic jagged walk so SSR and client paint the same placeholder line. */
const SPARK_POINTS: readonly (readonly [number, number])[] = (() => {
  let seed = 11;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const n = 132;
  const pts: [number, number][] = [];
  let walk = 0;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    walk = walk * 0.86 + (rand() - 0.5) * 7;
    const y = 50 + 22 * t - 10 * Math.sin(t * Math.PI * 1.3) + 7 * Math.sin(t * Math.PI * 6.2) + walk;
    pts.push([t * SPARK_VIEW_W, Math.min(108, Math.max(14, y))]);
  }
  return pts;
})();

const SPARK_LINE_PATH = SPARK_POINTS.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
const SPARK_AREA_PATH = `${SPARK_LINE_PATH} L${SPARK_VIEW_W},${SPARK_VIEW_H} L0,${SPARK_VIEW_H} Z`;

function SparklineChartSkeleton({
  className,
  heightPx,
  fill,
  areaGradId,
}: {
  className?: string;
  heightPx: number;
  fill?: boolean;
  areaGradId: string;
}) {
  return (
    <div
      className={cn(
        "chart-skeleton-shimmer relative flex w-full min-w-0 overflow-hidden bg-transparent",
        fill && "h-full min-h-0",
        className,
      )}
      style={fill ? undefined : { height: heightPx }}
      aria-hidden
      role="presentation"
    >
      <div className="relative min-w-0 flex-1">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 ${SPARK_VIEW_W} ${SPARK_VIEW_H}`}
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <linearGradient id={areaGradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: "var(--fs-fg)", stopOpacity: 0.07 }} />
              <stop offset="100%" style={{ stopColor: "var(--fs-fg)", stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          <path d={SPARK_AREA_PATH} fill={`url(#${areaGradId})`} />
          <path
            d={SPARK_LINE_PATH}
            fill="none"
            style={{ stroke: "color-mix(in srgb, var(--fs-fg) 16%, transparent)" }}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
    </div>
  );
}

/**
 * Asset / stock {@link PriceChart} loading chrome — muted sparkline placeholder.
 */
export function AssetChartSkeleton({
  className,
  heightPx = 320,
  fill,
}: {
  className?: string;
  heightPx?: number;
  fill?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative w-full min-w-0 overflow-hidden px-1 py-1",
        fill && "h-full min-h-0",
        className,
      )}
      style={fill ? undefined : { height: heightPx }}
      aria-hidden
      role="presentation"
    >
      <ChartSkeleton fill variant="minimal" />
    </div>
  );
}

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
  const sparkAreaId = `chartSkeletonSpark-${useId().replace(/:/g, "")}`;

  if (variant === "minimal") {
    return (
      <SparklineChartSkeleton
        className={className}
        heightPx={heightPx}
        fill={fill}
        areaGradId={sparkAreaId}
      />
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
                <div key={i} className="h-px w-full bg-surface-muted" />
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
                  <stop offset="0%" stopColor={resolveFsColor("--fs-accent")} stopOpacity="0.2" />
                  <stop offset="100%" stopColor={resolveFsColor("--fs-accent")} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M 0,78 C 55,72 95,58 140,52 C 185,46 230,28 280,22 C 320,17 360,18 400,12 L 400,108 L 0,108 Z"
                fill={`url(#${gradId})`}
              />
              <path
                d="M 0,78 C 55,72 95,58 140,52 C 185,46 230,28 280,22 C 320,17 360,18 400,12"
                fill="none"
                stroke={resolveFsColor("--fs-accent")}
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
