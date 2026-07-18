"use client";

import { RotateCcw, Search, SlidersHorizontal } from "@/lib/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DropdownScrollArea } from "@/components/design-system/dropdown-scroll-area";
import { dropdownMenuSurfaceClassName } from "@/components/design-system/dropdown-menu-styles";
import {
  topbarSquircleIconClass,
  topbarSquircleTextButtonClass,
} from "@/components/design-system/topbar-control-classes";
import { cn } from "@/lib/utils";
import type { ScreenerKeyStatMetricDef } from "@/lib/screener/screener-key-stats-metric-catalog";
import {
  isScreenerBuiltinTableMetricId,
  SCREENER_KEY_STAT_CATEGORIES,
} from "@/lib/screener/screener-key-stats-metric-catalog";

type FlatMetric = {
  metric: ScreenerKeyStatMetricDef;
  categoryTitle: string;
};

function flattenMetrics(query: string): FlatMetric[] {
  const q = query.trim().toLowerCase();
  const seen = new Set<string>();
  const out: FlatMetric[] = [];
  for (const cat of SCREENER_KEY_STAT_CATEGORIES) {
    for (const metric of cat.metrics) {
      if (seen.has(metric.id)) continue;
      if (q && !metric.label.toLowerCase().includes(q) && !cat.title.toLowerCase().includes(q)) {
        continue;
      }
      seen.add(metric.id);
      out.push({ metric, categoryTitle: cat.title });
    }
  }
  return out;
}

function MetricCheckbox({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded border",
        checked ? "border-[#2563EB] bg-[#2563EB] text-white" : "border-[#D4D4D8] bg-white",
      )}
      aria-hidden
    >
      {checked ? (
        <svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden>
          <path
            d="M1 5l3.5 3.5L11 1"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </span>
  );
}

export function ScreenerCompaniesKeyStatToolbar({
  selectedMetricIds,
  onToggleMetricId,
  onReset,
  disabled,
}: {
  /** Custom column metric ids (excludes built-in M Cap / PE — those stay in the default table). */
  selectedMetricIds: ReadonlySet<string>;
  onToggleMetricId: (metricId: string) => void;
  onReset: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filteredMetrics = useMemo(() => flattenMetrics(search), [search]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const el = rootRef.current;
      if (!el || el.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  const onPickMetric = useCallback(
    (id: string) => {
      if (isScreenerBuiltinTableMetricId(id)) return;
      onToggleMetricId(id);
    },
    [onToggleMetricId],
  );

  return (
    <div ref={rootRef} className="flex shrink-0 items-center gap-3 self-end sm:self-center">
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => {
            if (disabled) return;
            setOpen((o) => !o);
            if (!open) setSearch("");
          }}
          className={cn(
            topbarSquircleTextButtonClass,
            "hidden md:inline-flex",
            disabled && "pointer-events-none opacity-50",
          )}
        >
          <SlidersHorizontal className="h-5 w-5 shrink-0 text-[#0F0F0F]" aria-hidden />
          Customize
        </button>

        {open ? (
          <div
            role="dialog"
            aria-label="Customize columns"
            className="absolute right-0 top-[calc(100%+6px)] z-50 w-[min(100vw-1.5rem,320px)]"
          >
            <div
              className={cn(
                dropdownMenuSurfaceClassName("flex max-h-[min(70vh,480px)] flex-col overflow-hidden p-0"),
              )}
            >
              <div className="shrink-0 border-b border-[#E4E4E7] px-2 py-2">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#71717A]"
                    aria-hidden
                  />
                  <input
                    ref={searchRef}
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search metrics…"
                    className="h-9 w-full rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] py-1.5 pl-9 pr-3 text-[13px] leading-5 text-[#0F0F0F] placeholder:text-[#71717A] focus:border-[#0F0F0F]/20 focus:outline-none focus:ring-2 focus:ring-[#0F0F0F]/10"
                  />
                </div>
              </div>

              <DropdownScrollArea className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-1">
                {filteredMetrics.length === 0 ? (
                  <div className="px-3 py-6 text-center text-[13px] text-[#71717A]">No metrics match.</div>
                ) : (
                  filteredMetrics.map(({ metric }) => {
                    const builtin = isScreenerBuiltinTableMetricId(metric.id);
                    const checked = builtin || selectedMetricIds.has(metric.id);
                    return (
                      <button
                        key={metric.id}
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        aria-disabled={builtin || undefined}
                        disabled={builtin}
                        onClick={() => onPickMetric(metric.id)}
                        className={cn(
                          "mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors last:mb-0",
                          builtin ? "cursor-default opacity-80" : "hover:bg-[#F4F4F5]",
                        )}
                      >
                        <MetricCheckbox checked={checked} />
                        <span className="min-w-0 flex-1 text-[13px] leading-5 text-[#0F0F0F]">
                          {metric.label}
                        </span>
                      </button>
                    );
                  })
                )}
              </DropdownScrollArea>
            </div>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        disabled={disabled || selectedMetricIds.size === 0}
        onClick={onReset}
        title="Reset table columns"
        aria-label="Reset table columns to default"
        className={cn(
          topbarSquircleIconClass,
          "hidden md:inline-flex",
          "disabled:pointer-events-none disabled:opacity-40",
        )}
      >
        <RotateCcw className="h-5 w-5 shrink-0" aria-hidden />
      </button>
    </div>
  );
}
