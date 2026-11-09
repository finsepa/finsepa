"use client";

import type { Format } from "@number-flow/react";

import { LiveDigitFlashText } from "@/components/chart/live-digit-flash-text";
import { cryptoUsdFractionDigits } from "@/lib/market/format-crypto-usd";
import type { StockChartSeries } from "@/lib/market/stock-chart-types";
import { cn } from "@/lib/utils";

const MOBILE_PRICE_CLASS =
  "inline-block text-[28px] font-semibold leading-9 tabular-nums text-fg";

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

  const hasValue = !loading && value != null && Number.isFinite(value);
  const cfg = hasValue ? resolveFlowConfig(value, variant, chartMetric) : null;
  const formatted = cfg ? formatFlowValue(cfg) : null;

  if (!cfg || formatted == null) {
    return <span className={cn(MOBILE_PRICE_CLASS, hoverClass, className)}>—</span>;
  }

  const colorClass = cfg.colored ? "" : "text-fg";

  return (
    <LiveDigitFlashText
      value={value}
      text={formatted}
      animate={animateTicks}
      className={cn(
        MOBILE_PRICE_CLASS,
        colorClass,
        "transition-transform duration-200 ease-out",
        hoverClass,
        className,
      )}
    />
  );
}
