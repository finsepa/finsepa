import { chartMarkerDiscFillColor } from "@/lib/theme/resolve-fs-color";
import type { IChartApi, ISeriesMarkersPluginApi, SeriesMarker, Time, UTCTimestamp } from "lightweight-charts";

/**
 * Sparse ranges (e.g. 1M) get oversized dots vs dense ranges (6M).
 * Damp toward ~16px equivalent without exceeding default.
 */
export function inBarMarkerSizeMultiplier(barSpacing: number): number {
  const clamped = Math.min(Math.max(barSpacing, 12), 30);
  return Math.min(1, 16 / clamped);
}

export function scheduleScaledInBarMarkers(
  chart: IChartApi,
  markers: ISeriesMarkersPluginApi<UTCTimestamp>,
  templates: SeriesMarker<UTCTimestamp>[],
): void {
  const apply = () => {
    const bs = chart.timeScale().options().barSpacing;
    const sm = inBarMarkerSizeMultiplier(bs);
    markers.setMarkers(templates.map((m) => ({ ...m, size: (m.size ?? 1) * sm })));
  };
  requestAnimationFrame(() => requestAnimationFrame(apply));
}

/**
 * LW series markers are fill-only — paint a stroke ring then a smaller disc on top.
 * Last-point dots pass `fillColor` = stroke so they match the sparkline (not panel white).
 * Trade markers keep the default panel fill (hollow ring).
 */
export function hollowInBarCircleMarkers(
  time: UTCTimestamp,
  strokeColor: string,
  size = 1,
  fillColor: string = chartMarkerDiscFillColor(),
): SeriesMarker<UTCTimestamp>[] {
  const outer: SeriesMarker<UTCTimestamp> = {
    time,
    position: "inBar",
    shape: "circle",
    color: strokeColor,
    size,
  };
  if (fillColor === strokeColor) return [outer];
  return [
    outer,
    {
      time,
      position: "inBar",
      shape: "circle",
      color: fillColor,
      size: Math.max(0.35, size * 0.5),
    },
  ];
}

export function applyLastPointCircleMarkers(
  chart: IChartApi,
  markers: ISeriesMarkersPluginApi<UTCTimestamp> | null | undefined,
  data: readonly { time: Time }[],
  strokeColor: string,
  visible: boolean,
): void {
  if (!markers) return;
  if (!visible || data.length === 0) {
    markers.setMarkers([]);
    return;
  }
  const t = data[data.length - 1]?.time;
  if (typeof t !== "number" || !Number.isFinite(t)) {
    markers.setMarkers([]);
    return;
  }
  scheduleScaledInBarMarkers(
    chart,
    markers,
    hollowInBarCircleMarkers(t as UTCTimestamp, strokeColor, 1, strokeColor),
  );
}
