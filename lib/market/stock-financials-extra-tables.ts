import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";
import {
  annualFundamentalsSlice,
  pctChange,
} from "@/lib/market/stock-financials-annual-slice";
import type {
  IncomeStatementRowModel,
  IncomeStatementTableModel,
} from "@/lib/market/stock-financials-income-table";

function pick(slice: ChartingSeriesPoint[], fn: (p: ChartingSeriesPoint) => number | null): (number | null)[] {
  return slice.map(fn);
}

function decimalToDisplayPercent(values: (number | null)[]): (number | null)[] {
  return values.map((v) => (v != null && Number.isFinite(v) ? v * 100 : null));
}

/** Ratios rows often store decimals (0.052 = 5.2%); some feeds use whole percent (5.2). */
function yieldOrRatioToDisplayPercent(v: number | null): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  if (Math.abs(v) <= 1) return v * 100;
  return v;
}

function tableOrNull(columns: string[], rows: IncomeStatementRowModel[]): IncomeStatementTableModel | null {
  const anyNumber = rows.some((r) => r.values.some((v) => v != null && Number.isFinite(v)));
  if (!anyNumber) return null;
  return { columns, rows };
}

export function buildBalanceSheetTableModel(points: ChartingSeriesPoint[]): IncomeStatementTableModel | null {
  const s = annualFundamentalsSlice(points);
  if (!s) return null;
  const { columns, slice } = s;

  const totalAssets = pick(slice, (p) => p.totalAssets);
  const cash = pick(slice, (p) => p.cashOnHand);
  const totalLiab = pick(slice, (p) => p.totalLiabilities);
  const currentLiab = pick(slice, (p) => p.currentLiabilities);
  const totalDebt = pick(slice, (p) => p.totalDebt);
  const ltd = pick(slice, (p) => p.longTermDebt);
  const equity = pick(slice, (p) => p.shareholderEquity);
  const dte = pick(slice, (p) => p.debtToEquity);

  const rows: IncomeStatementRowModel[] = [
    { id: "bs_assets", label: "Total assets", emphasize: true, format: "usd", values: totalAssets },
    { id: "bs_cash", label: "Cash & equivalents", emphasize: false, format: "usd", values: cash },
    { id: "bs_liab", label: "Total liabilities", emphasize: true, format: "usd", values: totalLiab },
    { id: "bs_current_liab", label: "Current liabilities", emphasize: false, format: "usd", values: currentLiab },
    { id: "bs_debt", label: "Total debt", emphasize: true, format: "usd", values: totalDebt },
    { id: "bs_ltd", label: "Long-term debt", emphasize: false, format: "usd", values: ltd },
    { id: "bs_equity", label: "Shareholders' equity", emphasize: true, format: "usd", values: equity },
    { id: "bs_dte", label: "Debt / equity", emphasize: false, format: "ratio", values: dte },
  ];

  return tableOrNull(columns, rows);
}

export function buildCashFlowTableModel(points: ChartingSeriesPoint[]): IncomeStatementTableModel | null {
  const s = annualFundamentalsSlice(points);
  if (!s) return null;
  const { columns, slice } = s;

  const fcf = pick(slice, (p) => p.freeCashFlow);
  const fcfGrowth = slice.map((p, i) => (i === 0 ? null : pctChange(p.freeCashFlow, slice[i - 1]!.freeCashFlow)));
  const div = pick(slice, (p) => (p.dividendsPaid == null ? null : Math.abs(p.dividendsPaid)));

  const rows: IncomeStatementRowModel[] = [
    { id: "cf_fcf", label: "Free cash flow", emphasize: true, format: "usd", values: fcf },
    {
      id: "cf_fcf_growth",
      label: "Free cash flow growth (YoY)",
      emphasize: false,
      format: "pctGrowth",
      values: fcfGrowth,
    },
    { id: "cf_div", label: "Dividends paid", emphasize: true, format: "usd", values: div },
  ];

  return tableOrNull(columns, rows);
}

export function buildRatiosTableModel(points: ChartingSeriesPoint[]): IncomeStatementTableModel | null {
  const s = annualFundamentalsSlice(points);
  if (!s) return null;
  const { columns, slice } = s;

  const pe = pick(slice, (p) => p.peRatio ?? p.trailingPe);
  const fwd = pick(slice, (p) => p.forwardPe);
  const ps = pick(slice, (p) => p.psRatio);
  const pb = pick(slice, (p) => p.priceBook);
  const pfcf = pick(slice, (p) => p.priceFcf);
  const evE = pick(slice, (p) => p.evEbitda);
  const evS = pick(slice, (p) => p.evSales);
  const cashDebt = pick(slice, (p) => p.cashDebt);

  const roe = decimalToDisplayPercent(pick(slice, (p) => p.returnOnEquity));
  const roa = decimalToDisplayPercent(pick(slice, (p) => p.returnOnAssets));
  const roce = decimalToDisplayPercent(pick(slice, (p) => p.returnOnCapitalEmployed));
  const roi = decimalToDisplayPercent(pick(slice, (p) => p.returnOnInvestment));

  const divY = pick(slice, (p) => yieldOrRatioToDisplayPercent(p.dividendYield));
  const payout = decimalToDisplayPercent(pick(slice, (p) => p.payoutRatio));

  const rows: IncomeStatementRowModel[] = [
    { id: "r_pe", label: "P/E", emphasize: true, format: "ratio", values: pe },
    { id: "r_fwd_pe", label: "Forward P/E", emphasize: false, format: "ratio", values: fwd },
    { id: "r_ps", label: "P/S", emphasize: false, format: "ratio", values: ps },
    { id: "r_pb", label: "P/B", emphasize: false, format: "ratio", values: pb },
    { id: "r_pfcf", label: "P/FCF", emphasize: false, format: "ratio", values: pfcf },
    { id: "r_ev_e", label: "EV / EBITDA", emphasize: true, format: "ratio", values: evE },
    { id: "r_ev_s", label: "EV / Sales", emphasize: false, format: "ratio", values: evS },
    { id: "r_cash_debt", label: "Cash / total debt", emphasize: false, format: "ratio", values: cashDebt },
    { id: "r_roe", label: "Return on equity", emphasize: true, format: "pctMargin", values: roe },
    { id: "r_roa", label: "Return on assets", emphasize: false, format: "pctMargin", values: roa },
    { id: "r_roce", label: "Return on capital employed", emphasize: false, format: "pctMargin", values: roce },
    { id: "r_roi", label: "Return on investment", emphasize: false, format: "pctMargin", values: roi },
    { id: "r_div_y", label: "Dividend yield", emphasize: false, format: "pctMargin", values: divY },
    { id: "r_payout", label: "Payout ratio", emphasize: false, format: "pctMargin", values: payout },
  ];

  return tableOrNull(columns, rows);
}
