"use client";

import type { RefObject } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { DropdownScrollArea } from "@/components/design-system/dropdown-scroll-area";
import {
  dropdownMenuPanelBodyClassName,
  dropdownMenuPlainItemClassName,
  dropdownMenuSearchHeaderClassName,
  dropdownMenuSearchInputClassName,
  dropdownMenuSurfaceClassName,
} from "@/components/design-system/dropdown-menu-styles";
import {
  COMPARISON_METRIC_PICKER_GROUPS,
  COMPARISON_TABLE_METRICS_BY_ID,
  type ComparisonTableMetricId,
} from "@/lib/comparison/comparison-table-metrics";
import { Plus } from "@/lib/icons";
import { cn } from "@/lib/utils";

/** Section headers — secondary text so categories read as labels, not rows. */
const metricPickerSectionLabelClass =
  "px-4 pb-1 pt-2 text-[13px] font-medium text-fg-muted";

function MetricPickerSectionLabel({ label }: { label: string }) {
  return <p className={metricPickerSectionLabelClass}>{label}</p>;
}

function metricPickerCategoryButtonClass(active: boolean) {
  return cn(
    dropdownMenuPlainItemClassName(),
    "font-medium",
    active && "bg-dropdown-item-hover",
  );
}

type AddableGroup = {
  id: string;
  label: string;
  ids: ComparisonTableMetricId[];
};

function buildAddableGroups(excludeMetricIds: ComparisonTableMetricId[], query: string): AddableGroup[] {
  const qLower = query.trim().toLowerCase();
  return COMPARISON_METRIC_PICKER_GROUPS.map((g) => {
    const ids = g.metricIds.filter((id) => {
      if (excludeMetricIds.includes(id)) return false;
      const def = COMPARISON_TABLE_METRICS_BY_ID[id];
      if (!def) return false;
      if (!qLower) return true;
      return (
        def.pickerLabel.toLowerCase().includes(qLower) ||
        def.header.toLowerCase().includes(qLower) ||
        g.label.toLowerCase().includes(qLower)
      );
    });
    return { id: g.id, label: g.label, ids };
  }).filter((g) => g.ids.length > 0);
}

export type ComparisonMetricPickerMenuProps = {
  excludeMetricIds: ComparisonTableMetricId[];
  onPick: (id: ComparisonTableMetricId) => void;
  query: string;
  onQueryChange: (query: string) => void;
  className?: string;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  autoFocusSearch?: boolean;
};

export function ComparisonMetricPickerMenu({
  excludeMetricIds,
  onPick,
  query,
  onQueryChange,
  className,
  searchInputRef,
  autoFocusSearch = true,
}: ComparisonMetricPickerMenuProps) {
  const qLower = query.trim().toLowerCase();
  const isSearching = qLower.length > 0;

  const addableGroups = useMemo(
    () => buildAddableGroups(excludeMetricIds, query),
    [excludeMetricIds, query],
  );
  const totalAddable = useMemo(() => addableGroups.reduce((n, g) => n + g.ids.length, 0), [addableGroups]);

  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  const categoriesColumnRef = useRef<HTMLDivElement>(null);
  const [valuesPanelHeight, setValuesPanelHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = categoriesColumnRef.current;
    if (!el) return;
    const syncHeight = () => setValuesPanelHeight(el.offsetHeight);
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
    if (!stillValid) setHoveredGroupId(addableGroups[0]!.id);
  }, [addableGroups, hoveredGroupId]);

  const activeGroup = useMemo(() => {
    if (addableGroups.length === 0) return null;
    const id = hoveredGroupId ?? addableGroups[0]!.id;
    return addableGroups.find((g) => g.id === id) ?? addableGroups[0]!;
  }, [addableGroups, hoveredGroupId]);

  const emptyMessage =
    totalAddable === 0 ? (qLower ? "No matching metrics." : "All metrics already added.") : null;

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
        <div className="px-3 py-6 text-center text-[13px] text-fg">{emptyMessage}</div>
      ) : isSearching ? (
        <DropdownScrollArea
          className={cn(dropdownMenuPanelBodyClassName, "max-h-[min(400px,calc(100vh-12rem))] overflow-y-auto")}
        >
          {addableGroups.map((g) => (
            <div key={g.id} className="py-1">
              <MetricPickerSectionLabel label={g.label} />
              <div className="space-y-1">
                {g.ids.map((id) => (
                  <MetricPickerRow key={id} id={id} onPick={onPick} />
                ))}
              </div>
            </div>
          ))}
        </DropdownScrollArea>
      ) : (
        <div className="flex items-start overflow-hidden">
          <div ref={categoriesColumnRef} className="w-[148px] shrink-0 border-r border-dropdown-divider p-1">
            <MetricPickerSectionLabel label="Categories" />
            <ul className="flex flex-col gap-1">
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
                  <ul className="flex flex-col gap-1">
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

function MetricPickerRow({
  id,
  onPick,
}: {
  id: ComparisonTableMetricId;
  onPick: (id: ComparisonTableMetricId) => void;
}) {
  const def = COMPARISON_TABLE_METRICS_BY_ID[id];
  return (
    <button
      type="button"
      role="option"
      className={cn(dropdownMenuPlainItemClassName(), "group font-medium")}
      onClick={() => onPick(id)}
    >
      <span className="min-w-0 flex-1 truncate">{def?.pickerLabel ?? id}</span>
      <Plus
        className="h-4 w-4 shrink-0 text-fg-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        aria-hidden
      />
    </button>
  );
}
