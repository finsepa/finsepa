"use client";

import { useEffect, useState } from "react";
import NumberFlow, { type Format } from "@number-flow/react";

import type { StockChartSeries } from "@/lib/market/stock-chart-types";
import { cn } from "@/lib/utils";

const MOBILE_PRICE_CLASS =
  "block text-[28px] font-semibold leading-8 tabular-nums transition-[transform] duration-200 ease-out";

type Props = {
  value: number | null;
  loading?: boolean;
  className?: string;
  chartMetric?: StockChartSeries;
  variant?: "stock" | "crypto";
  chartHovering?: boolean;
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
    const maxFractionDigits = value < 1 ? 6 : value < 100 ? 4 : 2;
    return { value, prefix: "$", format: { minimumFractionDigits: 2, maximumFractionDigits: maxFractionDigits } };
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

/** Mobile-only odometer price (NumberFlow / Bklit-style) for asset headers. */
export function MobileAssetHeaderPrice({
  value,
  loading = false,
  className,
  chartMetric = "price",
  variant = "stock",
  chartHovering = false,
}: Props) {
  const motionClass = chartHovering ? "scale-[1.01]" : "scale-100";

  // NumberFlow is a custom element whose DOM differs between the server render and the browser,
  // which trips React hydration. Render a plain formatted span on the server + first client paint,
  // then swap to the animated NumberFlow once mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (loading || value == null || !Number.isFinite(value)) {
    return (
      <span className={cn(MOBILE_PRICE_CLASS, "text-[#0F0F0F]", motionClass, className)}>—</span>
    );
  }

  const cfg = resolveFlowConfig(value, variant, chartMetric);
  const colorClass = cfg.colored ? "" : "text-[#0F0F0F]";

  if (!mounted) {
    const formatted = `${cfg.prefix ?? ""}${cfg.value.toLocaleString("en-US", cfg.format)}${cfg.suffix ?? ""}`;
    return (
      <span className={cn(MOBILE_PRICE_CLASS, colorClass, motionClass, className)}>{formatted}</span>
    );
  }

  return (
    <NumberFlow
      value={cfg.value}
      prefix={cfg.prefix}
      suffix={cfg.suffix}
      locales="en-US"
      format={cfg.format}
      className={cn(MOBILE_PRICE_CLASS, colorClass, motionClass, className)}
      willChange
    />
  );
}
