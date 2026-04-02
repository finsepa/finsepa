"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Short ease-out lerp when `target` changes — hover scrubbing stays responsive.
 */
export function useAnimatedScalar(target: number | null, durationMs = 140): number | null {
  const [value, setValue] = useState<number | null>(target);
  const currentRef = useRef<number | null>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    cancelAnimationFrame(frameRef.current);
    if (target == null) {
      currentRef.current = null;
      const id = requestAnimationFrame(() => setValue(null));
      return () => cancelAnimationFrame(id);
    }
    const from = currentRef.current ?? target;
    const t0 = performance.now();

    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / durationMs);
      const eased = 1 - (1 - p) ** 3;
      const next = from + (target - from) * eased;
      currentRef.current = next;
      setValue(next);
      if (p < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, durationMs]);

  return value;
}
