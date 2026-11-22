"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type UIEvent,
} from "react";

import type {
  IncomeStatementRowModel,
  IncomeStatementTableModel,
  IncomeStatementValueFormat,
} from "@/lib/market/stock-financials-income-table";
import type { ChartingMetricId } from "@/lib/market/stock-charting-metrics";
import { resolveFinancialsRowChartMetric } from "@/lib/market/stock-financials-row-chart";
import { MOBILE_CARD_SURFACE_CLASS } from "@/components/design-system/card-surface-styles";
import {
  SCREENER_TABLE_DATA_ROW_CLASS,
  SCREENER_TABLE_HEADER_STICKY_CLASS,
  SCREENER_TABLE_HEADER_STICKY_SCROLLPORT_CLASS,
  SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
  SCREENER_TABLE_OUTER_BORDER_CLASS,
  SCREENER_TABLE_ROUNDED_HEADER_CLASS,
  SCREENER_TABLE_ROW_HOVER_PAD_END_CLASS,
  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
  SCREENER_TABLE_SCROLL_PAD_START_CLASS,
  SCREENER_TABLE_STICKY_LABEL_RULE_CLASS,
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
import { AppCheckbox } from "@/components/ui/app-checkbox";
import { cn } from "@/lib/utils";

const H_SCROLL_CLASS = cn(
  "overflow-x-auto overflow-y-hidden overscroll-x-contain [-webkit-overflow-scrolling:touch]",
  "[scrollbar-width:thin] [scrollbar-color:#A1A1AA_transparent]",
  "max-md:[-ms-overflow-style:none] max-md:[scrollbar-width:none]",
  SCREENER_TABLE_SCROLL_PAD_START_CLASS,
);

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
 * Start inset comes from the scrollport pad; left radius matches the row hover wash.
 */
const stickyLabelHeadClass = cn(
  "sticky left-0 z-40 flex min-h-full min-w-0 items-center self-stretch bg-surface pr-4 text-left font-['Inter'] text-[14px] font-medium leading-5 text-fg-muted",
  TABLE_START_ALIGNED_PAD_CLASS,
);

const stickyLabelBodyClass = cn(
  "sticky left-0 z-20 flex min-h-full min-w-0 items-center self-stretch bg-surface pr-4 text-left md:rounded-l-[10px] group-hover/row:bg-table-row-hover",
  TABLE_START_ALIGNED_PAD_CLASS,
);

/** Vertical rule between sticky labels and year columns — Financials only. */
const stickyLabelColumnRuleClass = SCREENER_TABLE_STICKY_LABEL_RULE_CLASS;

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
  chartMetricSelection,
  showPeriodEndingRow = true,
  showLabelColumnRule = false,
  viewportScroll = false,
  scrollAlignEnd = false,
}: {
  model: IncomeStatementTableModel;
  /** Opens the same fundamentals chart modal as Overview Key Stats when the row maps to a charting metric. */
  onMetricClick?: (metricId: ChartingMetricId) => void;
  /**
   * Financials + chart: checkboxes on chartable rows. When set, row click toggles selection
   * instead of opening the Key Stats modal.
   */
  chartMetricSelection?: {
    selected: ReadonlySet<ChartingMetricId>;
    onToggle: (metricId: ChartingMetricId) => void;
  };
  showPeriodEndingRow?: boolean;
  /** Vertical divider after the sticky label column (Financials). Off for Earnings tables. */
  showLabelColumnRule?: boolean;
  /**
   * Nested viewport max-height scroll (legacy). Prefer `false` so Fiscal Year / Period Ending
   * stick on page scroll like screener — header sits outside the body horizontal scroller.
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
  const tableMinWidthPx = stockTableScrollMinWidthPx(dataColumnCount);
  const labelRule = showLabelColumnRule ? stickyLabelColumnRuleClass : undefined;
  const scrollAlignKey = `${periodHeaderLabel}:${columns.join("|")}`;

  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const syncingScrollRef = useRef(false);
  const [canScrollX, setCanScrollX] = useState(false);

  const pinScrollEnd = useCallback(() => {
    for (const el of [headerScrollRef.current, bodyScrollRef.current]) {
      if (!el) continue;
      el.scrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
    }
  }, []);

  const measureScrollX = useCallback(() => {
    const el = bodyScrollRef.current ?? headerScrollRef.current;
    if (!el) return;
    setCanScrollX(el.scrollWidth > el.clientWidth + 1);
  }, []);

  const syncFrom = useCallback((source: HTMLDivElement) => {
    if (syncingScrollRef.current) return;
    const target =
      source === headerScrollRef.current ? bodyScrollRef.current : headerScrollRef.current;
    if (!target) return;
    syncingScrollRef.current = true;
    target.scrollLeft = source.scrollLeft;
    requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });
  }, []);

  const onHeaderScroll = useCallback(
    (e: UIEvent<HTMLDivElement>) => syncFrom(e.currentTarget),
    [syncFrom],
  );
  const onBodyScroll = useCallback(
    (e: UIEvent<HTMLDivElement>) => syncFrom(e.currentTarget),
    [syncFrom],
  );

  useLayoutEffect(() => {
    if (viewportScroll) return;
    measureScrollX();
    if (scrollAlignEnd) pinScrollEnd();
  }, [viewportScroll, scrollAlignEnd, scrollAlignKey, measureScrollX, pinScrollEnd, rows.length]);

  useEffect(() => {
    if (viewportScroll) return;
    const body = bodyScrollRef.current;
    if (!body) return;
    const ro = new ResizeObserver(() => {
      measureScrollX();
      if (!scrollAlignEnd) return;
      const max = Math.max(0, body.scrollWidth - body.clientWidth);
      if (body.scrollLeft >= max - 2) pinScrollEnd();
    });
    ro.observe(body);
    const first = body.firstElementChild;
    if (first) ro.observe(first);
    return () => ro.disconnect();
  }, [viewportScroll, scrollAlignEnd, scrollAlignKey, measureScrollX, pinScrollEnd]);

  /** Hover + wheel → horizontal pan on the body scroller. */
  useEffect(() => {
    if (viewportScroll) return;
    const el = bodyScrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 1) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (e.deltaY === 0) return;
      const next = Math.min(max, Math.max(0, el.scrollLeft + e.deltaY));
      if (next === el.scrollLeft) return;
      e.preventDefault();
      el.scrollLeft = next;
      syncFrom(el);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [viewportScroll, scrollAlignKey, syncFrom]);

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

  const headerBlock = (
    <>
      <div className={SCREENER_TABLE_ROW_HOVER_PAD_END_CLASS}>
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
        <div className={SCREENER_TABLE_ROW_HOVER_PAD_END_CLASS}>
          <div
            className={cn("grid items-stretch gap-x-2 bg-surface py-0 pr-0", incomeHeaderRowClass)}
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
    </>
  );

  const bodyBlock = (
    <div className="relative z-0">
      {rows.map((row, index) => (
        <IncomeRow
          key={row.id}
          row={row}
          gridTemplateColumns={gridTemplateColumns}
          columnIsForecast={forecastByValueIndex}
          firstForecastIndex={firstForecastValueIndex}
          onMetricClick={onMetricClick}
          chartMetricSelection={chartMetricSelection}
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
  );

  // Nested max-height scrollport (optional legacy).
  if (viewportScroll) {
    return (
      <ScreenerTableScroll
        mobileScroll
        viewportScroll
        scrollAlignEnd={scrollAlignEnd}
        scrollAlignKey={scrollAlignKey}
        tableMinWidthPx={tableMinWidthPx}
      >
        <div className="bg-surface">
          <div
            className={cn(
              SCREENER_TABLE_HEADER_STICKY_SCROLLPORT_CLASS,
              SCREENER_TABLE_ROUNDED_HEADER_CLASS,
              SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
              "border-b-0 md:border-b-0",
            )}
          >
            {headerBlock}
          </div>
          {bodyBlock}
        </div>
      </ScreenerTableScroll>
    );
  }

  // Page-sticky header (like screener) + synced horizontal body scroll — no fixed table height.
  return (
    <div
      className={cn(
        "w-full min-w-0 max-w-full rounded-2xl bg-surface",
        SCREENER_TABLE_OUTER_BORDER_CLASS,
        "md:border-transparent md:shadow-card",
        MOBILE_CARD_SURFACE_CLASS,
      )}
    >
      <div
        className={cn(
          SCREENER_TABLE_HEADER_STICKY_CLASS,
          SCREENER_TABLE_ROUNDED_HEADER_CLASS,
          SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
          // Clip header fill to the card radius (sticky escapes the outer card’s overflow-clip).
          "overflow-hidden border-b-0 md:border-b-0",
        )}
      >
        <div
          ref={headerScrollRef}
          onScroll={onHeaderScroll}
          className={cn(
            H_SCROLL_CLASS,
            // Hide header scrollbar — body owns the track; scrollLeft stays synced.
            "bg-surface [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          )}
        >
          <div className="bg-surface" style={{ minWidth: tableMinWidthPx }}>
            {headerBlock}
          </div>
        </div>
      </div>
      <div
        ref={bodyScrollRef}
        onScroll={onBodyScroll}
        className={cn(
          H_SCROLL_CLASS,
          "rounded-b-2xl",
          canScrollX &&
            "scroll-fade-effect-x-end [--mask-width:2.5rem] [--scroll-buffer:1.5rem]",
        )}
      >
        <div className="bg-surface" style={{ minWidth: tableMinWidthPx }}>
          {bodyBlock}
        </div>
      </div>
    </div>
  );
}

function IncomeRow({
  row,
  gridTemplateColumns,
  columnIsForecast,
  firstForecastIndex,
  onMetricClick,
  chartMetricSelection,
  showLabelColumnRule,
  showDivider,
}: {
  row: IncomeStatementRowModel;
  gridTemplateColumns: string;
  columnIsForecast?: boolean[];
  firstForecastIndex: number;
  onMetricClick?: (metricId: ChartingMetricId) => void;
  chartMetricSelection?: {
    selected: ReadonlySet<ChartingMetricId>;
    onToggle: (metricId: ChartingMetricId) => void;
  };
  showLabelColumnRule?: boolean;
  showDivider: boolean;
}) {
  const labelClass = row.emphasize
    ? "text-[14px] font-semibold leading-5 text-fg"
    : "text-[14px] font-normal leading-5 text-fg";

  const nestedLabelPad =
    row.id === "fcf_ps" || row.id === "fcf_margin" ? "pl-3 sm:pl-6" : "";

  const metricId = resolveFinancialsRowChartMetric(row);
  const selectionMode = chartMetricSelection != null && metricId != null;
  const checked = selectionMode ? chartMetricSelection.selected.has(metricId) : false;
  const rowInteractive =
    !selectionMode && typeof onMetricClick === "function" && metricId != null;

  const labelCell = (
    <div
      className={cn(
        stickyLabelBodyClass,
        showLabelColumnRule && stickyLabelColumnRuleClass,
        nestedLabelPad,
        labelClass,
        selectionMode && "gap-2.5",
        rowInteractive && "underline-offset-2 decoration-fg-muted group-hover/row:underline",
      )}
    >
      {selectionMode ? (
        <span
          className="shrink-0"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <AppCheckbox
            checked={checked}
            onChange={() => chartMetricSelection.onToggle(metricId)}
            aria-label={`Chart ${row.label}`}
          />
        </span>
      ) : null}
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
      <div className={SCREENER_TABLE_ROW_HOVER_PAD_END_CLASS}>
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
        ) : selectionMode ? (
          <button
            type="button"
            className={cn(
              rowSurfaceClass,
              "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-300",
            )}
            style={{ gridTemplateColumns }}
            onClick={() => chartMetricSelection.onToggle(metricId)}
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
