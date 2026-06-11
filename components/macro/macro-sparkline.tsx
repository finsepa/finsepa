"use client";

import { useMemo } from "react";

import { MacroSparklineProminent } from "@/components/macro/macro-sparkline-prominent";
import type { MacroRangeId } from "@/components/macro/macro-range";
import type { MacroValueKind } from "@/components/macro/macro-format";

export type MacroChartVariant = "area" | "bar";

export function MacroSparkline({
  title,
  kind,
  points,
  rangeId,
  height = 168,
  variant = "area",
  /** Match macro card chart density; `prominent` = expanded modal views. */
  visualWeight = "default",
  /** Default: `height` applies to the SVG only. Cards/modal pass `total` for axis labels. */
  heightMode = "svg",
}: {
  title: string;
  kind: MacroValueKind;
  points: Array<{ time: string; value: number }>;
  rangeId: MacroRangeId;
  height?: number;
  variant?: MacroChartVariant;
  visualWeight?: "default" | "prominent";
  heightMode?: "svg" | "total";
}) {
  const prominent = visualWeight === "prominent";

  const hasData = useMemo(
    () =>
      points.some(
        (p) => typeof p.time === "string" && p.time.trim() && Number.isFinite(p.value),
      ),
    [points],
  );

  if (!hasData) {
    return (
      <div
        className="w-full rounded-md bg-[#FAFAFA]"
        style={{ height: heightMode === "total" ? height : height }}
        aria-hidden
      />
    );
  }

  return (
    <MacroSparklineProminent
      title={title}
      kind={kind}
      points={points}
      rangeId={rangeId}
      height={height}
      heightMode={heightMode}
      variant={variant}
      animateOnAppear={prominent}
      prominent={prominent}
    />
  );
}
