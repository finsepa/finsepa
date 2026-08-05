"use client";

import type {
  IncomeStatementRowModel,
  IncomeStatementTableModel,
  IncomeStatementValueFormat,
} from "@/lib/market/stock-financials-income-table";
import type { ChartingMetricId } from "@/lib/market/stock-charting-metrics";
import { resolveFinancialsRowChartMetric } from "@/lib/market/stock-financials-row-chart";
import {
  DEFAULT_TABLE_ROW_HOVER_PAD_CLASS,
  SCREENER_TABLE_DATA_ROW_CLASS,
  SCREENER_TABLE_HEADER_STICKY_CLASS,
  SCREENER_TABLE_HEADER_STICKY_SCROLLPORT_CLASS,
  SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
  SCREENER_TABLE_ROUNDED_HEADER_CLASS,
  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
  SCREENER_TABLE_STROKE_INSET_CLASS,
  ScreenerTableScroll,
  TABLE_END_ALIGNED_PAD_CLASS,
  TABLE_START_ALIGNED_PAD_CLASS,
} from "@/components/screener/screener-table-scroll";
import {
  EARNINGS_FORECAST_BADGE_CLASS,
  EARNINGS_FORECAST_BAND_BG_STYLE,
  EARNINGS_FORECAST_BAND_EDGE_STYLE,
} from "@/components/stock/earnings-card-styles";
import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

/**
 * Shared label-column width for Financials / Earnings summary grids and Reports tables
 * so sibling tables on Earnings align on the first column.
 */
export const STOCK_TABLE_LABEL_COL_WIDTH = "14rem";

export function stockTableGridTemplateColumns(dataColumnCount: number): string {
  return `${STOCK_TABLE_LABEL_COL_WIDTH} repeat(${dataColumnCount}, minmax(5.25rem, 1fr))`;
}

/** Min width (px) so quarterly columns don't squash when panning on small screens. */
export function stockTableScrollMinWidthPx(dataColumnCount: number): number {
  const labelPx = 14 * 16;
  const columnPx = 5.25 * 16;
  const gapPx = 8;
  const padPx = 16;
  return Math.ceil(labelPx + dataColumnCount * columnPx + dataColumnCount * gapPx + padPx);
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
  if (tone === "positive") return "text-up";
  if (tone === "negative") return "text-down";
  return "text-fg";
}

const numCellClass = cn(
  "flex min-h-full min-w-0 w-full items-center justify-end self-stretch text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-fg",
  TABLE_END_ALIGNED_PAD_CLASS,
);

const headerYearClass = cn(
  "relative z-[1] min-w-0 w-full truncate bg-surface text-right font-['Inter'] text-[14px] font-medium leading-5 tabular-nums text-fg-muted",
  TABLE_END_ALIGNED_PAD_CLASS,
);

const headerPeriodEndClass = cn(
  "relative z-[1] min-w-0 w-full truncate bg-surface text-right font-['Inter'] text-[14px] font-medium leading-5 tabular-nums text-fg-muted",
  TABLE_END_ALIGNED_PAD_CLASS,
);

/** Sticky label column — stays put on horizontal scroll inside the financials scroller.
 * 12px left inset via {@link TABLE_START_ALIGNED_PAD_CLASS}.
 */
const stickyLabelHeadClass = cn(
  "sticky left-0 z-40 flex min-h-full min-w-0 items-center self-stretch bg-surface pr-4 text-left font-['Inter'] text-[14px] font-medium leading-5 text-fg-muted",
  TABLE_START_ALIGNED_PAD_CLASS,
);

const stickyLabelBodyClass = cn(
  "sticky left-0 z-20 flex min-h-full min-w-0 items-center self-stretch bg-surface pr-4 text-left group-hover/row:bg-table-row-hover",
  TABLE_START_ALIGNED_PAD_CLASS,
);

/** Vertical rule between sticky labels and year columns — Financials only. */
const stickyLabelColumnRuleClass =
  "border-r border-table-row-stroke shadow-[1px_0_0_0_var(--fs-table-row-stroke)]";

const headerValueCellClass = "relative z-[1] flex min-h-full min-w-0 items-center justify-end self-stretch bg-surface";

/** Forecast columns — mute via color (not opacity) so sticky headers stay above body paint. */
const forecastMuteClass = "text-fg-subtle";

function forecastColumnStyle(isForecast: boolean | undefined, isFirstForecast: boolean): CSSProperties | undefined {
  if (!isForecast) return undefined;
  return {
    ...EARNINGS_FORECAST_BAND_BG_STYLE,
    ...(isFirstForecast ? EARNINGS_FORECAST_BAND_EDGE_STYLE : undefined),
    // Extend through the grid's 8px column gap, while keeping breathing room after each value.
    width: "calc(100% + 8px)",
    paddingRight: 8,
    boxSizing: "border-box",
  };
}

