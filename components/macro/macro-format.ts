"use client";

import { formatPercentMetric, formatUsdCompact } from "@/lib/market/key-stats-basic-format";

export type MacroValueKind = "percent" | "usd" | "index" | "number";

export function formatMacroValue(kind: MacroValueKind, v: number): string {
  if (!Number.isFinite(v)) return "—";
  if (kind === "percent") return formatPercentMetric(v);
  if (kind === "usd") return formatUsdCompact(v);
  if (Math.abs(v) >= 1e6) return formatUsdCompact(v).replace(/^\$/, "");
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function formatMacroChange(kind: MacroValueKind, abs: number, pct: number | null): string {
  const sign = abs > 0 ? "+" : abs < 0 ? "−" : "";
  const absText =
    kind === "percent"
      ? `${sign}${Math.abs(abs).toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}pp`
      : `${sign}${formatMacroValue(kind, Math.abs(abs))}`;
  if (pct == null || !Number.isFinite(pct) || kind === "percent") return absText;
  const pctText = `${pct >= 0 ? "+" : ""}${pct.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}%`;
  return `${absText} (${pctText})`;
}

