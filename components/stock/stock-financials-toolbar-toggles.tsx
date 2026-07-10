"use client";

import {
  SegmentedControl,
  type SegmentedControlOption,
  whiteSurfaceButtonBorderClass,
  whiteSurfaceButtonShadowClass,
} from "@/components/design-system";
import { FinancialsColumnOrderToggle } from "@/components/stock/financials-column-order-toggle";
import { FormListboxSelect } from "@/components/ui/form-listbox-select";
import type { FundamentalsSeriesMode } from "@/lib/market/charting-series-types";
import {
  FINANCIALS_STATEMENT_OPTIONS,
  type FinancialsStatementView,
} from "@/components/stock/stock-financials-segmented-toggle";
import {
  FINANCIALS_TABLE_TIME_RANGE_LABELS,
  FINANCIALS_TABLE_TIME_RANGE_ORDER,
  type FinancialsTableTimeRange,
} from "@/lib/market/stock-financials-time-range";

export const FINANCIALS_PERIOD_OPTIONS: readonly SegmentedControlOption<FundamentalsSeriesMode>[] = [
  { value: "annual", label: "Annual" },
  { value: "quarterly", label: "Quarterly" },
];

export const FINANCIALS_TIME_RANGE_OPTIONS: readonly SegmentedControlOption<FinancialsTableTimeRange>[] =
  FINANCIALS_TABLE_TIME_RANGE_ORDER.map((value) => ({
    value,
    label: FINANCIALS_TABLE_TIME_RANGE_LABELS[value],
  }));

export function StockFinancialsPeriodToggle({
  value,
  onChange,
}: {
  value: FundamentalsSeriesMode;
  onChange: (next: FundamentalsSeriesMode) => void;
}) {
  return (
    <SegmentedControl
      options={FINANCIALS_PERIOD_OPTIONS}
      value={value}
      onChange={onChange}
      size="sm"
      aria-label="Reporting period"
      className="min-w-min shrink-0 flex-nowrap"
    />
  );
}

const FINANCIALS_MOBILE_LISTBOX_TRIGGER_CLASS = `${whiteSurfaceButtonBorderClass} bg-white ${whiteSurfaceButtonShadowClass} hover:bg-[#FAFAFA]`;

/** Mobile: statement, range, period, and column-order on one row (compact listboxes). */
export function StockFinancialsMobileToolbar({
  view,
  onViewChange,
  periodMode,
  onPeriodModeChange,
  timeRange,
  onTimeRangeChange,
  showColumnOrder,
  columnsNewestFirst,
  onColumnOrderToggle,
}: {
  view: FinancialsStatementView;
  onViewChange: (next: FinancialsStatementView) => void;
  periodMode: FundamentalsSeriesMode;
  onPeriodModeChange: (next: FundamentalsSeriesMode) => void;
  timeRange: FinancialsTableTimeRange;
  onTimeRangeChange: (next: FinancialsTableTimeRange) => void;
  showColumnOrder: boolean;
  columnsNewestFirst: boolean;
  onColumnOrderToggle: () => void;
}) {
  return (
    <div
      className={
        showColumnOrder
          ? "grid min-w-0 grid-cols-[minmax(0,1.15fr)_minmax(0,0.72fr)_minmax(0,0.88fr)_2.25rem] items-center gap-1.5 sm:hidden"
          : "grid min-w-0 grid-cols-[minmax(0,1.15fr)_minmax(0,0.72fr)_minmax(0,0.88fr)] items-center gap-1.5 sm:hidden"
      }
    >
      <FormListboxSelect
        compact
        className="min-w-0"
        value={view}
        onChange={onViewChange}
        options={FINANCIALS_STATEMENT_OPTIONS}
        aria-label="Financial statement category"
        triggerClassName={FINANCIALS_MOBILE_LISTBOX_TRIGGER_CLASS}
      />
      <FormListboxSelect
        compact
        menuAlign="trailing"
        className="min-w-0"
        value={timeRange}
        onChange={onTimeRangeChange}
        options={FINANCIALS_TIME_RANGE_OPTIONS}
        aria-label="Financials history range in years"
        triggerClassName={FINANCIALS_MOBILE_LISTBOX_TRIGGER_CLASS}
      />
      <FormListboxSelect
        compact
        menuAlign="trailing"
        className="min-w-0"
        value={periodMode}
        onChange={onPeriodModeChange}
        options={FINANCIALS_PERIOD_OPTIONS}
        aria-label="Reporting period"
        triggerClassName={FINANCIALS_MOBILE_LISTBOX_TRIGGER_CLASS}
      />
      {showColumnOrder ? (
        <FinancialsColumnOrderToggle
          reversed={columnsNewestFirst}
          onToggle={onColumnOrderToggle}
        />
      ) : null}
    </div>
  );
}

export function StockFinancialsTimeRangeToggle({
  value,
  onChange,
}: {
  value: FinancialsTableTimeRange;
  onChange: (next: FinancialsTableTimeRange) => void;
}) {
  return (
    <div className="-mx-1 min-w-0 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch] sm:mx-0 sm:overflow-visible sm:pb-0">
      <SegmentedControl
        options={FINANCIALS_TIME_RANGE_OPTIONS}
        value={value}
        onChange={onChange}
        size="sm"
        aria-label="Financials history range in years"
        className="min-w-min flex-nowrap"
      />
    </div>
  );
}
