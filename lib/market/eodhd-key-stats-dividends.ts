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

  const rows: KeyStatsDividendsRow[] = [
    { label: "Yield", value: yieldRatio != null ? formatPercentMetric(yieldRatio) : "—" },
    { label: "Payout", value: payout != null ? formatPercentMetric(payout) : "—" },
  ];

  return { rows };
}
