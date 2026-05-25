import type { ChartingMetricId } from "@/lib/market/stock-charting-metrics";
import type { IncomeStatementRowModel, IncomeStatementTableModel } from "@/lib/market/stock-financials-income-table";

/**
 * Financials table row id → chart modal metric (same modal as Overview Key Stats / Revenue).
 * Rows omitted here stay non-clickable (e.g. buyback yield, TSR, per-share book derived only in-table).
 */
export const FINANCIALS_ROW_CHART_METRIC: Partial<Record<string, ChartingMetricId>> = {
  cost_of_revenue: "cost_of_revenue",
  sga: "sga",
  research_development: "research_development",
  other_operating_expense: "other_operating_expense",
  total_operating_expenses: "total_operating_expenses",
  pretax_income: "pretax_income",
  net_income_growth: "net_income_yoy",
  shares_change: "shares_outstanding_yoy",
  eps_basic: "eps_basic",
  fcf_ps: "fcf_per_share",
  dividends_ps: "dividends_per_share",
  dividend_growth: "dividends_per_share_yoy",
  effective_tax_rate: "effective_tax_rate",

  bs_cash_eq: "cash_equivalents",
  bs_sti: "short_term_investments",
  bs_cash_sti: "cash_and_short_term_investments",
  bs_ar: "accounts_receivable",
  bs_other_recv: "other_receivables",
  bs_trade_recv: "accounts_receivable",
  bs_other_ca: "other_current_assets",
  bs_total_ca: "total_current_assets",
  bs_ppe: "property_plant_equipment",
  bs_intangibles: "intangible_assets",
  bs_goodwill: "goodwill",
  bs_lt_inv: "long_term_investments",
  bs_other_nca: "other_non_current_assets",
  bs_ap: "accounts_payable",
  bs_accrued: "accrued_liabilities",
  bs_other_cl: "other_current_liabilities",
  bs_current_liab: "total_current_liabilities",
  bs_other_ncl: "non_current_liabilities",
  bs_total_ncl: "non_current_liabilities",
  bs_treasury: "treasury_stock",
  bs_apic: "additional_paid_in_capital",
  bs_debt: "total_debt",
  bs_net_cash: "net_cash",
  bs_book: "book_value",
  bs_tangible: "tangible_book_value",

  cf_depreciation: "depreciation_amortization",
  cf_sbc: "stock_based_compensation",
  cf_other_adj: "other_non_cash_adjustments",
  cf_recv: "change_in_receivables",
  cf_ap: "change_in_accounts_payable",
  cf_other_op: "change_in_other_operating",
  cf_op: "operating_cash_flow",
  cf_op_growth: "operating_cash_flow_yoy",
  cf_capex: "capital_expenditures",
  cf_sale_ppe: "sale_of_ppe",
  cf_buy_inv: "purchases_of_investments",
  cf_sell_inv: "proceeds_from_investments",
  cf_acq: "payments_for_acquisitions",
  cf_divest: "proceeds_from_divestitures",
  cf_investments: "investments_cash_flow",
  cf_other_inv: "other_investing_cash_flow",
  cf_inv: "investing_cash_flow",
  cf_st_debt_issued: "short_term_debt_issued",
  cf_st_debt_repaid: "short_term_debt_repaid",
  cf_lt_debt_issued: "long_term_debt_issued",
  cf_lt_debt_repaid: "long_term_debt_repaid",
  cf_net_debt: "net_debt_issued",
  cf_stock_issued: "issuance_common_stock",
  cf_stock_repurchased: "repurchase_common_stock",
  cf_net_stock: "net_common_stock",
  cf_div: "dividends_paid",
  cf_other_fin: "other_financing_cash_flow",
  cf_fin: "financing_cash_flow",
  cf_fx: "exchange_rate_effect",
  cf_change_cash: "change_in_cash",
  cf_fcf_growth: "free_cash_flow_yoy",
  cf_fcf_ps: "fcf_per_share",
  cf_fcf_margin: "fcf_margin",
  cf_levered_fcf: "levered_free_cash_flow",
  cf_unlevered_fcf: "unlevered_free_cash_flow",

  r_mcap_growth: "market_cap_yoy",
  r_peg: "peg_ratio",
  r_ptbv: "price_to_tangible_book",
  r_pocf: "price_ocf",
  r_ev_ebit: "ev_to_ebit",
  r_ev_fcf: "ev_to_fcf",
  r_debt_ebitda: "debt_to_ebitda",
  r_debt_fcf: "debt_to_fcf",
  r_net_de: "net_debt_to_equity",
  r_net_debt_ebitda: "net_debt_to_ebitda",
  r_net_debt_fcf: "net_debt_to_fcf",
  r_asset_turn: "asset_turnover",
  r_quick: "quick_ratio",
  r_current: "current_ratio",
  r_roic: "return_on_invested_capital",
  r_earn_y: "earnings_yield",
  r_fcf_y: "fcf_yield",
};

export function resolveFinancialsRowChartMetric(row: IncomeStatementRowModel): ChartingMetricId | null {
  if (row.chartingMetricId) return row.chartingMetricId;
  return FINANCIALS_ROW_CHART_METRIC[row.id] ?? null;
}

/** Ensures every chartable Financials row opens the fundamentals chart modal when clicked. */
export function attachFinancialsRowCharts(model: IncomeStatementTableModel): IncomeStatementTableModel {
  return {
    ...model,
    rows: model.rows.map((row) => {
      const chartingMetricId = resolveFinancialsRowChartMetric(row);
      return chartingMetricId ? { ...row, chartingMetricId } : row;
    }),
  };
}
