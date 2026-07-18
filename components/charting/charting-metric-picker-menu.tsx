"use client";

import type { RefObject } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { DropdownScrollArea } from "@/components/design-system/dropdown-scroll-area";
import {
  dropdownMenuPanelBodyClassName,
  dropdownMenuRichItemClassName,
  dropdownMenuSearchHeaderClassName,
  dropdownMenuSearchInputClassName,
  dropdownMenuSurfaceClassName,
} from "@/components/design-system/dropdown-menu-styles";
import {
  CHARTING_DROPDOWN_GROUPS,
  CHARTING_METRIC_LABEL,
  type ChartingDropdownGroupId,
  type ChartingMetricId,
} from "@/lib/market/stock-charting-metrics";
import { Plus } from "@/lib/icons";
import { cn } from "@/lib/utils";

/** Matches {@link WatchlistSectionHeader} section title typography. */
const metricPickerSectionLabelClass =
  "px-2 pb-1 pt-2 text-[13px] font-medium text-[#0F0F0F]";

function MetricPickerSectionLabel({ label }: { label: string }) {
  return <p className={metricPickerSectionLabelClass}>{label}</p>;
}

function metricPickerCategoryButtonClass(active: boolean) {
  return cn(
    "w-full rounded-lg px-2 py-2 text-left text-[13px] font-medium transition-colors",
    active
      ? "bg-[#F4F4F5] text-[#0F0F0F]"
      : "text-[#0F0F0F] hover:bg-[#F4F4F5]",
  );
}

type AddableGroup = {
  id: ChartingDropdownGroupId;
  label: string;
  ids: ChartingMetricId[];
};

function buildAddableGroups(
  excludeMetricIds: ChartingMetricId[],
  query: string,
  allowedMetricIds?: readonly ChartingMetricId[],
): AddableGroup[] {
  const qLower = query.trim().toLowerCase();
  const allowed = allowedMetricIds ? new Set(allowedMetricIds) : null;
  return CHARTING_DROPDOWN_GROUPS.map((g) => {
    const ids = g.metricIds.filter(
      (id) =>
        !excludeMetricIds.includes(id) &&
        (!allowed || allowed.has(id)) &&
        (!qLower || CHARTING_METRIC_LABEL[id].toLowerCase().includes(qLower)),
    );
    return { id: g.id, label: g.label, ids };
  }).filter((g) => g.ids.length > 0);
}

export type ChartingMetricPickerMenuProps = {
  excludeMetricIds: ChartingMetricId[];
  onPick: (id: ChartingMetricId) => void;
  query: string;
  onQueryChange: (query: string) => void;
  /** When set, only metrics in this list are shown (e.g. charting time-range availability). */
  allowedMetricIds?: readonly ChartingMetricId[];
  className?: string;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  autoFocusSearch?: boolean;
  emptySearchMessage?: string;
  emptyDefaultMessage?: string;
};

/**
 * Fiscal-style metric picker: search on top; categories (left) + metrics (right) on hover.
 * Falls back to a single scrollable list while searching.
 */
