import "server-only";

import { fetchEodhdFundamentalsJson } from "@/lib/market/eodhd-fundamentals";
import { pickLatestIncomeStatementRow } from "@/lib/market/eodhd-income-statement";
import { pickLatestFinancialSubTable } from "@/lib/market/eodhd-pick-financial-block";
import { formatPercentMetric } from "@/lib/market/key-stats-basic-format";

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

function firstNumFromSections(sections: (Record<string, unknown> | null | undefined)[], keys: string[]): number | null {
  for (const sec of sections) {
    const n = numFromRow(sec ?? null, keys);
    if (n != null) return n;
  }
  return null;
}

function impliedSharePriceUsd(root: Record<string, unknown>): number | null {
  const hl = root.Highlights && typeof root.Highlights === "object" ? (root.Highlights as Record<string, unknown>) : null;
  const ss = root.SharesStats && typeof root.SharesStats === "object" ? (root.SharesStats as Record<string, unknown>) : null;
  const mc = num(hl?.MarketCapitalization);
  const shares =
    num(ss?.SharesOutstanding) ??
    num(hl?.SharesOutstanding) ??
    num(ss?.SharesFloat);
  if (mc != null && shares != null && shares > 0) return mc / shares;
  return null;
}

const PAYOUT_KEYS = [
  "PayoutRatio",
  "PayoutRatioTTM",
  "DividendPayoutRatio",
  "DividendPayoutRatioTTM",
  "Payout",
  "payoutRatio",
  "dividendPayoutRatio",
];

const YIELD_FORWARD_KEYS = [
  "ForwardAnnualDividendYield",
  "ForwardAnnualDividendYieldTTM",
  "ForwardDividendYield",
];

const YIELD_TRAILING_KEYS = ["DividendYield", "DividendYieldTTM", "Yield", "TrailingDividendYield"];

const ANNUAL_DIVIDEND_PER_SHARE_KEYS = [
  "DividendShare",
  "ForwardAnnualDividendRate",
  "DividendRate",
  "AnnualDividend",
];

const DIVIDENDS_PAID_KEYS = [
  "dividendsPaid",
  "DividendsPaid",
  "cashDividendsPaid",
  "CashDividendsPaid",
  "commonDividendsPaid",
  "totalCashDividendsPaid",
];

const NET_INCOME_KEYS = ["netIncome", "NetIncome", "netIncomeApplicableToCommonShares"];

const SHARES_OUT_KEYS = [
  "commonStockSharesOutstanding",
  "CommonStockSharesOutstanding",
  "commonStockTotalSharesOutstanding",
  "sharesOutstandingDiluted",
  "dilutedAverageShares",
  "DilutedAverageShares",
  "weightedAverageShsOutDil",
  "WeightedAverageShsOutDil",
  "SharesOutstanding",
  "shares",
];

const REPURCHASE_KEYS = [
  "repurchaseOfCommonStock",
  "RepurchaseOfCommonStock",
  "paymentsForRepurchaseOfCommonStock",
  "PaymentsForRepurchaseOfCommonStock",
  "commonStockRepurchased",
  "CommonStockRepurchased",
];

function comparePeriodKeys(a: string, b: string): number {
  const ta = Date.parse(a.includes("T") ? a : `${a}T12:00:00.000Z`);
  const tb = Date.parse(b.includes("T") ? b : `${b}T12:00:00.000Z`);
  if (Number.isFinite(ta) && Number.isFinite(tb)) return ta - tb;
  return a.localeCompare(b);
}

