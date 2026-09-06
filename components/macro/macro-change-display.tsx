"use client";

import { ChangePctParen } from "@/components/screener/change-pct";
import {
  formatMacroChangeAbs,
  type MacroValueKind,
} from "@/components/macro/macro-format";
import { cn } from "@/lib/utils";

/** Absolute change + caret/% (no parentheses), shared by macro page / cards / modal. */
export function MacroChangeDisplay({
  kind,
  abs,
  pct,
  className,
  caretSize = 14,
}: {
  kind: MacroValueKind;
  abs: number;
  pct: number | null;
  className?: string;
  caretSize?: number;
}) {
  if (!Number.isFinite(abs)) return null;
  const absText = formatMacroChangeAbs(kind, abs);
  const tone = abs >= 0 ? "text-up" : "text-down";

  if (pct == null || !Number.isFinite(pct) || kind === "percent") {
    return (
      <span className={cn("tabular-nums", tone, className)}>{absText}</span>
    );
  }

  return (
    <ChangePctParen
      value={pct}
      absText={absText}
      caretSize={caretSize}
      className={cn(tone, className)}
    />
  );
}
