"use client";

import type {
  IncomeStatementRowModel,
  IncomeStatementTableModel,
  IncomeStatementValueFormat,
} from "@/lib/market/stock-financials-income-table";
import { ScreenerTableScroll } from "@/components/screener/screener-table-scroll";
import { cn } from "@/lib/utils";

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
  "min-w-0 w-full truncate text-right font-['Inter'] text-[12px] font-medium leading-5 tabular-nums text-[#71717A] sm:text-[14px]";

/** Tighter band than screener tables — Financials Income only. */
const incomeTableRowClass = "h-[52px] max-h-[52px] min-h-0 overflow-hidden";

export function StockIncomeStatementTable({ model }: { model: IncomeStatementTableModel }) {
  const { columns, rows } = model;
  const gridTemplateColumns = `minmax(11rem, 2fr) repeat(${columns.length}, minmax(5.25rem, 1fr))`;

  return (
    <ScreenerTableScroll minWidthClassName="min-w-[min(100%,720px)] lg:min-w-0">
      <div className="divide-y divide-[#E4E4E7] bg-white">
        <div
          className={`grid items-center gap-x-2 bg-white px-2 py-0 text-[12px] font-medium leading-5 text-[#71717A] sm:px-4 sm:text-[14px] ${incomeTableRowClass}`}
          style={{ gridTemplateColumns }}
        >
          <div className="min-w-0 text-left">
            <span className="sr-only">Metric</span>
          </div>
          {columns.map((y) => (
            <div key={y} className={headerYearClass}>
              {y}
            </div>
          ))}
        </div>

        {rows.map((row) => (
          <IncomeRow key={row.id} row={row} gridTemplateColumns={gridTemplateColumns} />
        ))}
      </div>
    </ScreenerTableScroll>
  );
}

function IncomeRow({ row, gridTemplateColumns }: { row: IncomeStatementRowModel; gridTemplateColumns: string }) {
  const labelClass = row.emphasize
    ? "text-[14px] font-semibold leading-5 text-[#09090B]"
    : "text-[14px] font-normal leading-5 text-[#09090B]";

  const nestedLabelPad = row.emphasize ? "" : "pl-3 sm:pl-6";

  return (
    <div
      className={`grid items-center gap-x-2 bg-white px-2 transition-colors duration-75 hover:bg-neutral-50 sm:px-4 ${incomeTableRowClass}`}
      style={{ gridTemplateColumns }}
    >
      <div className={cn("min-w-0 truncate pr-3 text-left", nestedLabelPad, labelClass)}>{row.label}</div>
      {row.values.map((v, i) => {
        const { text, tone } = formatCell(row.format, v, row.id);
        const isGrowth = row.format === "pctGrowth";
        return (
          <div
            key={i}
            className={cn(
              numCellClass,
              "truncate",
              isGrowth ? `font-medium ${toneClass(tone)}` : undefined,
            )}
          >
            {text}
          </div>
        );
      })}
    </div>
  );
}