/** Matches {@link ScreenerTable} / {@link CryptoTable} header band. */
const incomeHeaderRowClass = "min-h-[44px]";

/** Matches screener data row height ({@link ScreenerDataRow}). */
const incomeDataRowClass = "min-h-[60px]";

/** Header / period rules — same inset stroke as screener companies. */
const incomeHeaderBorderClass = "border-b border-solid border-stroke";

export function StockIncomeStatementTable({
  model,
  onMetricClick,
  showPeriodEndingRow = true,
  showLabelColumnRule = false,
  viewportScroll = true,
  scrollAlignEnd = false,
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
  /** Pin horizontal scroll to the latest / forecast columns (Earnings estimates summary). */
  scrollAlignEnd?: boolean;
}) {
  const { columns, columnPeriodEnds, columnIsForecast, rows, ttm, periodColumnHeader } = model;
  const periodHeaderLabel = periodColumnHeader ?? "Fiscal Year";
  const ttmLeading = ttm?.placement === "leading";
  const dataColumnCount = columns.length + (ttm ? 1 : 0);
  const gridTemplateColumns = stockTableGridTemplateColumns(dataColumnCount);
  const labelRule = showLabelColumnRule ? stickyLabelColumnRuleClass : undefined;
  const scrollAlignKey = `${periodHeaderLabel}:${columns.join("|")}`;

  /** Align forecast opacity with annual value indices when TTM is leading or trailing. */
  const forecastByValueIndex = (() => {
    if (!columnIsForecast?.length) return undefined;
    if (!ttm) return columnIsForecast;
    if (ttmLeading) return [false, ...columnIsForecast];
    return [...columnIsForecast, false];
  })();
  const firstForecastValueIndex = forecastByValueIndex?.findIndex(Boolean) ?? -1;
  const forecastColumnCount =
    firstForecastValueIndex >= 0 && forecastByValueIndex
      ? forecastByValueIndex.length - firstForecastValueIndex
      : 0;

  const yearHeaders = columns.map((y, i) => {
    const isForecast = Boolean(columnIsForecast?.[i]);
    const valueIndex = ttmLeading && ttm ? i + 1 : i;
    return (
      <div
        key={`col-${i}`}
        className={cn(
          headerYearClass,
          headerValueCellClass,
          isForecast && "bg-transparent",
          isForecast && forecastMuteClass,
        )}
        style={forecastColumnStyle(isForecast, valueIndex === firstForecastValueIndex)}
      >
        {y}
      </div>
    );
  });
  const periodHeaders = columnPeriodEnds.map((label, i) => {
    const isForecast = Boolean(columnIsForecast?.[i]);
    const valueIndex = ttmLeading && ttm ? i + 1 : i;
    return (
      <div
        key={`period-end-${i}`}
        className={cn(
          headerPeriodEndClass,
          headerValueCellClass,
          isForecast && "bg-transparent",
          isForecast && forecastMuteClass,
        )}
        style={forecastColumnStyle(isForecast, valueIndex === firstForecastValueIndex)}
      >
        {label}
      </div>
    );
  });
  const ttmYearHeader = ttm ? (
    <div className={cn(headerYearClass, headerValueCellClass)}>{ttm.columnLabel}</div>
  ) : null;
  const ttmPeriodHeader = ttm ? (
    <div className={cn(headerPeriodEndClass, headerValueCellClass)}>{ttm.periodEnd}</div>
  ) : null;

  return (
    <ScreenerTableScroll
      mobileScroll
      viewportScroll={viewportScroll}
      scrollAlignEnd={scrollAlignEnd}
      scrollAlignKey={scrollAlignKey}
      tableMinWidthPx={
        scrollAlignEnd || viewportScroll
          ? stockTableScrollMinWidthPx(dataColumnCount)
          : undefined
      }
    >
      <div className="bg-surface">
        <div
          className={cn(
            viewportScroll
              ? SCREENER_TABLE_HEADER_STICKY_SCROLLPORT_CLASS
              : SCREENER_TABLE_HEADER_STICKY_CLASS,
            SCREENER_TABLE_ROUNDED_HEADER_CLASS,
            SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
            "border-b-0 md:border-b-0",
          )}
        >
          <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
            <div
              className={cn(
                "grid items-stretch gap-x-2 bg-surface py-0 pr-0",
                incomeHeaderBorderClass,
                incomeHeaderRowClass,
              )}
              style={{ gridTemplateColumns }}
            >
              <div className={cn(stickyLabelHeadClass, labelRule)}>{periodHeaderLabel}</div>
              {ttmLeading ? ttmYearHeader : null}
              {yearHeaders}
              {!ttmLeading ? ttmYearHeader : null}
            </div>
          </div>
          {showPeriodEndingRow ? (
            <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
              <div
                className={cn(
                  "grid items-stretch gap-x-2 bg-surface py-0 pr-0",
                  incomeHeaderRowClass,
                )}
                style={{ gridTemplateColumns }}
              >
                <div className={cn(stickyLabelHeadClass, labelRule)}>Period Ending</div>
                {ttmLeading ? ttmPeriodHeader : null}
                {periodHeaders}
                {!ttmLeading ? ttmPeriodHeader : null}
              </div>
            </div>
          ) : null}
          <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
        </div>

        <div className="relative z-0">
          {rows.map((row, index) => (
            <IncomeRow
              key={row.id}
              row={row}
              gridTemplateColumns={gridTemplateColumns}
              columnIsForecast={forecastByValueIndex}
              firstForecastIndex={firstForecastValueIndex}
              onMetricClick={onMetricClick}
              showLabelColumnRule={showLabelColumnRule}
              showDivider={index < rows.length - 1}
            />
          ))}
          {firstForecastValueIndex >= 0 && forecastColumnCount > 0 ? (
            <div
              className="pointer-events-none absolute inset-y-0 z-30 flex items-center justify-center"
              style={{
                left: `calc(${STOCK_TABLE_LABEL_COL_WIDTH} + ((100% - ${STOCK_TABLE_LABEL_COL_WIDTH}) * ${firstForecastValueIndex} / ${dataColumnCount}))`,
                width: `calc((100% - ${STOCK_TABLE_LABEL_COL_WIDTH}) * ${forecastColumnCount} / ${dataColumnCount})`,
              }}
              aria-hidden
            >
              <span className={EARNINGS_FORECAST_BADGE_CLASS}>Forecast</span>
            </div>
          ) : null}
        </div>
      </div>
    </ScreenerTableScroll>
  );
}

