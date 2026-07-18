"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";

import { CompanyLogo } from "@/components/screener/company-logo";
import {
  TOP_ALLOCATION_SLICES,
  type AllocationDonutRow,
} from "@/lib/portfolio/allocation-donut-rows";
import { cn } from "@/lib/utils";

const pct1 = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const VB = 100;
const CX = 50;
const CY = 50;
/** Donut ring thickness (viewBox units). */
const RING_THICKNESS_VB = 8.5;
/** Matches `UserAvatar` / `SuperinvestorProfileAvatar` donut center (60px + 1px white ring). */
const DONUT_CENTER_AVATAR_PX = 60;
const DONUT_CENTER_RING_PX = 1;
/** Visible gap between avatar edge and the inner edge of the colored ring (screen px). */
const DONUT_INNER_WHITESPACE_PX = 28;
/** Angular gap between adjacent slices (radians, each side gets half). */
const SLICE_GAP_RAD = 0.014;
/** Label anchor offset beyond outer ring (viewBox units). */
const LABEL_RADIUS_OFFSET_VB = 8.5;
/** Hide external pill when the slice is too narrow to read cleanly. */
const MIN_LABEL_WEIGHT_PCT = 2.5;
const BADGE_DIM_OPACITY = 0.3;
/** Canvas padding so expanded hover badges are not clipped at the chart edge. */
const BADGE_OVERFLOW_PAD_PX = 36;

export type AllocationDonutChartProps = {
  rows: AllocationDonutRow[];
  center?: ReactNode;
  className?: string;
  /** Rendered chart edge length — drives inner hole so center avatar leaves a 1px white gap. */
  chartSizePx?: number;
  /** Space reserved around the plot for external slice labels (defaults to 36px). */
  badgeOverflowPadPx?: number;
  /** Inner hole radius (screen px). Defaults to the avatar-center sizing. */
  centerHoleRadiusPx?: number;
  /** External slice label pills (defaults to true). */
  showExternalLabels?: boolean;
};

type DonutGeometry = { rOut: number; rIn: number; strokeWidth: number };

type SliceGeom = {
  row: AllocationDonutRow;
  i: number;
  a0: number;
  a1: number;
  midA: number;
  showLabel: boolean;
};

/** Snap coords/angles so path math stays stable across environments. */
function snapSvg(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function resolveDonutGeometry(chartSizePx: number, centerHoleRadiusPx?: number): DonutGeometry {
  const innerEdgeRadiusPx =
    centerHoleRadiusPx ??
    DONUT_CENTER_AVATAR_PX / 2 + DONUT_CENTER_RING_PX + DONUT_INNER_WHITESPACE_PX;
  const rIn = snapSvg((innerEdgeRadiusPx * 100) / chartSizePx);
  const strokeWidth = RING_THICKNESS_VB;
  const rOut = snapSvg(rIn + strokeWidth);
  return { rOut, rIn, strokeWidth };
}

function polar(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: snapSvg(cx + r * Math.cos(angleRad)),
    y: snapSvg(cy + r * Math.sin(angleRad)),
  };
}

function computeSliceGapRad(rows: AllocationDonutRow[]): number {
  if (rows.length <= 1) return 0;
  const minWeight = Math.min(...rows.map((r) => r.weightPct));
  const minSpan = (minWeight / 100) * 2 * Math.PI;
  return Math.min(SLICE_GAP_RAD, minSpan * 0.1);
}

function donutSlicePath(cx: number, cy: number, rOuter: number, rInner: number, a0: number, a1: number) {
  const ro = snapSvg(rOuter);
  const ri = snapSvg(rInner);
  const p0o = polar(cx, cy, ro, a0);
  const p1o = polar(cx, cy, ro, a1);
  const p1i = polar(cx, cy, ri, a1);
  const p0i = polar(cx, cy, ri, a0);
  const sweep = a1 - a0;
  const largeArc = sweep > Math.PI ? 1 : 0;
  return [
    `M ${p0o.x} ${p0o.y}`,
    `A ${ro} ${ro} 0 ${largeArc} 1 ${p1o.x} ${p1o.y}`,
    `L ${p1i.x} ${p1i.y}`,
    `A ${ri} ${ri} 0 ${largeArc} 0 ${p0i.x} ${p0i.y}`,
    "Z",
  ].join(" ");
}

