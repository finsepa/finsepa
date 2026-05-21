import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";
import {
  annualFundamentalsSlice,
  financialsRowHasNumericValues,
  pctChange,
} from "@/lib/market/stock-financials-annual-slice";
import type {
  IncomeStatementRowModel,
  IncomeStatementTableModel,
} from "@/lib/market/stock-financials-income-table";
import { attachTtmToFinancialsRows, ttmGrowthVsPriorYear, yieldOrRatioToDisplayPercent } from "@/lib/market/stock-financials-ttm";

function pick(slice: ChartingSeriesPoint[], fn: (p: ChartingSeriesPoint) => number | null): (number | null)[] {
  return slice.map(fn);
}

function decimalToDisplayPercent(values: (number | null)[]): (number | null)[] {
  return values.map((v) => (v != null && Number.isFinite(v) ? v * 100 : null));
}

function tableOrNull(
  columns: string[],
  columnPeriodEnds: string[],
  rows: IncomeStatementRowModel[],
): IncomeStatementTableModel | null {
  const visibleRows = rows.filter((r) => financialsRowHasNumericValues(r.values, r.format));
  if (!visibleRows.length) return null;
  return { columns, columnPeriodEnds, rows: visibleRows };
}

function liquidCash(p: ChartingSeriesPoint): number | null {
  return p.cashAndShortTermInvestments ?? p.cashOnHand ?? p.cashEquivalents;
}

function netCashDebt(p: ChartingSeriesPoint): number | null {
  const cash = liquidCash(p);
  const debt = p.totalDebt;
  if (cash == null && debt == null) return null;
  return (cash ?? 0) - (debt ?? 0);
}

function perShare(total: number | null, shares: number | null): number | null {
  if (total == null || shares == null || !Number.isFinite(shares) || Math.abs(shares) < 1e-9) return null;
  return total / shares;
}

function yoyGrowthSeries(
  slice: ChartingSeriesPoint[],
  getter: (p: ChartingSeriesPoint) => number | null,
): (number | null)[] {
  return slice.map((p, i) => (i === 0 ? null : pctChange(getter(p), getter(slice[i - 1]!))));
}

function otherLongTermLiabilities(p: ChartingSeriesPoint): number | null {
  const ncl = p.nonCurrentLiabilities;
  const ltd = p.longTermDebt;
  if (ncl == null) return null;
  if (ltd == null) return ncl;
  return ncl - ltd;
}

function balanceSheetTtmValue(rowId: string, ttm: ChartingSeriesPoint, prior: ChartingSeriesPoint | null): number | null {
  switch (rowId) {
    case "bs_cash_eq":
      return ttm.cashEquivalents;
    case "bs_sti":
      return ttm.shortTermInvestments;
    case "bs_cash_sti":
      return liquidCash(ttm);
    case "bs_cash_growth":
      return ttmGrowthVsPriorYear(ttm, prior, liquidCash, null);
    case "bs_ar":
      return ttm.netReceivables;
    case "bs_other_recv":
      return ttm.otherReceivables;
    case "bs_trade_recv":
      return ttm.netReceivables;
    case "bs_other_ca":
      return ttm.otherCurrentAssets;
    case "bs_total_ca":
      return ttm.totalCurrentAssets;
    case "bs_ppe":
      return ttm.propertyPlantEquipmentNet;
    case "bs_intangibles":
      return ttm.intangibleAssets;
    case "bs_goodwill":
      return ttm.goodwill;
    case "bs_lt_inv":
      return ttm.longTermInvestments;
    case "bs_other_nca":
      return ttm.otherNonCurrentAssets;
    case "bs_assets":
      return ttm.totalAssets;
    case "bs_ap":
      return ttm.accountsPayable;
    case "bs_accrued":
      return ttm.accruedLiabilities;
    case "bs_other_cl":
      return ttm.otherCurrentLiabilities;
    case "bs_current_liab":
      return ttm.currentLiabilities;
    case "bs_ltd":
      return ttm.longTermDebt;
    case "bs_other_ncl":
      return otherLongTermLiabilities(ttm);
    case "bs_total_ncl":
      return ttm.nonCurrentLiabilities;
    case "bs_liab":
      return ttm.totalLiabilities;
    case "bs_treasury":
      return ttm.treasuryStock;
    case "bs_apic":
      return ttm.additionalPaidInCapital;
    case "bs_equity":
      return ttm.shareholderEquity;
    case "bs_debt":
      return ttm.totalDebt;
    case "bs_net_cash":
      return netCashDebt(ttm);
    case "bs_net_cash_growth":
      return ttmGrowthVsPriorYear(ttm, prior, netCashDebt, null);
    case "bs_net_cash_ps":
      return perShare(netCashDebt(ttm), ttm.sharesOutstanding);
    case "bs_book":
      return ttm.bookValue ?? ttm.shareholderEquity;
    case "bs_book_ps":
      return perShare(ttm.bookValue ?? ttm.shareholderEquity, ttm.sharesOutstanding);
    case "bs_tangible":
      return ttm.tangibleBookValue;
    case "bs_tangible_ps":
      return perShare(ttm.tangibleBookValue, ttm.sharesOutstanding);
    case "bs_dte":
      return ttm.debtToEquity;
    default:
      return null;
  }
}

