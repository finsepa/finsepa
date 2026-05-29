export type SmoothLinePoint = { x: number; y: number };

/**
 * Smooth SVG path through points — approximates Lightweight Charts `LineType.Curved`
 * (Catmull–Rom → cubic Bézier).
 */
export function smoothLinePathD(points: readonly SmoothLinePoint[]): string {
  const n = points.length;
  if (n === 0) return "";
  if (n === 1) return `M ${points[0]!.x} ${points[0]!.y}`;
  if (n === 2) {
    return `M ${points[0]!.x} ${points[0]!.y} L ${points[1]!.x} ${points[1]!.y}`;
  }

  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2 >= n ? n - 1 : i + 2]!;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

/** Closed area under a smooth line down to `floorY`. */
export function smoothAreaPathD(points: readonly SmoothLinePoint[], floorY: number): string {
  const line = smoothLinePathD(points);
  if (!line || points.length === 0) return "";
  const last = points[points.length - 1]!;
  const first = points[0]!;
  return `${line} L ${last.x} ${floorY} L ${first.x} ${floorY} Z`;
}