export function ChartingMetricPickerMenu({
  excludeMetricIds,
  onPick,
  query,
  onQueryChange,
  allowedMetricIds,
  className,
  searchInputRef,
  autoFocusSearch = true,
  emptySearchMessage = "No matching metrics.",
  emptyDefaultMessage = "All metrics already added.",
}: ChartingMetricPickerMenuProps) {
  const qLower = query.trim().toLowerCase();
  const isSearching = qLower.length > 0;

  const addableGroups = useMemo(
    () => buildAddableGroups(excludeMetricIds, query, allowedMetricIds),
    [allowedMetricIds, excludeMetricIds, query],
  );
  const totalAddable = useMemo(() => addableGroups.reduce((n, g) => n + g.ids.length, 0), [addableGroups]);

  const [hoveredGroupId, setHoveredGroupId] = useState<ChartingDropdownGroupId | null>(null);
  const categoriesColumnRef = useRef<HTMLDivElement>(null);
  const [valuesPanelHeight, setValuesPanelHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = categoriesColumnRef.current;
    if (!el) return;

    const syncHeight = () => {
      setValuesPanelHeight(el.offsetHeight);
    };

    syncHeight();
    const ro = new ResizeObserver(syncHeight);
    ro.observe(el);
    return () => ro.disconnect();
  }, [addableGroups.length]);

  useEffect(() => {
    if (addableGroups.length === 0) {
      setHoveredGroupId(null);
      return;
    }
    const stillValid = hoveredGroupId != null && addableGroups.some((g) => g.id === hoveredGroupId);
    if (!stillValid) {
      setHoveredGroupId(addableGroups[0]!.id);
    }
  }, [addableGroups, hoveredGroupId]);

  const activeGroup = useMemo(() => {
    if (addableGroups.length === 0) return null;
    const id = hoveredGroupId ?? addableGroups[0]!.id;
    return addableGroups.find((g) => g.id === id) ?? addableGroups[0]!;
  }, [addableGroups, hoveredGroupId]);

  const emptyMessage =
    totalAddable === 0 ? (qLower ? emptySearchMessage : emptyDefaultMessage) : null;

  return (
    <div className={cn(dropdownMenuSurfaceClassName("overflow-hidden"), className)} role="listbox">
      <div className={dropdownMenuSearchHeaderClassName}>
        <input
          ref={searchInputRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search metrics…"
          className={dropdownMenuSearchInputClassName}
          aria-label="Search metrics"
          autoFocus={autoFocusSearch}
        />
      </div>

      {emptyMessage ? (
        <div className="px-3 py-6 text-center text-[13px] text-[#0F0F0F]">{emptyMessage}</div>
      ) : isSearching ? (
        <DropdownScrollArea
          className={cn(dropdownMenuPanelBodyClassName, "max-h-[min(400px,calc(100vh-12rem))] overflow-y-auto")}
        >
          {addableGroups.map((g) => (
            <div key={g.id} className="py-1">
              <MetricPickerSectionLabel label={g.label} />
              <div className="space-y-0.5">
                {g.ids.map((id) => (
                  <MetricPickerRow key={id} id={id} onPick={onPick} />
                ))}
              </div>
            </div>
          ))}
        </DropdownScrollArea>
      ) : (
        <div className="flex items-start overflow-hidden">
          <div ref={categoriesColumnRef} className="w-[148px] shrink-0 border-r border-[#F4F4F5] p-1">
            <MetricPickerSectionLabel label="Categories" />
            <ul className="flex flex-col gap-0.5">
              {addableGroups.map((g) => {
                const active = activeGroup?.id === g.id;
                return (
                  <li key={g.id}>
                    <button
                      type="button"
                      className={metricPickerCategoryButtonClass(active)}
                      aria-selected={active}
                      onMouseEnter={() => setHoveredGroupId(g.id)}
                      onFocus={() => setHoveredGroupId(g.id)}
                    >
                      <span className="truncate">{g.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div
            className="min-w-0 flex-1 overflow-hidden"
            style={valuesPanelHeight != null ? { height: valuesPanelHeight } : undefined}
          >
            <DropdownScrollArea
              key={activeGroup?.id}
              wheelIsolation
              className="h-full overflow-y-auto p-1"
            >
            {activeGroup ? (
              <>
                <MetricPickerSectionLabel label={activeGroup.label} />
                <ul className="flex flex-col gap-0.5">
                  {activeGroup.ids.map((id) => (
                    <li key={id}>
                      <MetricPickerRow id={id} onPick={onPick} />
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            </DropdownScrollArea>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricPickerRow({ id, onPick }: { id: ChartingMetricId; onPick: (id: ChartingMetricId) => void }) {
  return (
    <button
      type="button"
      role="option"
      className={cn(dropdownMenuRichItemClassName(), "group items-center justify-between gap-2")}
      onClick={() => onPick(id)}
    >
      <span className="truncate">{CHARTING_METRIC_LABEL[id]}</span>
      <Plus
        className="h-4 w-4 shrink-0 text-[#71717A] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        aria-hidden
      />
    </button>
  );
}