/** Chronological yearly rows from a Financials.* block (oldest → newest). */
function yearlyFinancialRows(
  root: Record<string, unknown>,
  blockNames: [string, string][],
): Record<string, unknown>[] {
  const fin = root.Financials;
  if (!fin || typeof fin !== "object") return [];
  const f = fin as Record<string, unknown>;
  let raw: unknown = null;
  for (const [a, b] of blockNames) {
    raw = f[a] ?? f[b];
    if (raw && typeof raw === "object" && !Array.isArray(raw)) break;
  }
  if (!raw || typeof raw !== "object") return [];
  const block = raw as Record<string, unknown>;
  const yearly = block.yearly ?? block.Yearly;
  if (!yearly || typeof yearly !== "object" || Array.isArray(yearly)) return [];
  const b = yearly as Record<string, unknown>;
  const keys = Object.keys(b).filter((k) => {
    const v = b[k];
    return v != null && typeof v === "object" && !Array.isArray(v);
  });
  keys.sort(comparePeriodKeys);
  return keys
    .map((k) => b[k])
    .filter((row): row is Record<string, unknown> => row != null && typeof row === "object" && !Array.isArray(row));
}

function sharesFromOutstandingSharesAnnual(root: Record<string, unknown>): number[] {
  const raw = root.outstandingShares ?? root.OutstandingShares;
  if (!raw || typeof raw !== "object") return [];
  const block = raw as Record<string, unknown>;
  const annual = block.annual ?? block.Annual ?? block.yearly ?? block.Yearly;
  if (!annual || typeof annual !== "object") return [];
  const entries: { key: string; shares: number }[] = [];
  if (Array.isArray(annual)) {
    for (let i = 0; i < annual.length; i++) {
      const row = annual[i];
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const r = row as Record<string, unknown>;
      const shares =
        num(r.shares) ??
        (num(r.sharesMln) != null ? num(r.sharesMln)! * 1e6 : null) ??
        numFromRow(r, SHARES_OUT_KEYS);
      if (shares == null || !(shares > 0)) continue;
      const key =
        String(r.date ?? r.dateFormatted ?? r.Date ?? i);
      entries.push({ key, shares });
    }
  } else {
    for (const [key, row] of Object.entries(annual as Record<string, unknown>)) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const r = row as Record<string, unknown>;
      const shares =
        num(r.shares) ??
        (num(r.sharesMln) != null ? num(r.sharesMln)! * 1e6 : null) ??
        numFromRow(r, SHARES_OUT_KEYS);
      if (shares == null || !(shares > 0)) continue;
      entries.push({ key: String(r.date ?? r.dateFormatted ?? key), shares });
    }
  }
  entries.sort((a, b) => comparePeriodKeys(a.key, b.key));
  return entries.map((e) => e.shares);
}

/**
 * Buyback yield as a ratio (0.02 = 2%): share-count reduction YoY (positive = buybacks).
 * Falls back to |cash repurchase| / market cap when share history is thin.
 */
export function buybackYieldRatioFromFundamentalsRoot(root: Record<string, unknown>): number | null {
  const fromOutstanding = sharesFromOutstandingSharesAnnual(root);
  if (fromOutstanding.length >= 2) {
    const prev = fromOutstanding[fromOutstanding.length - 2]!;
    const cur = fromOutstanding[fromOutstanding.length - 1]!;
    if (Math.abs(prev) > 1e-9) return (prev - cur) / Math.abs(prev);
  }

  const incomeRows = yearlyFinancialRows(root, [
    ["Income_Statement", "IncomeStatement"],
  ]);
  const bsRows = yearlyFinancialRows(root, [
    ["Balance_Sheet", "BalanceSheet"],
  ]);
  const shareSeries: number[] = [];
  const source = incomeRows.length >= 2 ? incomeRows : bsRows;
  for (const row of source) {
    const sh = numFromRow(row, SHARES_OUT_KEYS);
    if (sh != null && sh > 0) shareSeries.push(sh);
  }
  if (shareSeries.length >= 2) {
    const prev = shareSeries[shareSeries.length - 2]!;
    const cur = shareSeries[shareSeries.length - 1]!;
    if (Math.abs(prev) > 1e-9) return (prev - cur) / Math.abs(prev);
  }

  const cf = pickLatestFinancialSubTable(root, [["Cash_Flow", "CashFlow"]]);
  const repurchase = numFromRow(cf, REPURCHASE_KEYS);
  const hl = root.Highlights && typeof root.Highlights === "object" ? (root.Highlights as Record<string, unknown>) : null;
  const mcap = num(hl?.MarketCapitalization);
  if (repurchase != null && mcap != null && mcap > 0) {
    // Cash outflow is typically negative; buybacks are a positive yield.
    return Math.abs(repurchase) / mcap;
  }
  return null;
}