export function buildBalanceSheetTableModel(
  points: ChartingSeriesPoint[],
  ttmPoint?: ChartingSeriesPoint | null,
): IncomeStatementTableModel | null {
  const s = annualFundamentalsSlice(points);
  if (!s) return null;
  const { columns, columnPeriodEnds, slice } = s;

  const cashEq = pick(slice, (p) => p.cashEquivalents);
  const sti = pick(slice, (p) => p.shortTermInvestments);
  const cashSti = pick(slice, liquidCash);
  const cashGrowth = yoyGrowthSeries(slice, liquidCash);
  const ar = pick(slice, (p) => p.netReceivables);
  const otherRecv = pick(slice, (p) => p.otherReceivables);
  const tradeRecv = pick(slice, (p) => p.netReceivables);
  const otherCa = pick(slice, (p) => p.otherCurrentAssets);
  const totalCa = pick(slice, (p) => p.totalCurrentAssets);
  const ppe = pick(slice, (p) => p.propertyPlantEquipmentNet);
  const intangibles = pick(slice, (p) => p.intangibleAssets);
  const goodwill = pick(slice, (p) => p.goodwill);
  const ltInv = pick(slice, (p) => p.longTermInvestments);
  const otherNca = pick(slice, (p) => p.otherNonCurrentAssets);
  const totalAssets = pick(slice, (p) => p.totalAssets);
  const ap = pick(slice, (p) => p.accountsPayable);
  const accrued = pick(slice, (p) => p.accruedLiabilities);
  const otherCl = pick(slice, (p) => p.otherCurrentLiabilities);
  const currentLiab = pick(slice, (p) => p.currentLiabilities);
  const ltd = pick(slice, (p) => p.longTermDebt);
  const otherNcl = pick(slice, otherLongTermLiabilities);
  const totalNcl = pick(slice, (p) => p.nonCurrentLiabilities);
  const totalLiab = pick(slice, (p) => p.totalLiabilities);
  const treasury = pick(slice, (p) => p.treasuryStock);
  const apic = pick(slice, (p) => p.additionalPaidInCapital);
  const equity = pick(slice, (p) => p.shareholderEquity);
  const totalDebt = pick(slice, (p) => p.totalDebt);
  const netCash = pick(slice, netCashDebt);
  const netCashGrowth = yoyGrowthSeries(slice, netCashDebt);
  const netCashPs = pick(slice, (p) => perShare(netCashDebt(p), p.sharesOutstanding));
  const book = pick(slice, (p) => p.bookValue ?? p.shareholderEquity);
  const bookPs = pick(slice, (p) => perShare(p.bookValue ?? p.shareholderEquity, p.sharesOutstanding));
  const tangible = pick(slice, (p) => p.tangibleBookValue);
  const tangiblePs = pick(slice, (p) => perShare(p.tangibleBookValue, p.sharesOutstanding));
  const dte = pick(slice, (p) => p.debtToEquity);

  const rows: IncomeStatementRowModel[] = [
    { id: "bs_cash_eq", label: "Cash & Equivalents", emphasize: false, format: "usd", values: cashEq, chartingMetricId: "cash_on_hand" },
    { id: "bs_sti", label: "Short-Term Investments", emphasize: false, format: "usd", values: sti },
    { id: "bs_cash_sti", label: "Cash & Short-Term Investments", emphasize: true, format: "usd", values: cashSti },
    { id: "bs_cash_growth", label: "Cash Growth", emphasize: false, format: "pctGrowth", values: cashGrowth },
    { id: "bs_ar", label: "Accounts Receivable", emphasize: false, format: "usd", values: ar },
    { id: "bs_other_recv", label: "Other Receivables", emphasize: false, format: "usd", values: otherRecv },
    { id: "bs_trade_recv", label: "Total Trade Receivables", emphasize: false, format: "usd", values: tradeRecv },
    { id: "bs_other_ca", label: "Other Current Assets", emphasize: false, format: "usd", values: otherCa },
    { id: "bs_total_ca", label: "Total Current Assets", emphasize: true, format: "usd", values: totalCa },
    { id: "bs_ppe", label: "Net Property, Plant & Equipment", emphasize: false, format: "usd", values: ppe },
    { id: "bs_intangibles", label: "Other Intangible Assets", emphasize: false, format: "usd", values: intangibles },
    { id: "bs_goodwill", label: "Goodwill", emphasize: false, format: "usd", values: goodwill },
    { id: "bs_lt_inv", label: "Long-Term Investments", emphasize: false, format: "usd", values: ltInv },
    { id: "bs_other_nca", label: "Other Long-Term Assets", emphasize: false, format: "usd", values: otherNca },
    { id: "bs_assets", label: "Total Assets", emphasize: true, format: "usd", values: totalAssets, chartingMetricId: "total_assets" },
    { id: "bs_ap", label: "Accounts Payable", emphasize: false, format: "usd", values: ap },
    { id: "bs_accrued", label: "Accrued Expenses", emphasize: false, format: "usd", values: accrued },
    { id: "bs_other_cl", label: "Other Current Liabilities", emphasize: false, format: "usd", values: otherCl },
    { id: "bs_current_liab", label: "Total Current Liabilities", emphasize: true, format: "usd", values: currentLiab },
    { id: "bs_ltd", label: "Long-Term Debt", emphasize: false, format: "usd", values: ltd, chartingMetricId: "long_term_debt" },
    { id: "bs_other_ncl", label: "Other Long-Term Liabilities", emphasize: false, format: "usd", values: otherNcl },
    { id: "bs_total_ncl", label: "Total Long-Term Liabilities", emphasize: true, format: "usd", values: totalNcl },
    { id: "bs_liab", label: "Total Liabilities", emphasize: true, format: "usd", values: totalLiab, chartingMetricId: "total_liabilities" },
    { id: "bs_treasury", label: "Treasury Stock", emphasize: false, format: "usd", values: treasury },
    { id: "bs_apic", label: "Additional Paid-in Capital", emphasize: false, format: "usd", values: apic },
    { id: "bs_equity", label: "Shareholders' Equity", emphasize: true, format: "usd", values: equity, chartingMetricId: "shareholder_equity" },
    { id: "bs_debt", label: "Total Debt", emphasize: true, format: "usd", values: totalDebt },
    { id: "bs_net_cash", label: "Net Cash (Debt)", emphasize: true, format: "usd", values: netCash },
    { id: "bs_net_cash_growth", label: "Net Cash Growth", emphasize: false, format: "pctGrowth", values: netCashGrowth },
    { id: "bs_net_cash_ps", label: "Net Cash Per Share", emphasize: false, format: "perShare", values: netCashPs },
    { id: "bs_book", label: "Book Value", emphasize: false, format: "usd", values: book },
    { id: "bs_book_ps", label: "Book Value Per Share", emphasize: false, format: "perShare", values: bookPs },
    { id: "bs_tangible", label: "Tangible Book Value", emphasize: false, format: "usd", values: tangible },
    { id: "bs_tangible_ps", label: "Tangible Book Value Per Share", emphasize: false, format: "perShare", values: tangiblePs },
    { id: "bs_dte", label: "Debt / Equity", emphasize: false, format: "ratio", values: dte, chartingMetricId: "debt_to_equity" },
  ];

  const base = tableOrNull(columns, columnPeriodEnds, rows);
  if (!base) return null;
  const prior = slice[slice.length - 1] ?? null;
  return attachTtmToFinancialsRows(base, ttmPoint, prior, (row) =>
    ttmPoint ? balanceSheetTtmValue(row.id, ttmPoint, prior) : null,
  );
}

