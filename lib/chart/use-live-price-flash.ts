"use client";

import { useEffect, useRef, useState } from "react";

export type LivePriceFlashDirection = "up" | "down";

const LIVE_PRICE_FLASH_MS = 350;

/**
 * Brief up/down background flash when a live header price tick changes.
 * Skips the first settled value and resets when `resetKey` changes (e.g. ticker).
 */
export function useLivePriceFlash(
  price: number | null | undefined,
  enabled: boolean,
  resetKey?: string,
): { flash: LivePriceFlashDirection | null; animationKey: number } {
  const prevPriceRef = useRef<number | null>(null);
  const initializedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [flash, setFlash] = useState<LivePriceFlashDirection | null>(null);
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    initializedRef.current = false;
    prevPriceRef.current = null;
    setFlash(null);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [resetKey]);

  useEffect(() => {
    if (!enabled || price == null || !Number.isFinite(price)) return;

    if (!initializedRef.current) {
      initializedRef.current = true;
      prevPriceRef.current = price;
      return;
    }

    const prev = prevPriceRef.current;
    prevPriceRef.current = price;
    if (prev == null || price === prev) return;

    const direction: LivePriceFlashDirection = price > prev ? "up" : "down";
    setFlash(direction);
    setAnimationKey((k) => k + 1);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setFlash(null);
      timerRef.current = null;
    }, LIVE_PRICE_FLASH_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, price]);

  return { flash, animationKey };
}
