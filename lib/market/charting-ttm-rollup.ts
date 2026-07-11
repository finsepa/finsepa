import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function sumQuarterlyField(
  quarters: readonly ChartingSeriesPoint[],
  key: keyof ChartingSeriesPoint,
): number | null {
  let sum: number | null = null;
  for (const q of quarters) {
    const v = q[key];
    if (typeof v === "number" && Number.isFinite(v)) sum = (sum ?? 0) + v;
  }
  return sum;
}

/** Income statement + cash flow fields rolled up as sums over the last four quarters. */
const TTM_SUM_FIELDS = [
  "revenue",
  "grossProfit",
  "sga",
  "researchAndDevelopment",
  "otherOperatingExpense",
  "totalOperatingExpenses",
  "operatingIncome",
  "ebit",
  "netIncome",
  "ebitda",
  "eps",
  "epsBasic",
  "incomeBeforeTax",
  "incomeTaxExpense",
  "interestExpense",
  "freeCashFlow",
  "dividendsPaid",
  "dividendsPerShare",
  "cfDepreciationAmortization",
  "cfStockBasedCompensation",
  "cfOtherNonCashItems",
  "cfChangeInReceivables",
  "cfChangeInAccountsPayable",
  "cfChangeInOtherOperating",
  "cfOtherOperatingCashFlow",
  "cfChangeInWorkingCapital",
  "operatingCashFlow",
  "capitalExpenditures",
  "cfSaleOfPpe",
  "cfPurchasesOfInvestments",
  "cfProceedsFromInvestments",
  "cfPaymentsForAcquisitions",
  "cfProceedsFromDivestitures",
  "cfInvestments",
  "cfOtherInvestingCashFlow",
  "investingCashFlow",
  "cfShortTermDebtIssued",
  "cfShortTermDebtRepaid",
  "cfLongTermDebtIssued",
  "cfLongTermDebtRepaid",
  "cfNetDebtIssued",
  "cfIssuanceOfCommonStock",
  "cfRepurchaseOfCommonStock",
  "cfNetCommonStock",
  "cfOtherFinancingCashFlow",
  "financingCashFlow",
  "changeInCash",
  "cfExchangeRateEffect",
  "leveredFreeCashFlow",
  "unleveredFreeCashFlow",
] as const satisfies readonly (keyof ChartingSeriesPoint)[];

/** Cleared on LTM — recomputed downstream or not meaningful vs fiscal years. */
const TTM_CLEAR_FIELDS = [
  "effectiveTaxRate",
  "grossMargin",
  "operatingMargin",
  "ebitdaMargin",
  "netMargin",
  "preTaxMargin",
  "fcfMargin",
  "revenueYoy",
  "revenue3yCagr",
  "grossProfitYoy",
  "epsYoy",
  "eps3yCagr",
  "eps5yCagr",
  "dividendsPerShareYoy",
  "netIncomeYoy",
  "sharesOutstandingYoy",
  "marketCapYoy",
  "operatingCashFlowYoy",
  "freeCashFlowYoy",
  "peRatio",
  "trailingPe",
  "forwardPe",
  "psRatio",
  "priceBook",
  "priceFcf",
  "evEbitda",
  "evSales",
  "cashDebt",
  "dividendYield",
  "payoutRatio",
  "returnOnEquity",
  "returnOnAssets",
  "returnOnCapitalEmployed",
  "returnOnInvestment",
  "pegRatio",
  "priceToTangibleBook",
  "priceOcf",
  "evToEbit",
  "evToFcf",
  "debtToEbitda",
  "debtToFcf",
  "netDebtToEquity",
  "netDebtToEbitda",
  "netDebtToFcf",
  "assetTurnover",
  "quickRatio",
  "currentRatio",
  "returnOnInvestedCapital",
  "earningsYield",
  "fcfYield",
  "cashConversion",
  "interestCover",
  "fcfPerShare",
  "drawdown",
] as const satisfies readonly (keyof ChartingSeriesPoint)[];

function chartingPointHasNumericData(p: ChartingSeriesPoint): boolean {
  return Object.values(p).some((v) => typeof v === "number" && Number.isFinite(v));
}

/**
 * Build trailing-twelve-months from the last four quarterly {@link ChartingSeriesPoint} rows.
 * Balance-sheet fields stay at the latest quarter; income / cash-flow fields are summed.
 */
export function rollupChartingPointsToTtm(
  quarterly: readonly ChartingSeriesPoint[],
): ChartingSeriesPoint | null {
  if (!quarterly.length) return null;

  const sorted = [...quarterly].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
  const last4 = sorted.slice(-4);
  const latest = last4[last4.length - 1];
  if (!latest) return null;

  const p: ChartingSeriesPoint = { ...latest, periodEnd: latest.periodEnd };

  for (const key of TTM_CLEAR_FIELDS) {
    p[key] = null;
  }

  for (const key of TTM_SUM_FIELDS) {
    p[key] = sumQuarterlyField(last4, key);
  }

  return chartingPointHasNumericData(p) ? p : null;
}

/** Fill gaps on an LTM point from EODHD Highlights (RevenueTTM, EBITDA, etc.). */
export function patchChartingTtmFromHighlights(
  p: ChartingSeriesPoint,
  root: Record<string, unknown>,
): void {
  const hl =
    root.Highlights && typeof root.Highlights === "object"
      ? (root.Highlights as Record<string, unknown>)
      : null;
  if (!hl) return;

  if (p.revenue == null) p.revenue = num(hl.RevenueTTM ?? hl.Revenue ?? hl.TotalRevenue);
  if (p.ebitda == null) p.ebitda = num(hl.EBITDA);
  if (p.eps == null) p.eps = num(hl.EarningsShare ?? hl.DilutedEPS ?? hl.EPS);
  if (p.netIncome == null) p.netIncome = num(hl.NetIncome ?? hl.NetIncomeTTM);
  if (p.marketCap == null) p.marketCap = num(hl.MarketCapitalization);
}
