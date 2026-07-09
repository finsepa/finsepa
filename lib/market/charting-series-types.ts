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
  /** Selling, general & administrative (income statement). */
  sga: number | null;
  researchAndDevelopment: number | null;
  otherOperatingExpense: number | null;
  totalOperatingExpenses: number | null;
  operatingIncome: number | null;
  /** EBIT when reported separately from operating income (else mirrors operating income). */
  ebit: number | null;
  netIncome: number | null;
  ebitda: number | null;
  eps: number | null;
  /** Basic (non-diluted) earnings per share from the income statement. */
  epsBasic: number | null;
  incomeBeforeTax: number | null;
  incomeTaxExpense: number | null;
  /** Interest expense (income statement) — used for interest cover. */
  interestExpense: number | null;
  /** Effective tax rate as a decimal (e.g. 0.2813 = 28.13%). */
  effectiveTaxRate: number | null;

  freeCashFlow: number | null;
  dividendsPaid: number | null;
  /** Cash dividends per diluted share (annual or TTM when merged). */
  dividendsPerShare: number | null;

  /** Cash flow statement — operating section. */
  cfDepreciationAmortization: number | null;
  cfStockBasedCompensation: number | null;
  cfOtherNonCashItems: number | null;
  cfChangeInReceivables: number | null;
  cfChangeInAccountsPayable: number | null;
  cfChangeInOtherOperating: number | null;
  cfOtherOperatingCashFlow: number | null;
  cfChangeInWorkingCapital: number | null;
  operatingCashFlow: number | null;
  /** Cash flow statement — investing section. */
  capitalExpenditures: number | null;
  cfSaleOfPpe: number | null;
  cfPurchasesOfInvestments: number | null;
  cfProceedsFromInvestments: number | null;
  cfPaymentsForAcquisitions: number | null;
  cfProceedsFromDivestitures: number | null;
  cfInvestments: number | null;
  cfOtherInvestingCashFlow: number | null;
  investingCashFlow: number | null;
  /** Cash flow statement — financing section. */
  cfShortTermDebtIssued: number | null;
  cfShortTermDebtRepaid: number | null;
  cfLongTermDebtIssued: number | null;
  cfLongTermDebtRepaid: number | null;
  cfNetDebtIssued: number | null;
  cfIssuanceOfCommonStock: number | null;
  cfRepurchaseOfCommonStock: number | null;
  cfNetCommonStock: number | null;
  cfOtherFinancingCashFlow: number | null;
  financingCashFlow: number | null;
  changeInCash: number | null;
  cfExchangeRateEffect: number | null;
  /** Per-share / alternate FCF metrics when reported. */
  fcfPerShare: number | null;
  leveredFreeCashFlow: number | null;
  unleveredFreeCashFlow: number | null;

  totalAssets: number | null;
  totalLiabilities: number | null;
  /** Cash only (not including short-term investments). */
  cashEquivalents: number | null;
  /** @deprecated Prefer `cashEquivalents` — kept for legacy charting fields. */
  cashOnHand: number | null;
  shortTermInvestments: number | null;
  cashAndShortTermInvestments: number | null;
  netReceivables: number | null;
  otherReceivables: number | null;
  otherCurrentAssets: number | null;
  totalCurrentAssets: number | null;
  propertyPlantEquipmentNet: number | null;
  intangibleAssets: number | null;
  goodwill: number | null;
  longTermInvestments: number | null;
  otherNonCurrentAssets: number | null;
  accountsPayable: number | null;
  accruedLiabilities: number | null;
  otherCurrentLiabilities: number | null;
  nonCurrentLiabilities: number | null;
  longTermDebt: number | null;
  shareholderEquity: number | null;
  currentLiabilities: number | null;
  totalDebt: number | null;
  debtToEquity: number | null;
  treasuryStock: number | null;
  additionalPaidInCapital: number | null;
  /** Provider net debt (debt − cash); we derive display net cash as cash − debt. */
  netDebt: number | null;
  bookValue: number | null;
  tangibleBookValue: number | null;
  sharesOutstanding: number | null;

  grossMargin: number | null;
  operatingMargin: number | null;
  ebitdaMargin: number | null;
  netMargin: number | null;
  preTaxMargin: number | null;
  fcfMargin: number | null;

  revenueYoy: number | null;
  revenue3yCagr: number | null;
  grossProfitYoy: number | null;
  epsYoy: number | null;
  eps3yCagr: number | null;
  eps5yCagr: number | null;
  dividendsPerShareYoy: number | null;
  netIncomeYoy: number | null;
  sharesOutstandingYoy: number | null;
  marketCapYoy: number | null;
  operatingCashFlowYoy: number | null;
  freeCashFlowYoy: number | null;

  /** Market capitalization (USD) when reported or derived from P/S or P/B. */
  marketCap: number | null;
  /** Enterprise value (USD) from ratios or derived as MC + debt − cash when missing. */
  enterpriseValue: number | null;

  peRatio: number | null;
  trailingPe: number | null;
  forwardPe: number | null;
  psRatio: number | null;
  priceBook: number | null;
  priceFcf: number | null;
  evEbitda: number | null;
  evSales: number | null;
  cashDebt: number | null;

  dividendYield: number | null;
  payoutRatio: number | null;

  returnOnEquity: number | null;
  returnOnAssets: number | null;
  returnOnCapitalEmployed: number | null;
  returnOnInvestment: number | null;

  pegRatio: number | null;
  priceToTangibleBook: number | null;
  priceOcf: number | null;
  evToEbit: number | null;
  evToFcf: number | null;
  debtToEbitda: number | null;
  debtToFcf: number | null;
  netDebtToEquity: number | null;
  netDebtToEbitda: number | null;
  netDebtToFcf: number | null;
  assetTurnover: number | null;
  quickRatio: number | null;
  currentRatio: number | null;
  returnOnInvestedCapital: number | null;
  earningsYield: number | null;
  fcfYield: number | null;
  /** Operating cash flow ÷ net income. */
  cashConversion: number | null;
  /** EBIT ÷ interest expense. */
  interestCover: number | null;

  /** Price drawdown (peak-to-trough) — populated only for price-series charting metrics. */
  drawdown: number | null;
};

/** @deprecated Use ChartingSeriesPoint — kept for imports that expect the old name. */
export type IncomeStatementPoint = ChartingSeriesPoint;