function dividendsPaidDisplay(p: ChartingSeriesPoint): number | null {
  if (p.dividendsPaid == null) return null;
  return Math.abs(p.dividendsPaid);
}

function fcfPerShareDisplay(p: ChartingSeriesPoint): number | null {
  if (p.fcfPerShare != null) return p.fcfPerShare;
  const fcf = p.freeCashFlow;
  const sh = p.sharesOutstanding;
  if (fcf == null || sh == null || !Number.isFinite(sh) || Math.abs(sh) < 1e-9) return null;
  return fcf / sh;
}

function cashFlowTtmValue(rowId: string, ttm: ChartingSeriesPoint, prior: ChartingSeriesPoint | null): number | null {
  switch (rowId) {
    case "cf_ni":
      return ttm.netIncome;
    case "cf_depreciation":
      return ttm.cfDepreciationAmortization;
    case "cf_sbc":
      return ttm.cfStockBasedCompensation;
    case "cf_other_adj":
      return ttm.cfOtherNonCashItems;
    case "cf_recv":
      return ttm.cfChangeInReceivables;
    case "cf_ap":
      return ttm.cfChangeInAccountsPayable;
    case "cf_other_op":
      return ttm.cfChangeInOtherOperating ?? ttm.cfChangeInWorkingCapital;
    case "cf_op":
      return ttm.operatingCashFlow;
    case "cf_op_growth":
      return ttmGrowthVsPriorYear(ttm, prior, (p) => p.operatingCashFlow, null);
    case "cf_capex":
      return ttm.capitalExpenditures;
    case "cf_sale_ppe":
      return ttm.cfSaleOfPpe;
    case "cf_buy_inv":
      return ttm.cfPurchasesOfInvestments;
    case "cf_sell_inv":
      return ttm.cfProceedsFromInvestments;
    case "cf_acq":
      return ttm.cfPaymentsForAcquisitions;
    case "cf_divest":
      return ttm.cfProceedsFromDivestitures;
    case "cf_investments":
      return ttm.cfInvestments;
    case "cf_other_inv":
      return ttm.cfOtherInvestingCashFlow;
    case "cf_inv":
      return ttm.investingCashFlow;
    case "cf_st_debt_issued":
      return ttm.cfShortTermDebtIssued;
    case "cf_st_debt_repaid":
      return ttm.cfShortTermDebtRepaid;
    case "cf_lt_debt_issued":
      return ttm.cfLongTermDebtIssued;
    case "cf_lt_debt_repaid":
      return ttm.cfLongTermDebtRepaid;
    case "cf_net_debt":
      return ttm.cfNetDebtIssued;
    case "cf_stock_issued":
      return ttm.cfIssuanceOfCommonStock;
    case "cf_stock_repurchased":
      return ttm.cfRepurchaseOfCommonStock;
    case "cf_net_stock":
      return ttm.cfNetCommonStock;
    case "cf_div":
      return dividendsPaidDisplay(ttm);
    case "cf_other_fin":
      return ttm.cfOtherFinancingCashFlow;
    case "cf_fin":
      return ttm.financingCashFlow;
    case "cf_fx":
      return ttm.cfExchangeRateEffect;
    case "cf_change_cash":
      return ttm.changeInCash;
    case "cf_fcf":
      return ttm.freeCashFlow;
    case "cf_fcf_growth":
      return ttmGrowthVsPriorYear(ttm, prior, (p) => p.freeCashFlow, null);
    case "cf_fcf_margin":
      return ttm.fcfMargin != null ? ttm.fcfMargin * 100 : null;
    case "cf_fcf_ps":
      return fcfPerShareDisplay(ttm);
    case "cf_levered_fcf":
      return ttm.leveredFreeCashFlow ?? ttm.freeCashFlow;
    case "cf_unlevered_fcf":
      return ttm.unleveredFreeCashFlow;
    default:
      return null;
  }
}

