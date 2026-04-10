"use client";

import { useEffect, useRef, useState } from "react";

const Z_BAR = 99;

/**
 * Viewport-top progress strip — same look as {@link NavigationTopLoader} — while async work runs (e.g. charting fundamentals fetch).
 */
export function DataFetchTopLoader({ active }: { active: boolean }) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const creepTimerRef = useRef<number | null>(null);
  const doneTimerRef = useRef<number | null>(null);
  const activeRef = useRef(false);
  const hadActivityRef = useRef(false);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const clearCreep = () => {
      if (creepTimerRef.current) {
        clearTimeout(creepTimerRef.current);
        creepTimerRef.current = null;
      }
    };

    if (active) {
      if (doneTimerRef.current) {
        clearTimeout(doneTimerRef.current);
        doneTimerRef.current = null;
      }
      clearCreep();
      hadActivityRef.current = true;
      const creep = () => {
        creepTimerRef.current = window.setTimeout(() => {
          if (!activeRef.current) return;
          setProgress((p) => Math.min(p + 0.04 + Math.random() * 0.07, 0.88));
          creep();
        }, 380);
      };
      const startRaf = requestAnimationFrame(() => {
        setVisible(true);
        setProgress(0.1);
        creep();
      });
      return () => {
        cancelAnimationFrame(startRaf);
        clearCreep();
      };
    }

    clearCreep();
    if (!hadActivityRef.current) return;
    hadActivityRef.current = false;
    const finishRaf = requestAnimationFrame(() => setProgress(1));
    doneTimerRef.current = window.setTimeout(() => {
      setVisible(false);
      setProgress(0);
      doneTimerRef.current = null;
    }, 220);
    return () => {
      cancelAnimationFrame(finishRaf);
      clearCreep();
      if (doneTimerRef.current) {
        clearTimeout(doneTimerRef.current);
        doneTimerRef.current = null;
      }
    };
  }, [active]);

  if (!visible && progress === 0) return null;

  return (
    <div
      className="pointer-events-none fixed top-0 right-0 left-0 overflow-hidden"
      style={{ zIndex: Z_BAR, height: 2, margin: 0, padding: 0 }}
      aria-hidden
    >
      <div
        className="h-full origin-left rounded-none bg-[#09090B]"
        style={{
          transform: `scaleX(${Math.min(1, Math.max(0, progress))})`,
          transition:
            progress >= 1
              ? "transform 180ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease"
              : "transform 120ms ease-out",
          opacity: 0.88,
        }}
      />
    </div>
  );
}
