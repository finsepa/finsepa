"use client";

import { cn } from "@/lib/utils";

/** Tiny line chart for heatmap tooltip (normalized to viewBox). */
export function HeatmapSparkline({
  values,
  stroke,
  className,
  width = 56,
  height = 22,
}: {
  values: readonly number[];
  stroke: string;
  className?: string;
  width?: number;
  height?: number;
}) {
  const pad = 2;
  if (!values.length) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={cn("shrink-0", className)}
        aria-hidden
      >
        <line
          x1={pad}
          y1={height / 2}
          x2={width - pad}
          y2={height / 2}
          stroke={stroke}
          strokeWidth={2}
          strokeOpacity={0.25}
          strokeLinecap="round"
        />
      </svg>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const innerW = width - 2 * pad;
  const innerH = height - 2 * pad;
  const pts = values.map((v, i) => {
    const x = pad + (values.length <= 1 ? innerW / 2 : (i / (values.length - 1)) * innerW);
    const y =
      max === min ? pad + innerH / 2 : pad + (1 - (v - min) / (max - min)) * innerH;
    return `${x},${y}`;
  });

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