export function buildCashFlowTableModel(
  points: ChartingSeriesPoint[],
  ttmPoint?: ChartingSeriesPoint | null,
): IncomeStatementTableModel | null {
  const s = annualFundamentalsSlice(points);
  if (!s) return null;
  const { columns, columnPeriodEnds, slice } = s;

  const netIncome = pick(slice, (p) => p.netIncome);
  const depreciation = pick(slice, (p) => p.cfDepreciationAmortization);
  const sbc = pick(slice, (p) => p.cfStockBasedCompensation);
  const otherAdj = pick(slice, (p) => p.cfOtherNonCashItems);
  const changeRecv = pick(slice, (p) => p.cfChangeInReceivables);
  const changeAp = pick(slice, (p) => p.cfChangeInAccountsPayable);
  const changeOtherOp = pick(slice, (p) => p.cfChangeInOtherOperating ?? p.cfChangeInWorkingCapital);
  const operatingCf = pick(slice, (p) => p.operatingCashFlow);
  const operatingCfGrowth = yoyGrowthSeries(slice, (p) => p.operatingCashFlow);
  const capex = pick(slice, (p) => p.capitalExpenditures);
  const salePpe = pick(slice, (p) => p.cfSaleOfPpe);
  const buyInv = pick(slice, (p) => p.cfPurchasesOfInvestments);
  const sellInv = pick(slice, (p) => p.cfProceedsFromInvestments);
  const acq = pick(slice, (p) => p.cfPaymentsForAcquisitions);
  const divest = pick(slice, (p) => p.cfProceedsFromDivestitures);
  const investments = pick(slice, (p) => p.cfInvestments);
  const otherInv = pick(slice, (p) => p.cfOtherInvestingCashFlow);
  const investingCf = pick(slice, (p) => p.investingCashFlow);
  const stDebtIssued = pick(slice, (p) => p.cfShortTermDebtIssued);
  const stDebtRepaid = pick(slice, (p) => p.cfShortTermDebtRepaid);
  const ltDebtIssued = pick(slice, (p) => p.cfLongTermDebtIssued);
  const ltDebtRepaid = pick(slice, (p) => p.cfLongTermDebtRepaid);
  const netDebtIssued = pick(slice, (p) => p.cfNetDebtIssued);
  const stockIssued = pick(slice, (p) => p.cfIssuanceOfCommonStock);
  const stockRepurchased = pick(slice, (p) => p.cfRepurchaseOfCommonStock);
  const netStock = pick(slice, (p) => p.cfNetCommonStock);
  const div = pick(slice, dividendsPaidDisplay);
  const otherFin = pick(slice, (p) => p.cfOtherFinancingCashFlow);
  const financingCf = pick(slice, (p) => p.financingCashFlow);
  const fxEffect = pick(slice, (p) => p.cfExchangeRateEffect);
  const changeCash = pick(slice, (p) => p.changeInCash);
  const fcf = pick(slice, (p) => p.freeCashFlow);
  const fcfGrowth = yoyGrowthSeries(slice, (p) => p.freeCashFlow);
  const fcfMargin = pick(slice, (p) => (p.fcfMargin != null ? p.fcfMargin * 100 : null));
  const fcfPs = pick(slice, fcfPerShareDisplay);
  const leveredFcf = pick(slice, (p) => p.leveredFreeCashFlow ?? p.freeCashFlow);
  const unleveredFcf = pick(slice, (p) => p.unleveredFreeCashFlow);

  const rows: IncomeStatementRowModel[] = [
    { id: "cf_ni", label: "Net Income", emphasize: false, format: "usd", values: netIncome, chartingMetricId: "net_income" },
    { id: "cf_depreciation", label: "Depreciation & Amortization", emphasize: false, format: "usd", values: depreciation },
    { id: "cf_sbc", label: "Stock-Based Compensation", emphasize: false, format: "usd", values: sbc },
    { id: "cf_other_adj", label: "Other Adjustments", emphasize: false, format: "usd", values: otherAdj },
    { id: "cf_recv", label: "Change in Receivables", emphasize: false, format: "usd", values: changeRecv },
    { id: "cf_ap", label: "Changes in Accounts Payable", emphasize: false, format: "usd", values: changeAp },
    {
      id: "cf_other_op",
      label: "Changes in Other Operating Activities",
      emphasize: false,
      format: "usd",
      values: changeOtherOp,
    },
    { id: "cf_op", label: "Operating Cash Flow", emphasize: true, format: "usd", values: operatingCf },
    { id: "cf_op_growth", label: "Operating Cash Flow Growth", emphasize: false, format: "pctGrowth", values: operatingCfGrowth },
    { id: "cf_capex", label: "Capital Expenditures", emphasize: false, format: "usd", values: capex },
    { id: "cf_sale_ppe", label: "Sale of Property, Plant & Equipment", emphasize: false, format: "usd", values: salePpe },
    { id: "cf_buy_inv", label: "Purchases of Investments", emphasize: false, format: "usd", values: buyInv },
    { id: "cf_sell_inv", label: "Proceeds from Sale of Investments", emphasize: false, format: "usd", values: sellInv },
    { id: "cf_acq", label: "Payments for Business Acquisitions", emphasize: false, format: "usd", values: acq },
    { id: "cf_divest", label: "Proceeds from Business Divestitures", emphasize: false, format: "usd", values: divest },
    { id: "cf_investments", label: "Investments", emphasize: false, format: "usd", values: investments },
    { id: "cf_other_inv", label: "Other Investing Activities", emphasize: false, format: "usd", values: otherInv },
    { id: "cf_inv", label: "Investing Cash Flow", emphasize: true, format: "usd", values: investingCf },
    { id: "cf_st_debt_issued", label: "Short-Term Debt Issued", emphasize: false, format: "usd", values: stDebtIssued },
    { id: "cf_st_debt_repaid", label: "Short-Term Debt Repaid", emphasize: false, format: "usd", values: stDebtRepaid },
    { id: "cf_lt_debt_issued", label: "Long-Term Debt Issued", emphasize: false, format: "usd", values: ltDebtIssued },
    { id: "cf_lt_debt_repaid", label: "Long-Term Debt Repaid", emphasize: false, format: "usd", values: ltDebtRepaid },
    { id: "cf_net_debt", label: "Net Long-Term Debt Issued (Repaid)", emphasize: false, format: "usd", values: netDebtIssued },
    { id: "cf_stock_issued", label: "Issuance of Common Stock", emphasize: false, format: "usd", values: stockIssued },
    { id: "cf_stock_repurchased", label: "Repurchase of Common Stock", emphasize: false, format: "usd", values: stockRepurchased },
    { id: "cf_net_stock", label: "Net Common Stock Issued (Repurchased)", emphasize: false, format: "usd", values: netStock },
    { id: "cf_div", label: "Common Dividends Paid", emphasize: false, format: "usd", values: div },
    { id: "cf_other_fin", label: "Other Financing Activities", emphasize: false, format: "usd", values: otherFin },
    { id: "cf_fin", label: "Financing Cash Flow", emphasize: true, format: "usd", values: financingCf },
    { id: "cf_fx", label: "Effect of Exchange Rate Changes", emphasize: false, format: "usd", values: fxEffect },
    { id: "cf_change_cash", label: "Net Change in Cash", emphasize: true, format: "usd", values: changeCash },
    { id: "cf_fcf", label: "Free Cash Flow", emphasize: true, format: "usd", values: fcf, chartingMetricId: "free_cash_flow" },
    { id: "cf_fcf_growth", label: "Free Cash Flow Growth", emphasize: false, format: "pctGrowth", values: fcfGrowth },
    { id: "cf_fcf_margin", label: "FCF Margin", emphasize: false, format: "pctMargin", values: fcfMargin },
    { id: "cf_fcf_ps", label: "Free Cash Flow Per Share", emphasize: false, format: "perShare", values: fcfPs },
    { id: "cf_levered_fcf", label: "Levered Free Cash Flow", emphasize: false, format: "usd", values: leveredFcf },
    { id: "cf_unlevered_fcf", label: "Unlevered Free Cash Flow", emphasize: false, format: "usd", values: unleveredFcf },
  ];

  const base = tableOrNull(columns, columnPeriodEnds, rows);
  if (!base) return null;
  const prior = slice[slice.length - 1] ?? null;
  return attachTtmToFinancialsRows(base, ttmPoint, prior, (row) =>
    ttmPoint ? cashFlowTtmValue(row.id, ttmPoint, prior) : null,
  );
}

