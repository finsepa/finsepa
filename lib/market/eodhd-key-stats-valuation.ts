import "server-only";

import { pickLatestBalanceSheetRow } from "@/lib/market/eodhd-balance-sheet";
import {
  extractMarketCapUsdFromFundamentalsRoot,
  fetchEodhdFundamentalsJson,
} from "@/lib/market/eodhd-fundamentals";
import { pickLatestIncomeStatementRow } from "@/lib/market/eodhd-income-statement";
import { pickLatestFinancialSubTable } from "@/lib/market/eodhd-pick-financial-block";
import { formatRatio } from "@/lib/market/key-stats-basic-format";

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function numFromRow(row: Record<string, unknown> | null, keys: string[]): number | null {
  if (!row) return null;
  for (const k of keys) {
    const n = num(row[k]);
    if (n != null) return n;
  }
  return null;
}

/** Try each section in order (e.g. Highlights then Valuation) — EODHD often stores ratios under Valuation only. */
function firstNumFromSections(sections: (Record<string, unknown> | null | undefined)[], keys: string[]): number | null {
  for (const sec of sections) {
    const n = numFromRow(sec ?? null, keys);
    if (n != null) return n;
  }
  return null;
}

/**
 * Key Stats "P/E Ratio" value: `PERatio` (Highlights/Valuation), else `TrailingPE` — same {@link formatRatio} as the stock page.
 */
export function peRatioKeyStatsDisplayFromPeParts(peRatio: number | null, trailingPe: number | null): string {
  return peRatio != null ? formatRatio(peRatio) : trailingPe != null ? formatRatio(trailingPe) : "—";
}

/**
 * Key Stats "P/E Ratio" from a fundamentals JSON root (shared cache with Key Stats & header).
 */
export function peRatioKeyStatsDisplayFromFundamentalsRoot(
  root: Record<string, unknown> | null | undefined,
): string {
  if (!root || typeof root !== "object") return "—";
  const hl = root.Highlights && typeof root.Highlights === "object" ? (root.Highlights as Record<string, unknown>) : null;
  const val = root.Valuation && typeof root.Valuation === "object" ? (root.Valuation as Record<string, unknown>) : null;
  const peRatio = firstNumFromSections([hl, val], ["PERatio", "PE", "PeRatio"]);
  const trailingPe = firstNumFromSections([hl, val], ["TrailingPE", "TrailingPe"]);
  return peRatioKeyStatsDisplayFromPeParts(peRatio, trailingPe);
}

export type KeyStatsValuationRow = { label: string; value: string };

