export type FundamentalsSeriesMode = "annual" | "quarterly";

/**
 * One row per fiscal period — merged income statement, balance sheet, cash flow,
 * optional per-period ratios, and computed fields. All values are raw numbers
 * (ratios/margins/YoY stored as decimals, e.g. 0.22 = 22%).
 */
export type ChartingSeriesPoint = {
  periodEnd: string;

  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  ebitda: number | null;
  eps: number | null;
  incomeBeforeTax: number | null;

  freeCashFlow: number | null;
  dividendsPaid: number | null;

  totalAssets: number | null;
  totalLiabilities: number | null;
  cashOnHand: number | null;
  longTermDebt: number | null;
  shareholderEquity: number | null;
  currentLiabilities: number | null;
  totalDebt: number | null;
  debtToEquity: number | null;
  sharesOutstanding: number | null;

  grossMargin: number | null;
  operatingMargin: number | null;
  ebitdaMargin: number | null;
  netMargin: number | null;
  preTaxMargin: number | null;
  fcfMargin: number | null;

  revenueYoy: number | null;
  revenue3yCagr: number | null;
  epsYoy: number | null;
  eps3yCagr: number | null;

  /** Market capitalization (USD) when reported or derived from P/S or P/B. */
  marketCap: number | null;

  peRatio: number | null;
  trailingPe: number | null;
  forwardPe: number | null;
  psRatio: number | null;
  priceBook: number | null;
  evEbitda: number | null;
  evSales: number | null;
  cashDebt: number | null;

  dividendYield: number | null;
  payoutRatio: number | null;

  returnOnEquity: number | null;
  returnOnAssets: number | null;
  returnOnCapitalEmployed: number | null;
  returnOnInvestment: number | null;
};

/** @deprecated Use ChartingSeriesPoint — kept for imports that expect the old name. */
export type IncomeStatementPoint = ChartingSeriesPoint;