function decimalToDisplayPercentSingle(v: number | null): number | null {
  return v != null && Number.isFinite(v) ? v * 100 : null;
}

function lastClosePrice(p: ChartingSeriesPoint): number | null {
  const mc = p.marketCap;
  const sh = p.sharesOutstanding;
  if (mc == null || sh == null || !Number.isFinite(mc) || !Number.isFinite(sh) || Math.abs(sh) < 1e-9) {
    return null;
  }
  return mc / sh;
}

function buybackYieldPct(slice: ChartingSeriesPoint[]): (number | null)[] {
  return slice.map((p, i) => {
    if (i === 0) return null;
    const cur = p.sharesOutstanding;
    const prev = slice[i - 1]!.sharesOutstanding;
    if (cur == null || prev == null || !Number.isFinite(cur) || !Number.isFinite(prev) || Math.abs(prev) < 1e-9) {
      return null;
    }
    return ((prev - cur) / Math.abs(prev)) * 100;
  });
}

function totalShareholderReturnPct(slice: ChartingSeriesPoint[]): (number | null)[] {
  const buyback = buybackYieldPct(slice);
  return slice.map((p, i) => {
    if (i === 0) return null;
    const px = lastClosePrice(p);
    const pxPrev = lastClosePrice(slice[i - 1]!);
    if (px == null || pxPrev == null || !Number.isFinite(px) || !Number.isFinite(pxPrev) || Math.abs(pxPrev) < 1e-9) {
      return buyback[i];
    }
    const priceRet = ((px - pxPrev) / Math.abs(pxPrev)) * 100;
    const div = yieldOrRatioToDisplayPercent(p.dividendYield) ?? 0;
    const bb = buyback[i] ?? 0;
    return priceRet + div + bb;
  });
}

