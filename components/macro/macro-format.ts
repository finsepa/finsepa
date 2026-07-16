"use client";

import { formatPercentMetric, formatUsdCompact } from "@/lib/market/key-stats-basic-format";

export type MacroValueKind = "percent" | "usd" | "index" | "number";

/** Caption under the headline (e.g. `Jul 2024`) from an observation date. */
export function formatMacroPeriodCaption(ymd: string): string {
  const t = ymd.trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return ymd;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (!Number.isFinite(y) || !Number.isFinite(mo)) return ymd;
  return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/** Full latest observation date (e.g. `Jul 15, 2026`). */
export function formatMacroLatestDate(ymd: string): string {
  const t = ymd.trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return ymd;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  const d = new Date(Date.UTC(y, mo, day));
  if (!Number.isFinite(d.getTime())) return ymd;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

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

