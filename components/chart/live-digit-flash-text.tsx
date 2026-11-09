"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/** Match `.animate-live-digit-flash-*` in globals.css */
const DIGIT_FLASH_MS = 700;

type FlashDirection = "up" | "down";

/** Right-aligned char diff — flash only glyphs that actually changed. */
function changedCharMask(prev: string, next: string): boolean[] {
  const mask = new Array(next.length).fill(false);
  const maxLen = Math.max(prev.length, next.length);
  const p = prev.padStart(maxLen, "\0");
  const n = next.padStart(maxLen, "\0");
  const offset = maxLen - next.length;
  for (let i = 0; i < maxLen; i++) {
    if (p[i] === n[i] || n[i] === "\0") continue;
    const nextIdx = i - offset;
    if (nextIdx >= 0 && nextIdx < next.length) mask[nextIdx] = true;
  }
  return mask;
}

/**
 * Formatted live value whose changed digits briefly tint green/red on each tick (Yahoo-style).
 * No roll, no background. The first value and `resetKey` changes never flash.
 */
export function LiveDigitFlashText({
  value,
  text,
  animate = true,
  resetKey,
  className,
}: {
  value: number | null | undefined;
  text: string;
  animate?: boolean;
  /** e.g. ticker — a different asset in the same slot is not a tick. */
  resetKey?: string;
  className?: string;
}) {
  const prevRef = useRef<{ value: number; text: string; resetKey?: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [flashMask, setFlashMask] = useState<boolean[] | null>(null);
  const [flashDir, setFlashDir] = useState<FlashDirection | null>(null);
  const [flashKey, setFlashKey] = useState(0);

  useEffect(() => {
    if (!animate || value == null || !Number.isFinite(value)) {
      prevRef.current = null;
      return;
    }

    const prev = prevRef.current;
    prevRef.current = { value, text, resetKey };
    if (prev == null || prev.resetKey !== resetKey || prev.text === text || prev.value === value) return;

    const mask = changedCharMask(prev.text, text);
    if (!mask.some(Boolean)) return;

    setFlashMask(mask);
    setFlashDir(value > prev.value ? "up" : "down");
    setFlashKey((k) => k + 1);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setFlashMask(null);
      setFlashDir(null);
      timerRef.current = null;
    }, DIGIT_FLASH_MS);
  }, [animate, text, value, resetKey]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return (
    <span className={className}>
      {text.split("").map((ch, i) => {
        const lit = Boolean(flashMask?.[i] && flashDir);
        // Stable keys for unchanged glyphs so only flashing digits remount/restart anim.
        return (
          <span
            key={lit ? `${flashKey}-${i}` : `c-${i}`}
            className={cn(
              lit && flashDir === "up" && "animate-live-digit-flash-up",
              lit && flashDir === "down" && "animate-live-digit-flash-down",
            )}
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
}
