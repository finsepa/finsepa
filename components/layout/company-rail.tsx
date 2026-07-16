"use client";

import { usePathname } from "next/navigation";
import { forwardRef, type RefObject } from "react";
import { Plus } from "@/lib/icons";

import {
  ChartingRailCompanyRow,
  ChartingRailMetricRow,
} from "@/components/charting/charting-company-rail-list";
import {
  companyRailListClass,
  companyRailRowClass,
  companyRailScrollClass,
  companyRailTitleClass,
} from "@/components/charting/charting-rail-row-styles";
import {
  useChartingCompanyRail,
  useChartingCompanyRailDesktopShell,
  isCompanyRailPage,
} from "@/components/charting/charting-company-rail-context";
import { TopbarDelayedTooltip } from "@/components/layout/topbar-delayed-tooltip";
import { SIDEBAR_OUTER_EXPANDED_PX } from "@/components/layout/sidebar-layout-context";
import { shellChromeToggleButtonClass } from "@/components/layout/shell-chrome-toggle-button";
import { cn } from "@/lib/utils";

const companyRailSurfaceClass =
  "flex h-full min-h-0 flex-col overflow-hidden bg-white md:rounded-none";

const companyRailDividerClass = "mx-3 my-2 h-px shrink-0 bg-[#E4E4E7]";
const CompanyRailAddButton = forwardRef<
  HTMLButtonElement,
  {
    label: string;
    disabled?: boolean;
    onClick: () => void;
  }
>(function CompanyRailAddButton({ label, disabled, onClick }, ref) {
  return (
    <TopbarDelayedTooltip label={label} placement="right">
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

export function CompanyRail() {
  const pathname = usePathname();
  const isDesktop = useChartingCompanyRailDesktopShell();
  const { registration, metricAddAnchorRef, companyAddAnchorRef } = useChartingCompanyRail();

  if (!isCompanyRailPage(pathname) || !isDesktop) {
    return null;
  }

  const showMetrics = isCompanyRailPage(pathname);

  const metricDisabled = !registration || registration.metricAddDisabled;
  const companyDisabled = !registration || registration.companyAddDisabled;
  const companies = registration?.companies ?? [];
  const metrics = registration?.metrics ?? [];

  return (
    <div
      suppressHydrationWarning
      className={cn(
        "flex h-full min-h-0 shrink-0 self-stretch overflow-hidden border-r border-[#E4E4E7]",
      )}
      style={{ width: `${SIDEBAR_OUTER_EXPANDED_PX}px` }}
      aria-label="Company panel"
    >
      <div className={companyRailSurfaceClass} style={{ width: `${SIDEBAR_OUTER_EXPANDED_PX}px` }}>
        <div className={companyRailScrollClass}>
          <CompanyRailLabelRow
            title="Company"
            addLabel="Add company"
            addDisabled={companyDisabled}
            onAdd={() => registration?.openCompanyPicker()}
            addButtonRef={companyAddAnchorRef}
            className="pt-3"
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
    </div>
  );
}