function ratiosTtmValue(rowId: string, ttm: ChartingSeriesPoint, prior: ChartingSeriesPoint | null): number | null {
  switch (rowId) {
    case "r_mcap_growth":
      return ttmGrowthVsPriorYear(ttm, prior, (p) => p.marketCap, null);
    case "r_ev":
      return ttm.enterpriseValue;
    case "r_last_close":
      return lastClosePrice(ttm);
    case "r_pe":
      return ttm.peRatio ?? ttm.trailingPe;
    case "r_fwd_pe":
      return ttm.forwardPe;
    case "r_peg":
      return ttm.pegRatio;
    case "r_ps":
      return ttm.psRatio;
    case "r_pb":
      return ttm.priceBook;
    case "r_ptbv":
      return ttm.priceToTangibleBook;
    case "r_pfcf":
      return ttm.priceFcf;
    case "r_pocf":
      return ttm.priceOcf;
    case "r_ev_s":
      return ttm.evSales;
    case "r_ev_e":
      return ttm.evEbitda;
    case "r_ev_ebit":
      return ttm.evToEbit;
    case "r_ev_fcf":
      return ttm.evToFcf;
    case "r_de":
      return ttm.debtToEquity;
    case "r_debt_ebitda":
      return ttm.debtToEbitda;
    case "r_debt_fcf":
      return ttm.debtToFcf;
    case "r_net_de":
      return ttm.netDebtToEquity;
    case "r_net_debt_ebitda":
      return ttm.netDebtToEbitda;
    case "r_net_debt_fcf":
      return ttm.netDebtToFcf;
    case "r_asset_turn":
      return ttm.assetTurnover;
    case "r_quick":
      return ttm.quickRatio;
    case "r_current":
      return ttm.currentRatio;
    case "r_roe":
      return decimalToDisplayPercentSingle(ttm.returnOnEquity);
    case "r_roa":
      return decimalToDisplayPercentSingle(ttm.returnOnAssets);
    case "r_roic":
      return decimalToDisplayPercentSingle(ttm.returnOnInvestedCapital);
    case "r_roce":
      return decimalToDisplayPercentSingle(ttm.returnOnCapitalEmployed);
    case "r_earn_y":
      return decimalToDisplayPercentSingle(ttm.earningsYield);
    case "r_fcf_y":
      return decimalToDisplayPercentSingle(ttm.fcfYield);
    case "r_div_y":
      return yieldOrRatioToDisplayPercent(ttm.dividendYield);
    case "r_payout":
      return decimalToDisplayPercentSingle(ttm.payoutRatio);
    case "r_buyback":
      return prior && ttm.sharesOutstanding != null && prior.sharesOutstanding != null
        ? buybackYieldPct([prior, ttm])[1]
        : null;
    case "r_tsr":
      return prior ? totalShareholderReturnPct([prior, ttm])[1] : null;
    default:
      return null;
  }
}

