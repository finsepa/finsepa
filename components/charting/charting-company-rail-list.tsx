"use client";

import { X } from "@/lib/icons";

import { CompanyLogo } from "@/components/screener/company-logo";
import { ChartingDataTableSettingsMenu } from "@/components/charting/charting-data-table-settings-menu";
import {
  chartingRailRowActionButtonClass,
  chartingRailRowClass,
} from "@/components/charting/charting-rail-row-styles";
import { cn } from "@/lib/utils";

const chartingRailRemoveButtonClass = chartingRailRowActionButtonClass;

export function ChartingRailCompanyRow({
  ticker,
  onRemove,
  removeDisabled,
}: {
  ticker: string;
  onRemove: () => void;
  removeDisabled?: boolean;
}) {
  return (
    <div className={chartingRailRowClass}>
      <CompanyLogo name={ticker} logoUrl="" symbol={ticker} size="sm" />
      <span className="min-w-0 flex-1 truncate text-[14px] font-normal leading-5 text-[#09090B]">
        {ticker}
      </span>
      {!removeDisabled ? (
        <button
          type="button"
          aria-label={`Remove ${ticker}`}
          onClick={onRemove}
          className={chartingRailRemoveButtonClass}
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

export function ChartingRailMetricRow({
  label,
  color,
  onRemove,
  removeDisabled,
  showBarValues,
  onShowBarValuesChange,
}: {
  label: string;
  color: string;
  onRemove: () => void;
  removeDisabled?: boolean;
  showBarValues?: boolean;
  onShowBarValuesChange?: (next: boolean) => void;
}) {
  const settingsEnabled = showBarValues != null && onShowBarValuesChange != null;

  return (
    <div className={chartingRailRowClass}>
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] bg-white"
        aria-hidden
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
        />
      </span>
      <span className="min-w-0 flex-1 truncate text-[14px] font-normal leading-5 text-[#09090B]">
        {label}
      </span>
      {settingsEnabled ? (
        <ChartingDataTableSettingsMenu
          variant="rail"
          showBarValues={showBarValues}
          onShowBarValuesChange={onShowBarValuesChange}
          metricLabel={label}
        />
      ) : null}
      {!removeDisabled ? (
        <button
          type="button"
          aria-label={`Remove ${label}`}
          onClick={onRemove}
          className={chartingRailRemoveButtonClass}
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
