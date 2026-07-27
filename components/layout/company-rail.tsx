"use client";

import { forwardRef, type RefObject } from "react";
import { Plus } from "@/lib/icons";

import {
  ChartingRailCompanyRow,
  ChartingRailMetricRow,
} from "@/components/charting/charting-company-rail-list";
import {
  companyRailListClass,
  companyRailRowClass,
  companyRailTitleClass,
} from "@/components/charting/charting-rail-row-styles";
import { useChartingCompanyRail } from "@/components/charting/charting-company-rail-context";
import { TopbarDelayedTooltip } from "@/components/layout/topbar-delayed-tooltip";
import { SIDEBAR_OUTER_EXPANDED_PX } from "@/components/layout/sidebar-layout-context";
import { shellChromeToggleButtonClass } from "@/components/layout/shell-chrome-toggle-button";
import { cn } from "@/lib/utils";

/** White card — same stroke / shadow as screener inset containers. */
const companyRailCardClass =
  "flex w-full flex-col overflow-hidden rounded-2xl border border-[#EBEBEC] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.04)]";

/** Fit-content body; 8px pad; scroll only when the list exceeds the viewport. */
const companyRailBodyClass =
  "flex max-h-[calc(100dvh-5rem)] flex-col overflow-y-auto overscroll-y-contain p-2";

const companyRailDividerClass = "mx-3 my-2 h-px shrink-0 bg-[#EFEFEF]";

const CompanyRailAddButton = forwardRef<
  HTMLButtonElement,
  {
    label: string;
    disabled?: boolean;
    onClick: () => void;
  }
>(function CompanyRailAddButton({ label, disabled, onClick }, ref) {
  return (
    <TopbarDelayedTooltip label={label} placement="left">
      <button
        ref={ref}
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className={cn(shellChromeToggleButtonClass, disabled && "cursor-not-allowed opacity-40")}
      >
        <Plus className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
      </button>
    </TopbarDelayedTooltip>
  );
});

function CompanyRailLabelRow({
  title,
  addLabel,
  addDisabled,
  onAdd,
  addButtonRef,
  className,
}: {
  title: string;
  addLabel: string;
  addDisabled?: boolean;
  onAdd: () => void;
  addButtonRef: RefObject<HTMLButtonElement | null>;
  className?: string;
}) {
  return (
    <div className={cn(companyRailRowClass, className)}>
      <div className="relative flex min-w-0 flex-1 shrink-0">
        <span className={companyRailTitleClass}>
          <span className="truncate">{title}</span>
        </span>
      </div>
      <CompanyRailAddButton
        ref={addButtonRef}
        label={addLabel}
        disabled={addDisabled}
        onClick={onAdd}
      />
    </div>
  );
}

/**
 * Company / Metric picker card — sits in the main panel’s right column on Charting & Comparison.
 */
export function CompanyRailCard({
  className,
  showMetrics = true,
}: {
  className?: string;
  showMetrics?: boolean;
}) {
  const { registration, metricAddAnchorRef, companyAddAnchorRef } = useChartingCompanyRail();

  const metricDisabled = !registration || registration.metricAddDisabled;
  const companyDisabled = !registration || registration.companyAddDisabled;
  const companies = registration?.companies ?? [];
  const metrics = registration?.metrics ?? [];

  return (
    <aside
      className={cn("w-full shrink-0", className)}
      style={{ maxWidth: `${SIDEBAR_OUTER_EXPANDED_PX}px` }}
      aria-label="Company panel"
    >
      <div className={companyRailCardClass}>
        <div className={companyRailBodyClass}>
          <CompanyRailLabelRow
            title="Company"
            addLabel="Add company"
            addDisabled={companyDisabled}
            onAdd={() => registration?.openCompanyPicker()}
            addButtonRef={companyAddAnchorRef}
          />
          {companies.length > 0 ? (
            <div className={companyRailListClass}>
              {companies.map(({ ticker, removeDisabled }) => (
                <ChartingRailCompanyRow
                  key={ticker}
                  ticker={ticker}
                  onRemove={() => registration?.onRemoveCompany?.(ticker)}
                  removeDisabled={removeDisabled || !registration?.onRemoveCompany}
                />
              ))}
            </div>
          ) : null}
          {showMetrics ? (
            <>
              <div className={companyRailDividerClass} aria-hidden />
              <CompanyRailLabelRow
                title="Metric"
                addLabel="Add metric"
                addDisabled={metricDisabled}
                onAdd={() => registration?.openMetricPicker()}
                addButtonRef={metricAddAnchorRef}
              />
              {metrics.length > 0 ? (
                <div className={companyRailListClass}>
                  {metrics.map(({ id, label, color, removeDisabled, showBarValues }) => (
                    <ChartingRailMetricRow
                      key={id}
                      label={label}
                      color={color}
                      showBarValues={showBarValues}
                      onShowBarValuesChange={
                        registration?.onShowBarValuesChange
                          ? (next) => registration.onShowBarValuesChange!(id, next)
                          : undefined
                      }
                      onRemove={() => registration?.onRemoveMetric?.(id)}
                      removeDisabled={removeDisabled || !registration?.onRemoveMetric}
                    />
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

/** @deprecated Shell left rail removed — use {@link CompanyRailCard} in the page layout. */
export function CompanyRail() {
  return null;
}