export async function fetchEodhdKeyStatsValuation(
  ticker: string,
  fundamentalsRoot?: Record<string, unknown> | null,
): Promise<{ rows: KeyStatsValuationRow[] } | null> {
  const root = fundamentalsRoot ?? (await fetchEodhdFundamentalsJson(ticker));
  if (!root) return null;

  const hl = root.Highlights && typeof root.Highlights === "object" ? (root.Highlights as Record<string, unknown>) : null;
  const val = root.Valuation && typeof root.Valuation === "object" ? (root.Valuation as Record<string, unknown>) : null;
  const ss = root.SharesStats && typeof root.SharesStats === "object" ? (root.SharesStats as Record<string, unknown>) : null;
  const ar = root.AnalystRatings && typeof root.AnalystRatings === "object" ? (root.AnalystRatings as Record<string, unknown>) : null;
  const row = pickLatestBalanceSheetRow(root);
  const ratiosRow = pickLatestFinancialSubTable(root, [["Ratios", "Financial_Ratios"]]);
  const cfRow = pickLatestFinancialSubTable(root, [["Cash_Flow", "CashFlow"]]);
  const incRow = pickLatestIncomeStatementRow(root);
  const marketCap = extractMarketCapUsdFromFundamentalsRoot(root);

  const peRatio = firstNumFromSections([hl, val], ["PERatio", "PE", "PeRatio"]);
  const trailingPe = firstNumFromSections([hl, val], ["TrailingPE", "TrailingPe"]);
  let forwardPe = firstNumFromSections([hl, val, ratiosRow], [
    "ForwardPE",
    "ForwardPe",
    "ForwardPEPS",
    "forwardPE",
    "ForwardPeRatio",
  ]);
  let ps = firstNumFromSections([hl, val, ratiosRow], [
    "PriceSalesTTM",
    "PriceToSalesTTM",
    "PSRatio",
    "PriceSales",
    "PriceToSales",
    "PSRatioTTM",
    "PriceToSalesRatio",
  ]);
  let pb = firstNumFromSections([hl, val, ratiosRow], [
    "PriceBookMRQ",
    "PriceToBookMRQ",
    "PriceBook",
    "PBRatio",
    "PriceToBook",
    "PriceBookRatio",
  ]);

  let priceFcf = firstNumFromSections([hl, val, ratiosRow], [
    "PriceFreeCashFlow",
    "PriceFCF",
    "PriceToFreeCashFlow",
    "PriceToFCF",
    "PriceToFreeCashFlowsTTM",
    "PriceToFreeCashFlowTTM",
    "PriceCashFlow",
    "PFCFRatio",
    "PriceToCashFlow",
  ]);

  // Computed fallbacks when provider omits ratio fields (common on US large caps).
  if (ps == null && marketCap != null) {
    let revenue = numFromRow(incRow, [
      "totalRevenue",
      "TotalRevenue",
      "revenue",
      "Revenue",
      "totalRevenueFromOperations",
      "Sales",
    ]);
    if (revenue == null && hl) revenue = num(hl.RevenueTTM ?? hl.Revenue ?? hl.TotalRevenue);
    if (revenue != null && revenue > 0) ps = marketCap / revenue;
  }

  if (pb == null && marketCap != null && row) {
    const bookEquity = numFromRow(row, [
      "totalStockholderEquity",
      "TotalStockholderEquity",
      "stockholdersEquity",
      "StockholdersEquity",
      "totalEquity",
      "TotalEquity",
    ]);
    if (bookEquity != null && Math.abs(bookEquity) > 1e-6) pb = marketCap / Math.abs(bookEquity);
  }

  if (forwardPe == null && marketCap != null) {
    const shares = firstNumFromSections([hl, ss], ["SharesOutstanding", "SharesOut"]);
    const forwardEps = firstNumFromSections([hl, val, ar], [
      "ForwardEPS",
      "ForwardEps",
      "EPSEstimateNextYear",
      "EarningsShareForward",
      "EPSNextYear",
      "EstimatedEPS",
      "EPSEstimate",
      "MeanEPS",
      "epsEstimate",
    ]);
    if (shares != null && shares > 0 && forwardEps != null && forwardEps > 0) {
      forwardPe = marketCap / (shares * forwardEps);
    }
  }

  if (priceFcf == null && marketCap != null) {
    let fcf = cfRow
      ? numFromRow(cfRow, ["freeCashFlow", "FreeCashFlow", "FreeCashFlows"])
      : null;
    if (fcf == null && hl) fcf = num(hl.FreeCashFlowTTM ?? hl.FreeCashFlow);
    if (fcf != null && fcf > 0) priceFcf = marketCap / fcf;
  }

  const evEbitda = num(
    val?.EnterpriseValueEbitda ?? val?.EnterpriseValueEBITDA ?? val?.EVToEBITDA ?? hl?.EnterpriseValueEbitda,
  );
  const evSales = num(
    val?.EnterpriseValueRevenue ?? val?.EnterpriseValueSales ?? val?.EVToSales ?? hl?.EnterpriseValueRevenue,
  );

  let cash = numFromRow(row, [
    "cashAndCashEquivalents",
    "CashAndCashEquivalents",
    "cash",
    "Cash",
    "cashAndShortTermInvestments",
    "CashAndShortTermInvestments",
  ]);
  if (cash == null && hl) cash = num(hl.CashAndCashEquivalents ?? hl.Cash);

  let totalDebt = numFromRow(row, [
    "shortLongTermDebtTotal",
    "totalDebt",
    "TotalDebt",
    "LongTermDebtTotal",
  ]);
  const st = numFromRow(row, ["shortTermDebt", "ShortTermDebt"]);
  const lt = numFromRow(row, ["longTermDebt", "LongTermDebt"]);
  if (totalDebt == null && (st != null || lt != null)) {
    totalDebt = (st ?? 0) + (lt ?? 0);
  }
  let cashDebt: number | null = null;
  if (cash != null && totalDebt != null && totalDebt > 0) {
    cashDebt = cash / totalDebt;
  }

  const peDisplay = peRatioKeyStatsDisplayFromPeParts(peRatio, trailingPe);
  const trailDisplay =
    trailingPe != null ? formatRatio(trailingPe) : peRatio != null ? formatRatio(peRatio) : "—";
  const forwardDisplay = forwardPe != null ? formatRatio(forwardPe) : "—";

  const rows: KeyStatsValuationRow[] = [
    { label: "P/E Ratio", value: peDisplay },
    { label: "Trailing P/E", value: trailDisplay },
    { label: "Forward P/E", value: forwardDisplay },
    { label: "P/S Ratio", value: ps != null ? formatRatio(ps) : "—" },
    { label: "Price/Book Ratio", value: pb != null ? formatRatio(pb) : "—" },
    { label: "Price/FCF Ratio", value: priceFcf != null ? formatRatio(priceFcf) : "—" },
    { label: "EV/EBITDA", value: evEbitda != null ? formatRatio(evEbitda) : "—" },
    { label: "EV/Sales", value: evSales != null ? formatRatio(evSales) : "—" },
    { label: "Cash/Debt", value: cashDebt != null ? formatRatio(cashDebt) : "—" },
  ];

  return { rows };
}
