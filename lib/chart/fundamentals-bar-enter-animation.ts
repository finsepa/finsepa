/** Bklit BarChart — 1.1s smooth ease grow from baseline. */
export const FUNDAMENTALS_BAR_ENTER_DURATION_MS = 1100;

/** Fade-in for value labels after bars finish growing. */
export const FUNDAMENTALS_BAR_VALUE_LABEL_ENTER_MS = 500;

/** Stagger label fade across periods (ms). */
export const FUNDAMENTALS_BAR_VALUE_LABEL_STAGGER_MS = 32;

const BEZIER_P1X = 0.85;
const BEZIER_P1Y = 0;
const BEZIER_P2X = 0.15;
const BEZIER_P2Y = 1;

function createCubicBezierEasing(p1x: number, p1y: number, p2x: number, p2y: number) {
  const NEWTON_ITERATIONS = 4;
  const NEWTON_MIN_SLOPE = 0.001;

  const ax = 3 * p1x - 3 * p2x + 1;
  const bx = -6 * p1x + 3 * p2x;
  const cx = 3 * p1x;
  const ay = 3 * p1y - 3 * p2y + 1;
  const by = -6 * p1y + 3 * p2y;
  const cy = 3 * p1y;

  const sampleCurveX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleCurveY = (t: number) => ((ay * t + by) * t + cy) * t;
  const sampleCurveDerivativeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  const solveCurveX = (x: number) => {
    let t2 = x;
    for (let i = 0; i < NEWTON_ITERATIONS; i += 1) {
      const slope = sampleCurveDerivativeX(t2);
      if (Math.abs(slope) < NEWTON_MIN_SLOPE) break;
      const dx = sampleCurveX(t2) - x;
      t2 -= dx / slope;
    }
    return t2;
  };

  return (x: number) => {
    const t = Math.min(1, Math.max(0, x));
    if (p1x === p1y && p2x === p2y) return t;
    return sampleCurveY(solveCurveX(t));
  };
}

export const fundamentalsBarEnterEase = createCubicBezierEasing(
  BEZIER_P1X,
  BEZIER_P1Y,
  BEZIER_P2X,
  BEZIER_P2Y,
);

/** Stagger spread is 40% of total duration, divided evenly across bars (ms). */
export function fundamentalsBarStaggerDelayMs(periodCount: number): number {
  if (periodCount <= 1) return 0;
  return (FUNDAMENTALS_BAR_ENTER_DURATION_MS * 0.4) / periodCount;
}

/** Seconds between bar entrances (DOM/CSS `animation-delay`). */
export function fundamentalsBarStaggerDelaySec(periodCount: number): number {
  return fundamentalsBarStaggerDelayMs(periodCount) / 1000;
}

export function fundamentalsBarEnterProgress(
  periodIndex: number,
  periodCount: number,
  elapsedMs: number,
): number {
  if (!Number.isFinite(elapsedMs)) return 1;
  if (periodCount <= 0 || periodIndex < 0) return 1;
  const staggerMs = fundamentalsBarStaggerDelayMs(periodCount);
  const startMs = periodIndex * staggerMs;
  const linear = Math.min(
    1,
    Math.max(0, (elapsedMs - startMs) / FUNDAMENTALS_BAR_ENTER_DURATION_MS),
  );
  return fundamentalsBarEnterEase(linear);
}

export function prefersReducedFundamentalsBarMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function scaleNumericBarValuesForEnter(
  values: readonly number[],
  periodCount: number,
  elapsedMs: number,
): number[] {
  return values.map((value, periodIndex) => value * fundamentalsBarEnterProgress(periodIndex, periodCount, elapsedMs));
}

type BarPointLike = {
  periodIndex: number;
  value: number;
};

export function scaleBarPointsForEnter<T extends BarPointLike>(
  points: readonly T[],
  periodCount: number,
  elapsedMs: number,
  isGapPoint: (point: T) => boolean,
): T[] {
  return points.map((point) => {
    if (isGapPoint(point) || point.periodIndex < 0) return point;
    const progress = fundamentalsBarEnterProgress(point.periodIndex, periodCount, elapsedMs);
    return { ...point, value: point.value * progress };
  });
}

export function runFundamentalsBarEnterAnimation({
  periodCount,
  onFrame,
  onComplete,
}: {
  periodCount: number;
  onFrame: (elapsedMs: number) => void;
  onComplete: () => void;
}): () => void {
  if (periodCount <= 0 || prefersReducedFundamentalsBarMotion()) {
    onFrame(Number.POSITIVE_INFINITY);
    onComplete();
    return () => {};
  }

  const staggerMs = fundamentalsBarStaggerDelayMs(periodCount);
  const totalMs = FUNDAMENTALS_BAR_ENTER_DURATION_MS + Math.max(0, periodCount - 1) * staggerMs;
  const start = performance.now();
  let raf = 0;

  const tick = (now: number) => {
    const elapsed = now - start;
    onFrame(elapsed);
    if (elapsed < totalMs) {
      raf = requestAnimationFrame(tick);
      return;
    }
    onFrame(Number.POSITIVE_INFINITY);
    onComplete();
  };

  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}
