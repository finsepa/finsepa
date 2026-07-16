"use client";

import type {
  IncomeStatementRowModel,
  IncomeStatementTableModel,
  IncomeStatementValueFormat,
} from "@/lib/market/stock-financials-income-table";
import type { ChartingMetricId } from "@/lib/market/stock-charting-metrics";
import { resolveFinancialsRowChartMetric } from "@/lib/market/stock-financials-row-chart";
import {
  SCREENER_TABLE_HEADER_STICKY_CLASS,
  SCREENER_TABLE_HEADER_STICKY_SCROLLPORT_CLASS,
  ScreenerTableScroll,
} from "@/components/screener/screener-table-scroll";
import { cn } from "@/lib/utils";

/**
 * Shared label-column width for Financials / Earnings summary grids and Reports tables
 * so sibling tables on Earnings align on the first column.
 */
export const STOCK_TABLE_LABEL_COL_WIDTH = "14rem";

export function stockTableGridTemplateColumns(dataColumnCount: number): string {
  return `${STOCK_TABLE_LABEL_COL_WIDTH} repeat(${dataColumnCount}, minmax(5.25rem, 1fr))`;
}

const pct2 = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const ratio2 = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
  useGrouping: false,
});

/** USD / share-count amounts: `B` or `M`, at most 2 fraction digits, no thousands separators. */
const usdScale2 = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
  useGrouping: false,
});

function formatUsdBillionsOrMillions(v: number): string {
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  if (abs >= 1e9) {
    return `${sign}${usdScale2.format(abs / 1e9)}B`;
  }
  return `${sign}${usdScale2.format(abs / 1e6)}M`;
}

