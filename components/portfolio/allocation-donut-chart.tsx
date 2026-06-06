"use client";

import { useCallback, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";

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
const R_OUT_MAX = 49.8;
/** Matches `UserAvatar` / `SuperinvestorProfileAvatar` donut center (72px + 1px white ring). */
const DONUT_CENTER_AVATAR_PX = 72;
const DONUT_CENTER_RING_PX = 1;
const DONUT_CENTER_GAP_PX = 1;
const MIN_RING_THICKNESS = 6;

const SLICE_INLINE_LABEL_TOP_N = TOP_ALLOCATION_SLICES + 1;
const SLICE_LABEL_MIN_ARC_TOP_N = 1.85;
const SLICE_LABEL_MIN_ARC_DEFAULT = 5.5;

type DonutGeometry = { rOut: number; rIn: number };

type SliceLabelLayout = {
  pctSize: number;
  symSize: number;
  lineGap: number;
  singleLine: boolean;
};

type TooltipState = { name: string; pctLabel: string; x: number; y: number } | null;

function resolveDonutGeometry(chartSizePx: number): DonutGeometry {
  const innerRadiusPx =
    DONUT_CENTER_AVATAR_PX / 2 + DONUT_CENTER_RING_PX + DONUT_CENTER_GAP_PX;
  const rIn = (innerRadiusPx / chartSizePx) * 50;
  const rOut = R_OUT_MAX;
  return { rOut, rIn: Math.min(rIn, rOut - MIN_RING_THICKNESS) };
}

function sliceMidRadius(geo: DonutGeometry): number {
  return (geo.rOut + geo.rIn) / 2;
}

function sliceArcLength(a0: number, a1: number, geo: DonutGeometry): number {
  return (a1 - a0) * sliceMidRadius(geo);
}

function layoutForArcLength(arcLen: number, minArc: number): SliceLabelLayout | null {
  if (arcLen < minArc) return null;
  if (arcLen >= 12) return { pctSize: 5.5, symSize: 4.9, lineGap: 5.2, singleLine: false };
  if (arcLen >= 9) return { pctSize: 5.1, symSize: 4.5, lineGap: 4.8, singleLine: false };
  if (arcLen >= 6.5) return { pctSize: 4.45, symSize: 3.95, lineGap: 4.2, singleLine: false };
  if (arcLen >= 4.5) return { pctSize: 3.9, symSize: 3.45, lineGap: 3.7, singleLine: false };
  return { pctSize: 3.3, symSize: 3.3, lineGap: 0, singleLine: true };
}

function resolveSliceLabelLayout(
  sliceIndex: number,
  a0: number,
  a1: number,
  geo: DonutGeometry,
): SliceLabelLayout | null {
  const arcLen = sliceArcLength(a0, a1, geo);
  const minArc =
    sliceIndex < SLICE_INLINE_LABEL_TOP_N ? SLICE_LABEL_MIN_ARC_TOP_N : SLICE_LABEL_MIN_ARC_DEFAULT;
  return layoutForArcLength(arcLen, minArc);
}

const SINGLE_SLICE_LABEL_LAYOUT: SliceLabelLayout = {
  pctSize: 5.5,
  symSize: 4.9,
  lineGap: 5.2,
  singleLine: false,
};

function polar(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

function donutSlicePath(cx: number, cy: number, rOuter: number, rInner: number, a0: number, a1: number) {
  const p0o = polar(cx, cy, rOuter, a0);
  const p1o = polar(cx, cy, rOuter, a1);
  const p1i = polar(cx, cy, rInner, a1);
  const p0i = polar(cx, cy, rInner, a0);
  const sweep = a1 - a0;
  const largeArc = sweep > Math.PI ? 1 : 0;
  return [
    `M ${p0o.x} ${p0o.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p1o.x} ${p1o.y}`,
    `L ${p1i.x} ${p1i.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p0i.x} ${p0i.y}`,
    "Z",
  ].join(" ");
}

function FullRing({ color, geometry }: { color: string; geometry: DonutGeometry }) {
  const mid = sliceMidRadius(geometry);
  const sw = geometry.rOut - geometry.rIn;
  return <circle cx={CX} cy={CY} r={mid} fill="none" stroke={color} strokeWidth={sw} />;
}

const LABEL_FONT_FAMILY = "Inter, ui-sans-serif, system-ui, sans-serif";

/** Vertically center a two-line % + symbol block on the slice midpoint. */
function centeredTwoLineLabelYs(
  centerY: number,
  pctSize: number,
  symSize: number,
  lineGap: number,
): { pctY: number; symY: number } {
  const blockHeight = pctSize + lineGap + symSize;
  const top = centerY - blockHeight / 2;
  return {
    pctY: top + pctSize / 2,
    symY: top + pctSize + lineGap + symSize / 2,
  };
}

function SliceLabelTexts({
  x,
  y,
  layout,
  pctText,
  symbolText,
}: {
  x: number;
  y: number;
  layout: SliceLabelLayout;
  pctText: string;
  symbolText: string;
}) {
  const fontStyle = { fontFamily: LABEL_FONT_FAMILY };

  if (layout.singleLine) {
    return (
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#FFFFFF"
        fontSize={layout.pctSize}
        fontWeight="600"
        stroke="rgba(0,0,0,0.22)"
        strokeWidth="0.3"
        paintOrder="stroke"
        className="pointer-events-none select-none"
        style={fontStyle}
      >
        {symbolText} {pctText}
      </text>
    );
  }

  const { pctY, symY } = centeredTwoLineLabelYs(y, layout.pctSize, layout.symSize, layout.lineGap);

  return (
    <g className="pointer-events-none select-none">
      <text
        x={x}
        y={pctY}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#FFFFFF"
        fontSize={layout.pctSize}
        fontWeight="600"
        stroke="rgba(0,0,0,0.22)"
        strokeWidth="0.35"
        paintOrder="stroke"
        style={fontStyle}
      >
        {pctText}
      </text>
      <text
        x={x}
        y={symY}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#FFFFFF"
        fontSize={layout.symSize}
        fontWeight="500"
        stroke="rgba(0,0,0,0.22)"
        strokeWidth="0.3"
        paintOrder="stroke"
        style={fontStyle}
      >
        {symbolText}
      </text>
    </g>
  );
}

function DonutSliceLabel({
  row,
  sliceIndex,
  a0,
  a1,
  geometry,
}: {
  row: AllocationDonutRow;
  sliceIndex: number;
  a0: number;
  a1: number;
  geometry: DonutGeometry;
}) {
  const layout = resolveSliceLabelLayout(sliceIndex, a0, a1, geometry);
  if (!layout) return null;
  const midA = (a0 + a1) / 2;
  const { x, y } = polar(CX, CY, sliceMidRadius(geometry), midA);
  const pctText = `${pct1.format(row.weightPct)}%`;
  const symbolText = row.symbol.length > 6 ? `${row.symbol.slice(0, 5)}…` : row.symbol;

  return (
    <SliceLabelTexts
      x={x}
      y={y}
      layout={layout}
      pctText={pctText}
      symbolText={symbolText}
    />
  );
}

function AllocationDonutSvg({
  rows,
  geometry,
  onTooltipChange,
}: {
  rows: AllocationDonutRow[];
  geometry: DonutGeometry;
  onTooltipChange: (t: TooltipState) => void;
}) {
  const [dimIndex, setDimIndex] = useState<number | null>(null);
  const [showSliceLabels, setShowSliceLabels] = useState(false);

  useEffect(() => {
    setShowSliceLabels(true);
  }, []);

  const slices = useMemo(() => {
    const prefix: number[] = [];
    let cum = 0;
    for (const row of rows) {
      prefix.push(cum);
      cum += row.weightPct;
    }
    return rows.map((row, i) => {
      const start = prefix[i] ?? 0;
      const end = start + row.weightPct;
      const a0 = -Math.PI / 2 + (start / 100) * 2 * Math.PI;
      const a1 = -Math.PI / 2 + (end / 100) * 2 * Math.PI;
      return { row, i, a0, a1 };
    });
  }, [rows]);

  const moveTip = useCallback(
    (e: MouseEvent, row: AllocationDonutRow) => {
      onTooltipChange({
        name: row.name,
        pctLabel: `${pct1.format(row.weightPct)}%`,
        x: e.clientX,
        y: e.clientY,
      });
    },
    [onTooltipChange],
  );

  const leave = useCallback(() => {
    setDimIndex(null);
    onTooltipChange(null);
  }, [onTooltipChange]);

  if (rows.length === 1) {
    const row = rows[0]!;
    const labelPos = polar(CX, CY, sliceMidRadius(geometry), -Math.PI / 2);
    const singleLayout = SINGLE_SLICE_LABEL_LAYOUT;
    return (
      <svg viewBox={`0 0 ${VB} ${VB}`} className="h-full w-full touch-none" onMouseLeave={leave}>
        <g
          onMouseEnter={(e) => {
            setDimIndex(0);
            moveTip(e, row);
          }}
          onMouseMove={(e) => moveTip(e, row)}
          onMouseLeave={leave}
          className="cursor-pointer"
        >
          <FullRing color={row.color} geometry={geometry} />
          {showSliceLabels ? (
            <SliceLabelTexts
              x={labelPos.x}
              y={labelPos.y}
              layout={singleLayout}
              pctText={`${pct1.format(row.weightPct)}%`}
              symbolText={row.symbol}
            />
          ) : null}
        </g>
      </svg>
    );
  }

  return (
    <svg viewBox={`0 0 ${VB} ${VB}`} className="h-full w-full touch-none" onMouseLeave={leave}>
      {slices.map(({ row, i, a0, a1 }) => (
        <g
          key={row.id}
          className="cursor-pointer transition-[opacity] duration-150"
          style={{
            opacity: dimIndex !== null && dimIndex !== i ? 0.45 : 1,
          }}
          onMouseEnter={(e) => {
            setDimIndex(i);
            moveTip(e, row);
          }}
          onMouseMove={(e) => moveTip(e, row)}
          onMouseLeave={leave}
        >
          <path
            d={donutSlicePath(CX, CY, geometry.rOut, geometry.rIn, a0, a1)}
            fill={row.color}
            stroke="none"
          />
          {showSliceLabels ? (
            <DonutSliceLabel
              row={row}
              sliceIndex={i}
              a0={a0}
              a1={a1}
              geometry={geometry}
            />
          ) : null}
        </g>
      ))}
    </svg>
  );
}

export function AllocationDonutChart({
  rows,
  center,
  className,
  chartSizePx = 220,
}: {
  rows: AllocationDonutRow[];
  center?: ReactNode;
  className?: string;
  /** Rendered chart edge length — drives inner hole so center avatar leaves a 1px white gap. */
  chartSizePx?: number;
}) {
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const geometry = useMemo(() => resolveDonutGeometry(chartSizePx), [chartSizePx]);

  if (rows.length === 0) return null;

  return (
    <>
      {tooltip ? (
        <div
          className="pointer-events-none fixed z-[200] max-w-[min(calc(100vw-1rem),280px)] rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 text-left shadow-[0px_4px_12px_0px_rgba(10,10,10,0.08)]"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
        >
          <div className="text-[13px] font-semibold leading-5 text-[#09090B]">{tooltip.name}</div>
          <div className="text-[12px] tabular-nums leading-4 text-[#71717A]">{tooltip.pctLabel}</div>
        </div>
      ) : null}
      <div className={cn("relative size-[220px] shrink-0", className)}>
        <div className="absolute inset-0" aria-hidden>
          <AllocationDonutSvg rows={rows} geometry={geometry} onTooltipChange={setTooltip} />
        </div>
        {center ? (
          <div className="pointer-events-none relative z-10 flex h-full w-full items-center justify-center">
            {center}
          </div>
        ) : null}
      </div>
    </>
  );
}