export function buildRatiosTableModel(
  points: ChartingSeriesPoint[],
  ttmPoint?: ChartingSeriesPoint | null,
): IncomeStatementTableModel | null {
  const s = annualFundamentalsSlice(points);
  if (!s) return null;
  const { columns, columnPeriodEnds, slice } = s;

  const mcapGrowth = yoyGrowthSeries(slice, (p) => p.marketCap);
  const ev = pick(slice, (p) => p.enterpriseValue);
  const lastClose = pick(slice, lastClosePrice);
  const pe = pick(slice, (p) => p.peRatio ?? p.trailingPe);
  const fwd = pick(slice, (p) => p.forwardPe);
  const peg = pick(slice, (p) => p.pegRatio);
  const ps = pick(slice, (p) => p.psRatio);
  const pb = pick(slice, (p) => p.priceBook);
  const ptbv = pick(slice, (p) => p.priceToTangibleBook);
  const pfcf = pick(slice, (p) => p.priceFcf);
  const pocf = pick(slice, (p) => p.priceOcf);
  const evS = pick(slice, (p) => p.evSales);
  const evE = pick(slice, (p) => p.evEbitda);
  const evEbit = pick(slice, (p) => p.evToEbit);
  const evFcf = pick(slice, (p) => p.evToFcf);
  const de = pick(slice, (p) => p.debtToEquity);
  const debtEbitda = pick(slice, (p) => p.debtToEbitda);
  const debtFcf = pick(slice, (p) => p.debtToFcf);
  const netDe = pick(slice, (p) => p.netDebtToEquity);
  const netDebtEbitda = pick(slice, (p) => p.netDebtToEbitda);
  const netDebtFcf = pick(slice, (p) => p.netDebtToFcf);
  const assetTurn = pick(slice, (p) => p.assetTurnover);
  const quick = pick(slice, (p) => p.quickRatio);
  const current = pick(slice, (p) => p.currentRatio);
  const roe = decimalToDisplayPercent(pick(slice, (p) => p.returnOnEquity));
  const roa = decimalToDisplayPercent(pick(slice, (p) => p.returnOnAssets));
  const roic = decimalToDisplayPercent(pick(slice, (p) => p.returnOnInvestedCapital));
  const roce = decimalToDisplayPercent(pick(slice, (p) => p.returnOnCapitalEmployed));
  const earnY = decimalToDisplayPercent(pick(slice, (p) => p.earningsYield));
  const fcfY = decimalToDisplayPercent(pick(slice, (p) => p.fcfYield));
  const divY = pick(slice, (p) => yieldOrRatioToDisplayPercent(p.dividendYield));
  const payout = decimalToDisplayPercent(pick(slice, (p) => p.payoutRatio));
  const buyback = buybackYieldPct(slice);
  const tsr = totalShareholderReturnPct(slice);

  const rows: IncomeStatementRowModel[] = [
    {
      id: "r_mcap_growth",
      label: "Market Cap Growth",
      emphasize: false,
      format: "pctGrowth",
      values: mcapGrowth,
    },
    { id: "r_ev", label: "Enterprise Value", emphasize: false, format: "usd", values: ev, chartingMetricId: "enterprise_value" },
    { id: "r_last_close", label: "Last Close Price", emphasize: false, format: "perShare", values: lastClose },
    { id: "r_pe", label: "PE Ratio", emphasize: true, format: "ratio", values: pe, chartingMetricId: "pe_ratio" },
    { id: "r_fwd_pe", label: "Forward PE", emphasize: false, format: "ratio", values: fwd, chartingMetricId: "forward_pe" },
    { id: "r_peg", label: "PEG Ratio", emphasize: false, format: "ratio", values: peg },
    { id: "r_ps", label: "PS Ratio", emphasize: false, format: "ratio", values: ps, chartingMetricId: "ps_ratio" },
    { id: "r_pb", label: "PB Ratio", emphasize: false, format: "ratio", values: pb, chartingMetricId: "price_book" },
    { id: "r_ptbv", label: "P/TBV Ratio", emphasize: false, format: "ratio", values: ptbv },
    { id: "r_pfcf", label: "P/FCF Ratio", emphasize: false, format: "ratio", values: pfcf, chartingMetricId: "price_fcf" },
    { id: "r_pocf", label: "P/OCF Ratio", emphasize: false, format: "ratio", values: pocf },
    { id: "r_ev_s", label: "EV/Sales Ratio", emphasize: false, format: "ratio", values: evS, chartingMetricId: "ev_sales" },
    { id: "r_ev_e", label: "EV/EBITDA Ratio", emphasize: true, format: "ratio", values: evE, chartingMetricId: "ev_ebitda" },
    { id: "r_ev_ebit", label: "EV/EBIT Ratio", emphasize: false, format: "ratio", values: evEbit },
    { id: "r_ev_fcf", label: "EV/FCF Ratio", emphasize: false, format: "ratio", values: evFcf },
    { id: "r_de", label: "Debt / Equity Ratio", emphasize: false, format: "ratio", values: de, chartingMetricId: "debt_to_equity" },
    { id: "r_debt_ebitda", label: "Debt / EBITDA Ratio", emphasize: false, format: "ratio", values: debtEbitda },
    { id: "r_debt_fcf", label: "Debt / FCF Ratio", emphasize: false, format: "ratio", values: debtFcf },
    { id: "r_net_de", label: "Net Debt / Equity Ratio", emphasize: false, format: "ratio", values: netDe },
    { id: "r_net_debt_ebitda", label: "Net Debt / EBITDA Ratio", emphasize: false, format: "ratio", values: netDebtEbitda },
    { id: "r_net_debt_fcf", label: "Net Debt / FCF Ratio", emphasize: false, format: "ratio", values: netDebtFcf },
    { id: "r_asset_turn", label: "Asset Turnover", emphasize: false, format: "ratio", values: assetTurn },
    { id: "r_quick", label: "Quick Ratio", emphasize: false, format: "ratio", values: quick },
    { id: "r_current", label: "Current Ratio", emphasize: false, format: "ratio", values: current },
    { id: "r_roe", label: "Return on Equity (ROE)", emphasize: true, format: "pctMargin", values: roe, chartingMetricId: "return_on_equity" },
    { id: "r_roa", label: "Return on Assets (ROA)", emphasize: false, format: "pctMargin", values: roa, chartingMetricId: "return_on_assets" },
    {
      id: "r_roic",
      label: "Return on Invested Capital (ROIC)",
      emphasize: false,
      format: "pctMargin",
      values: roic,
    },
    {
      id: "r_roce",
      label: "Return on Capital Employed (ROCE)",
      emphasize: false,
      format: "pctMargin",
      values: roce,
      chartingMetricId: "return_on_capital_employed",
    },
    { id: "r_earn_y", label: "Earnings Yield", emphasize: false, format: "pctMargin", values: earnY },
    { id: "r_fcf_y", label: "FCF Yield", emphasize: false, format: "pctMargin", values: fcfY },
    { id: "r_div_y", label: "Dividend Yield", emphasize: false, format: "pctMargin", values: divY, chartingMetricId: "dividend_yield" },
    { id: "r_payout", label: "Payout Ratio", emphasize: false, format: "pctMargin", values: payout, chartingMetricId: "payout_ratio" },
    { id: "r_buyback", label: "Buyback Yield / Dilution", emphasize: false, format: "pctGrowth", values: buyback },
    { id: "r_tsr", label: "Total Shareholder Return", emphasize: true, format: "pctGrowth", values: tsr },
  ];

  const base = tableOrNull(columns, columnPeriodEnds, rows);
  if (!base) return null;
  const prior = slice[slice.length - 1] ?? null;
  return attachTtmToFinancialsRows(base, ttmPoint, prior, (row) =>
    ttmPoint ? ratiosTtmValue(row.id, ttmPoint, prior) : null,
  );
}