function formatPerShare(v: number): string {
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Share counts (raw units): compact `20.44B` / `185.96M`, not `20,000.44M`. */
function formatShares(v: number): string {
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  if (abs >= 1e9) {
    return `${sign}${usdScale2.format(abs / 1e9)}B`;
  }
  return `${sign}${usdScale2.format(abs / 1e6)}M`;
}

function formatCell(
  format: IncomeStatementValueFormat,
  v: number | null,
  rowId: string,
): { text: string; tone: "neutral" | "positive" | "negative" } {
  if (v == null || !Number.isFinite(v)) return { text: "-", tone: "neutral" };
  switch (format) {
    case "usd":
      return { text: formatUsdBillionsOrMillions(v), tone: "neutral" };
    case "perShare":
      return { text: formatPerShare(v), tone: "neutral" };
    case "shares":
      return { text: formatShares(v), tone: "neutral" };
    case "pctMargin":
      return { text: `${pct2.format(v)}%`, tone: "neutral" };
    case "ratio":
      return { text: ratio2.format(v), tone: "neutral" };
    case "pctGrowth": {
      const t = `${v > 0 ? "+" : ""}${pct2.format(v)}%`;
      if (rowId === "shares_change") {
        if (v < 0) return { text: t, tone: "positive" };
        if (v > 0) return { text: t, tone: "negative" };
        return { text: t, tone: "neutral" };
      }
      if (v > 0) return { text: t, tone: "positive" };
      if (v < 0) return { text: t, tone: "negative" };
      return { text: t, tone: "neutral" };
    }
    default:
      return { text: String(v), tone: "neutral" };
  }
}

function toneClass(tone: "neutral" | "positive" | "negative"): string {
  if (tone === "positive") return "text-[#16A34A]";
  if (tone === "negative") return "text-[#DC2626]";
  return "text-[#09090B]";
}

const numCellClass =
  "min-w-0 w-full text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-[#09090B]";

const headerYearClass =
  "relative z-[1] min-w-0 w-full truncate bg-white text-right font-['Inter'] text-[12px] font-medium leading-5 tabular-nums text-[#71717A] sm:text-[14px]";

const headerPeriodEndClass =
  "relative z-[1] min-w-0 w-full truncate bg-white text-right font-['Inter'] text-[12px] font-medium leading-5 tabular-nums text-[#71717A] sm:text-[14px]";

/** Sticky label column — stays put on horizontal scroll inside the financials scroller. */
const stickyLabelHeadClass =
  "sticky left-0 z-40 flex min-h-full min-w-0 items-center self-stretch bg-white pl-2 pr-4 text-left font-['Inter'] text-[12px] font-medium leading-5 text-[#71717A] sm:pl-4 sm:text-[14px]";

const stickyLabelBodyClass =
  "sticky left-0 z-20 flex min-h-full min-w-0 items-center self-stretch bg-white pl-2 pr-4 text-left group-hover:bg-neutral-50 sm:pl-4";

/** Vertical rule between sticky labels and year columns — Financials only. */
const stickyLabelColumnRuleClass =
  "border-r border-[#E4E4E7] shadow-[1px_0_0_0_#E4E4E7]";

const headerValueCellClass = "relative z-[1] flex min-h-full min-w-0 items-center justify-end self-stretch bg-white";

/** Forecast columns — mute via color (not opacity) so sticky headers stay above body paint. */
const forecastMuteClass = "text-[#A1A1AA]";

/** Matches {@link ScreenerTable} / {@link CryptoTable} header band. */
const incomeHeaderRowClass = "min-h-[44px]";

/** Matches screener data row height and hover ({@link ScreenerDataRow}). */
const incomeDataRowClass = "group min-h-[60px]";

/** Full-width row separator (`divide-y` is overridden by `border-0` on button rows). */
const incomeRowDividerClass = "border-b border-[#E4E4E7]";

export function StockIncomeStatementTable({
  model,
  onMetricClick,
  showPeriodEndingRow = true,
  showLabelColumnRule = false,
  viewportScroll = true,
}: {
  model: IncomeStatementTableModel;
  /** Opens the same fundamentals chart modal as Overview Key Stats when the row maps to a charting metric. */
  onMetricClick?: (metricId: ChartingMetricId) => void;
  showPeriodEndingRow?: boolean;
  /** Vertical divider after the sticky label column (Financials). Off for Earnings tables. */
  showLabelColumnRule?: boolean;
  /**
   * Cap height to the viewport with nested overflow (Financials). Off for short Earnings
   * summary tables — nested scrollports flash a scrollbar while the page scrolls.
   */
  viewportScroll?: boolean;
}) {
  const { columns, columnPeriodEnds, columnIsForecast, rows, ttm, periodColumnHeader } = model;
  const periodHeaderLabel = periodColumnHeader ?? "Fiscal Year";
  const ttmLeading = ttm?.placement === "leading";
  const dataColumnCount = columns.length + (ttm ? 1 : 0);
  const gridTemplateColumns = stockTableGridTemplateColumns(dataColumnCount);
  const labelRule = showLabelColumnRule ? stickyLabelColumnRuleClass : undefined;

  /** Align forecast opacity with annual value indices when TTM is leading or trailing. */
  const forecastByValueIndex = (() => {
    if (!columnIsForecast?.length) return undefined;
    if (!ttm) return columnIsForecast;
    if (ttmLeading) return [false, ...columnIsForecast];
    return [...columnIsForecast, false];
  })();

  const yearHeaders = columns.map((y, i) => (
    <div
      key={`col-${i}`}
      className={cn(
        headerYearClass,
        headerValueCellClass,
        columnIsForecast?.[i] && forecastMuteClass,
      )}
    >
      {y}
    </div>
  ));
  const periodHeaders = columnPeriodEnds.map((label, i) => (
    <div
      key={`period-end-${i}`}
      className={cn(
        headerPeriodEndClass,
        headerValueCellClass,
        columnIsForecast?.[i] && forecastMuteClass,
      )}
    >
      {label}
    </div>
  ));
  const ttmYearHeader = ttm ? (
    <div className={cn(headerYearClass, headerValueCellClass)}>{ttm.columnLabel}</div>
  ) : null;
  const ttmPeriodHeader = ttm ? (
    <div className={cn(headerPeriodEndClass, headerValueCellClass)}>{ttm.periodEnd}</div>
  ) : null;

  return (
    <ScreenerTableScroll mobileScroll viewportScroll={viewportScroll}>
      <div className="bg-white">
        <div
          className={
            viewportScroll
              ? SCREENER_TABLE_HEADER_STICKY_SCROLLPORT_CLASS
              : SCREENER_TABLE_HEADER_STICKY_CLASS
          }
        >
          <div
            className={`grid items-stretch gap-x-2 border-b border-[#E4E4E7] bg-white py-0 pr-2 sm:pr-4 ${incomeHeaderRowClass}`}
            style={{ gridTemplateColumns }}
          >
            <div className={cn(stickyLabelHeadClass, labelRule)}>{periodHeaderLabel}</div>
            {ttmLeading ? ttmYearHeader : null}
            {yearHeaders}
            {!ttmLeading ? ttmYearHeader : null}
          </div>
          {showPeriodEndingRow ? (
            <div
              className={`grid items-stretch gap-x-2 border-b border-[#E4E4E7] bg-white py-0 pr-2 sm:pr-4 ${incomeHeaderRowClass}`}
              style={{ gridTemplateColumns }}
            >
              <div className={cn(stickyLabelHeadClass, labelRule)}>Period Ending</div>
              {ttmLeading ? ttmPeriodHeader : null}
              {periodHeaders}
              {!ttmLeading ? ttmPeriodHeader : null}
            </div>
          ) : null}
        </div>

        <div className="relative z-0">
          {rows.map((row) => (
            <IncomeRow
              key={row.id}
              row={row}
              gridTemplateColumns={gridTemplateColumns}
              columnIsForecast={forecastByValueIndex}
              onMetricClick={onMetricClick}
              showLabelColumnRule={showLabelColumnRule}
            />
          ))}
        </div>
      </div>
    </ScreenerTableScroll>
  );
}

function IncomeRow({
  row,
  gridTemplateColumns,
  columnIsForecast,
  onMetricClick,
  showLabelColumnRule,
}: {
  row: IncomeStatementRowModel;
  gridTemplateColumns: string;
  columnIsForecast?: boolean[];
  onMetricClick?: (metricId: ChartingMetricId) => void;
  showLabelColumnRule?: boolean;
}) {
  const labelClass = row.emphasize
    ? "text-[14px] font-semibold leading-5 text-[#09090B]"
    : "text-[14px] font-normal leading-5 text-[#09090B]";

  const nestedLabelPad =
    row.id === "fcf_ps" || row.id === "fcf_margin" ? "pl-3 sm:pl-6" : "";

  const metricId = resolveFinancialsRowChartMetric(row);
  const rowInteractive = typeof onMetricClick === "function" && metricId != null;

  const labelCell = (
    <div
      className={cn(
        stickyLabelBodyClass,
        showLabelColumnRule && stickyLabelColumnRuleClass,
        nestedLabelPad,
        labelClass,
        rowInteractive && "group-hover:underline",
      )}
    >
      <span className="min-w-0 truncate">{row.label}</span>
    </div>
  );

  const valueCells = row.values.map((v, i) => {
    const { text, tone } = formatCell(row.format, v, row.id);
    const isGrowth = row.format === "pctGrowth";
    const growthMissing = isGrowth && (v == null || !Number.isFinite(v));
    return (
      <div
        key={i}
        className={cn(
          numCellClass,
          "flex min-h-full items-center justify-end truncate self-stretch",
          isGrowth && "font-medium",
          isGrowth && (growthMissing ? "text-[#71717A]" : toneClass(tone)),
          columnIsForecast?.[i] && forecastMuteClass,
        )}
      >
        {text}
      </div>
    );
  });

  if (rowInteractive) {
    return (
      <button
        type="button"
        className={cn(
          "group relative z-0 grid w-full cursor-pointer items-stretch gap-x-2 border-x-0 border-t-0 bg-white py-0 pr-2 text-left font-inherit transition-colors duration-75 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-300 sm:pr-4",
          incomeRowDividerClass,
          incomeDataRowClass,
        )}
        style={{ gridTemplateColumns }}
        onClick={() => onMetricClick?.(metricId)}
      >
        {labelCell}
        {valueCells}
      </button>
    );
  }

  return (
    <div
      className={`group relative z-0 grid items-stretch gap-x-2 bg-white py-0 pr-2 transition-colors duration-75 hover:bg-neutral-50 sm:pr-4 ${incomeRowDividerClass} ${incomeDataRowClass}`}
      style={{ gridTemplateColumns }}
    >
      {labelCell}
      {valueCells}
    </div>
  );
}