function derivedPayoutRatioFromStatements(root: Record<string, unknown>): number | null {
  const cf = pickLatestFinancialSubTable(root, [["Cash_Flow", "CashFlow"]]);
  const inc = pickLatestIncomeStatementRow(root);
  const dividendsPaid = numFromRow(cf, DIVIDENDS_PAID_KEYS);
  const netIncome = numFromRow(inc, NET_INCOME_KEYS);
  if (dividendsPaid == null || netIncome == null || Math.abs(netIncome) <= 1e-9) return null;
  return Math.abs(dividendsPaid) / Math.abs(netIncome);
}

function resolveDividendYieldRatio(
  root: Record<string, unknown>,
  sections: (Record<string, unknown> | null | undefined)[],
): number | null {
  const forward = firstNumFromSections(sections, YIELD_FORWARD_KEYS);
  if (forward != null) return forward;

  const annualPerShare = firstNumFromSections(sections, ANNUAL_DIVIDEND_PER_SHARE_KEYS);
  if (annualPerShare != null && annualPerShare > 0) {
    const price = impliedSharePriceUsd(root);
    if (price != null && price > 0) return annualPerShare / price;
  }

  return firstNumFromSections(sections, YIELD_TRAILING_KEYS);
}

function resolvePayoutRatio(
  root: Record<string, unknown>,
  sections: (Record<string, unknown> | null | undefined)[],
): number | null {
  const fromProvider = firstNumFromSections(sections, PAYOUT_KEYS);
  if (fromProvider != null) return fromProvider;
  return derivedPayoutRatioFromStatements(root);
}

export type KeyStatsDividendsRow = { label: string; value: string };

/** Dividend yield as a ratio (0.02 = 2%) from an already-loaded fundamentals root. */
export function dividendYieldRatioFromFundamentalsRoot(root: Record<string, unknown>): number | null {
  const hl = root.Highlights && typeof root.Highlights === "object" ? (root.Highlights as Record<string, unknown>) : null;
  const val = root.Valuation && typeof root.Valuation === "object" ? (root.Valuation as Record<string, unknown>) : null;
  const ratiosRow = pickLatestFinancialSubTable(root, [["Ratios", "Financial_Ratios"]]);
  return resolveDividendYieldRatio(root, [hl, val, ratiosRow]);
}

export async function fetchEodhdKeyStatsDividends(
  ticker: string,
  fundamentalsRoot?: Record<string, unknown> | null,
): Promise<{ rows: KeyStatsDividendsRow[] } | null> {
  const root = fundamentalsRoot ?? (await fetchEodhdFundamentalsJson(ticker));
  if (!root) return null;

  const hl = root.Highlights && typeof root.Highlights === "object" ? (root.Highlights as Record<string, unknown>) : null;
  const val = root.Valuation && typeof root.Valuation === "object" ? (root.Valuation as Record<string, unknown>) : null;
  const ratiosRow = pickLatestFinancialSubTable(root, [["Ratios", "Financial_Ratios"]]);
  const sections = [hl, val, ratiosRow];

  const yieldRatio = resolveDividendYieldRatio(root, sections);
  const payout = resolvePayoutRatio(root, sections);
  const buybacks = buybackYieldRatioFromFundamentalsRoot(root);

  const rows: KeyStatsDividendsRow[] = [
    { label: "Yield", value: yieldRatio != null ? formatPercentMetric(yieldRatio) : "—" },
    { label: "Payout", value: payout != null ? formatPercentMetric(payout) : "—" },
    { label: "Buybacks", value: buybacks != null ? formatPercentMetric(buybacks) : "—" },
  ];

  return { rows };
}