function IncomeRow({
  row,
  gridTemplateColumns,
  columnIsForecast,
  firstForecastIndex,
  onMetricClick,
  showLabelColumnRule,
  showDivider,
}: {
  row: IncomeStatementRowModel;
  gridTemplateColumns: string;
  columnIsForecast?: boolean[];
  firstForecastIndex: number;
  onMetricClick?: (metricId: ChartingMetricId) => void;
  showLabelColumnRule?: boolean;
  showDivider: boolean;
}) {
  const labelClass = row.emphasize
    ? "text-[14px] font-semibold leading-5 text-fg"
    : "text-[14px] font-normal leading-5 text-fg";

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
        rowInteractive && "underline-offset-2 decoration-fg-muted group-hover/row:underline",
      )}
    >
      <span className="min-w-0 truncate">{row.label}</span>
    </div>
  );

  const valueCells = row.values.map((v, i) => {
    const { text, tone } = formatCell(row.format, v, row.id);
    const isGrowth = row.format === "pctGrowth";
    const growthMissing = isGrowth && (v == null || !Number.isFinite(v));
    const isForecast = Boolean(columnIsForecast?.[i]);
    const hasSub = row.subValues != null;
    const subRaw = hasSub ? (row.subValues![i] ?? null) : null;
    const sub =
      hasSub
        ? formatCell("pctGrowth", subRaw, `${row.id}_growth`)
        : null;
    const subMissing = subRaw == null || !Number.isFinite(subRaw);
    return (
      <div
        key={i}
        className={cn(
          numCellClass,
          hasSub && "flex-col items-end justify-center gap-0.5 py-2",
          isGrowth && (growthMissing ? "text-fg-muted" : toneClass(tone)),
          isForecast && forecastMuteClass,
        )}
        style={forecastColumnStyle(isForecast, i === firstForecastIndex)}
      >
        <span className="block w-full text-right tabular-nums">{text}</span>
        {sub ? (
          <span
            className={cn(
              "block w-full text-right text-[12px] font-normal leading-4 tabular-nums",
              isForecast
                ? forecastMuteClass
                : subMissing
                  ? "text-fg-muted"
                  : toneClass(sub.tone),
            )}
          >
            {sub.text}
          </span>
        ) : null}
      </div>
    );
  });

  const rowSurfaceClass = cn(
    "relative z-0 grid w-full items-stretch gap-x-2 border-0 bg-transparent py-0 pr-0 text-left font-inherit",
    incomeDataRowClass,
    SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
  );

  return (
    <div className={SCREENER_TABLE_DATA_ROW_CLASS}>
      <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
        {rowInteractive ? (
          <button
            type="button"
            className={cn(
              rowSurfaceClass,
              "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-300",
            )}
            style={{ gridTemplateColumns }}
            onClick={() => onMetricClick?.(metricId)}
          >
            {labelCell}
            {valueCells}
          </button>
        ) : (
          <div className={rowSurfaceClass} style={{ gridTemplateColumns }}>
            {labelCell}
            {valueCells}
          </div>
        )}
      </div>
      {showDivider ? <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden /> : null}
    </div>
  );
}
