"use client";

import { useEffect, useRef, useState } from "react";
import type { Format } from "@number-flow/react";

import { cryptoUsdFractionDigits } from "@/lib/market/format-crypto-usd";
import type { StockChartSeries } from "@/lib/market/stock-chart-types";
import { cn } from "@/lib/utils";

const MOBILE_PRICE_CLASS =
  "inline-block text-[28px] font-semibold leading-9 tabular-nums text-fg";

/** Match `.animate-live-digit-flash-*` in globals.css */
const DIGIT_FLASH_MS = 700;

type FlashDirection = "up" | "down";

type Props = {
  value: number | null;
  loading?: boolean;
  className?: string;
  chartMetric?: StockChartSeries;
  variant?: "stock" | "crypto";
  chartHovering?: boolean;
  /**
   * When true (default), changed digits briefly tint green/red (no roll, no background).
   * Set false to snap with no flash.
   */
  animateTicks?: boolean;
};

type FlowConfig = {
  value: number;
  prefix?: string;
  suffix?: string;
  format: Format;
  colored?: boolean;
};

function resolveFlowConfig(
  value: number,
  variant: "stock" | "crypto",
  chartMetric: StockChartSeries,
): FlowConfig {
  if (variant === "crypto") {
    const maxFractionDigits = cryptoUsdFractionDigits(value);
    return {
      value,
      prefix: "$",
      format: { minimumFractionDigits: 2, maximumFractionDigits: maxFractionDigits },
    };
  }
  if (chartMetric === "marketCap") {
    return { value, prefix: "$", format: { notation: "compact", maximumFractionDigits: 2 } };
  }
  if (chartMetric === "return") {
    const returnPct = value - 100;
    return {
      value: Math.abs(returnPct),
      prefix: returnPct > 0 ? "+" : returnPct < 0 ? "−" : "",
      suffix: "%",
      format: { minimumFractionDigits: 2, maximumFractionDigits: 2 },
      colored: true,
    };
  }
  return { value, prefix: "$", format: { minimumFractionDigits: 2, maximumFractionDigits: 2 } };
}

function formatFlowValue(cfg: FlowConfig): string {
  return `${cfg.prefix ?? ""}${cfg.value.toLocaleString("en-US", cfg.format)}${cfg.suffix ?? ""}`;
}

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

/** Static price with per-digit green/red tint on ticks (Yahoo-style). No roll, no bg flash. */
export function MobileAssetHeaderPrice({
  value,
  loading = false,
  className,
  chartMetric = "price",
  variant = "stock",
  chartHovering = false,
  animateTicks = true,
}: Props) {
  const hoverClass = chartHovering ? "origin-left scale-[1.01]" : "origin-left scale-100";

  const prevRef = useRef<{ value: number; formatted: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [flashMask, setFlashMask] = useState<boolean[] | null>(null);
  const [flashDir, setFlashDir] = useState<FlashDirection | null>(null);
  const [flashKey, setFlashKey] = useState(0);

  const hasValue = !loading && value != null && Number.isFinite(value);
  const cfg = hasValue ? resolveFlowConfig(value, variant, chartMetric) : null;
  const formatted = cfg ? formatFlowValue(cfg) : null;

  useEffect(() => {
    if (!animateTicks || !formatted || value == null || !Number.isFinite(value)) {
      if (!hasValue) prevRef.current = null;
      return;
    }

    const prev = prevRef.current;
    prevRef.current = { value, formatted };
    if (prev == null || prev.formatted === formatted) return;

    const mask = changedCharMask(prev.formatted, formatted);
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

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [animateTicks, formatted, value, hasValue]);

  if (!cfg || formatted == null) {
    return <span className={cn(MOBILE_PRICE_CLASS, hoverClass, className)}>—</span>;
  }

  const colorClass = cfg.colored ? "" : "text-fg";

  return (
    <span
      className={cn(
        MOBILE_PRICE_CLASS,
        colorClass,
        "transition-transform duration-200 ease-out",
        hoverClass,
        className,
      )}
    >
      {formatted.split("").map((ch, i) => {
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