function formatBadgeTicker(symbol: string): string {
  const s = symbol.trim();
  if (!s || s.toLowerCase() === "other") return "Other";
  return s.length > 14 ? `${s.slice(0, 13)}…` : s;
}

function SliceExternalLabel({
  row,
  midA,
  labelRadiusVb,
  isHovered,
  isDimmed,
}: {
  row: AllocationDonutRow;
  midA: number;
  labelRadiusVb: number;
  isHovered: boolean;
  isDimmed: boolean;
}) {
  const { x, y } = polar(CX, CY, labelRadiusVb, midA);
  const leftPct = snapSvg((x / VB) * 100);
  const topPct = snapSvg((y / VB) * 100);
  const ticker = formatBadgeTicker(row.symbol);
  const BadgeIcon = row.badgeIcon ?? null;

  return (
    <div
      className={cn(
        "pointer-events-none absolute transition-[opacity,transform] duration-200 ease-out",
        isHovered ? "z-30" : "z-20",
      )}
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        opacity: isDimmed ? BADGE_DIM_OPACITY : 1,
        transform: `translate(-50%, -50%) scale(${isHovered ? 1.08 : 1})`,
      }}
    >
      <div
        className={cn(
          "flex w-max max-w-none items-center border border-[#E4E4E7] bg-white shadow-[0px_1px_4px_0px_rgba(10,10,10,0.08)] transition-[padding,box-shadow,gap,border-radius] duration-200 ease-out",
          isHovered
            ? "gap-2.5 rounded-[12px] py-1.5 pl-1.5 pr-3.5 shadow-[0px_4px_14px_0px_rgba(10,10,10,0.12)]"
            : "gap-1 rounded-[8px] py-0.5 pl-0.5 pr-2",
        )}
      >
        <div className="shrink-0 transition-transform duration-200 ease-out">
          {BadgeIcon ? (
            <span
              className={cn(
                "flex shrink-0 items-center justify-center",
                isHovered ? "h-8 w-8 rounded-[10px]" : "h-5 w-5 rounded-md",
              )}
              style={{ backgroundColor: row.color }}
              aria-hidden
            >
              <BadgeIcon
                className={cn("text-white", isHovered ? "h-4 w-4" : "h-3 w-3")}
                strokeWidth={2}
                aria-hidden
              />
            </span>
          ) : (
            <CompanyLogo
              name={row.name}
              logoUrl={row.logoUrl ?? ""}
              symbol={row.symbol}
              size={isHovered ? "md" : "xs"}
              fill
            />
          )}
        </div>
        {isHovered ? (
          <div className="flex shrink-0 flex-col gap-0.5">
            <span className="whitespace-nowrap text-[13px] font-semibold leading-4 text-[#0F0F0F]">
              {ticker}
            </span>
            <span className="whitespace-nowrap text-[12px] font-medium tabular-nums leading-4 text-[#0F0F0F]">
              {pct1.format(row.weightPct)}%
            </span>
          </div>
        ) : (
          <span className="whitespace-nowrap text-[12px] font-medium tabular-nums leading-4 text-[#0F0F0F]">
            {pct1.format(row.weightPct)}%
          </span>
        )}
      </div>
    </div>
  );
}

function buildSliceGeometries(rows: AllocationDonutRow[]): SliceGeom[] {
  const prefix: number[] = [];
  let cum = 0;
  for (const row of rows) {
    prefix.push(cum);
    cum += row.weightPct;
  }
  const gap = computeSliceGapRad(rows);
  return rows.map((row, i) => {
    const start = prefix[i] ?? 0;
    const end = start + row.weightPct;
    const a0 = snapSvg(-Math.PI / 2 + (start / 100) * 2 * Math.PI + gap / 2);
    const a1 = snapSvg(-Math.PI / 2 + (end / 100) * 2 * Math.PI - gap / 2);
    const midA = snapSvg((a0 + a1) / 2);
    const showLabel =
      row.weightPct >= MIN_LABEL_WEIGHT_PCT ||
      (i < TOP_ALLOCATION_SLICES + 1 && rows.length <= TOP_ALLOCATION_SLICES + 1);
    return { row, i, a0, a1, midA, showLabel };
  });
}

