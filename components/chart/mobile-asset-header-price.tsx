"use client";

import NumberFlow from "@number-flow/react";

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

  if (loading || value == null || !Number.isFinite(value)) {
    return (
      <span className={cn(MOBILE_PRICE_CLASS, "text-[#09090B]", motionClass, className)}>—</span>
    );
  }

  if (variant === "crypto") {
    const maxFractionDigits = value < 1 ? 6 : value < 100 ? 4 : 2;
    return (
      <NumberFlow
        value={value}
        prefix="$"
        locales="en-US"
        format={{ minimumFractionDigits: 2, maximumFractionDigits: maxFractionDigits }}
        className={cn(MOBILE_PRICE_CLASS, "text-[#09090B]", motionClass, className)}
        willChange
      />
    );
  }

  if (chartMetric === "marketCap") {
    return (
      <NumberFlow
        value={value}
        prefix="$"
        locales="en-US"
        format={{ notation: "compact", maximumFractionDigits: 2 }}
        className={cn(MOBILE_PRICE_CLASS, "text-[#09090B]", motionClass, className)}
        willChange
      />
    );
  }

  if (chartMetric === "return") {
    const returnPct = value - 100;
    return (
      <NumberFlow
        value={Math.abs(returnPct)}
        prefix={returnPct > 0 ? "+" : returnPct < 0 ? "−" : ""}
        suffix="%"
        locales="en-US"
        format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
        className={cn(MOBILE_PRICE_CLASS, motionClass, className)}
        willChange
      />
    );
  }

  return (
    <NumberFlow
      value={value}
      prefix="$"
      locales="en-US"
      format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
      className={cn(MOBILE_PRICE_CLASS, motionClass, className)}
      willChange
    />
  );
}