function AllocationDonutSvg({
  rows,
  geometry,
  hoveredIndex,
  onHoverIndexChange,
}: {
  rows: AllocationDonutRow[];
  geometry: DonutGeometry;
  hoveredIndex: number | null;
  onHoverIndexChange: (index: number | null) => void;
}) {
  const slices = useMemo(() => buildSliceGeometries(rows), [rows]);

  const clearHover = useCallback(() => {
    onHoverIndexChange(null);
  }, [onHoverIndexChange]);

  if (rows.length === 1) {
    const row = rows[0]!;
    return (
      <svg viewBox={`0 0 ${VB} ${VB}`} className="h-full w-full touch-none" onMouseLeave={clearHover}>
        <g
          onMouseEnter={() => onHoverIndexChange(0)}
          className="cursor-pointer transition-[opacity] duration-200"
          style={{ opacity: hoveredIndex === 0 ? 1 : hoveredIndex !== null ? 0.45 : 1 }}
        >
          <path
            d={donutSlicePath(CX, CY, geometry.rOut, geometry.rIn, -Math.PI / 2, (3 * Math.PI) / 2)}
            fill={row.color}
            stroke="none"
          />
        </g>
      </svg>
    );
  }

  return (
    <svg viewBox={`0 0 ${VB} ${VB}`} className="h-full w-full touch-none" onMouseLeave={clearHover}>
      {slices.map(({ row, i, a0, a1 }) => (
        <g
          key={row.id}
          className="cursor-pointer transition-[opacity] duration-200"
          style={{
            opacity: hoveredIndex !== null && hoveredIndex !== i ? 0.45 : 1,
          }}
          onMouseEnter={() => onHoverIndexChange(i)}
        >
          <path
            d={donutSlicePath(CX, CY, geometry.rOut, geometry.rIn, a0, a1)}
            fill={row.color}
            stroke="none"
          />
        </g>
      ))}
    </svg>
  );
}

export function AllocationDonutChart({
  rows,
  center,
  chartSizePx = 300,
  badgeOverflowPadPx = BADGE_OVERFLOW_PAD_PX,
  centerHoleRadiusPx,
  showExternalLabels = true,
}: AllocationDonutChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const geometry = useMemo(
    () => resolveDonutGeometry(chartSizePx, centerHoleRadiusPx),
    [chartSizePx, centerHoleRadiusPx],
  );
  const labelRadiusVb = geometry.rOut + LABEL_RADIUS_OFFSET_VB;

  const labelSlices = useMemo(() => buildSliceGeometries(rows), [rows]);

  if (rows.length === 0) return null;

  return (
    <div
      className="absolute overflow-visible"
      style={{
        left: badgeOverflowPadPx,
        top: badgeOverflowPadPx,
        width: chartSizePx,
        height: chartSizePx,
      }}
      onMouseLeave={() => setHoveredIndex(null)}
    >
        <div className="absolute inset-0" aria-hidden>
          <AllocationDonutSvg
            rows={rows}
            geometry={geometry}
            hoveredIndex={hoveredIndex}
            onHoverIndexChange={setHoveredIndex}
          />
        </div>
        {showExternalLabels
          ? labelSlices.map(({ row, i, midA, showLabel }) => {
              const visible = showLabel || hoveredIndex === i;
              if (!visible) return null;
              const isHovered = hoveredIndex === i;
              const isDimmed = hoveredIndex !== null && !isHovered;
              return (
                <SliceExternalLabel
                  key={`label-${row.id}-${i}`}
                  row={row}
                  midA={midA}
                  labelRadiusVb={labelRadiusVb}
                  isHovered={isHovered}
                  isDimmed={isDimmed}
                />
              );
            })
          : null}
        {center ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            {center}
          </div>
        ) : null}
    </div>
  );
}
