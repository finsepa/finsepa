import "server-only";

import { pickLatestBalanceSheetRow } from "@/lib/market/eodhd-balance-sheet";
import { fetchEodhdFundamentalsJson } from "@/lib/market/eodhd-fundamentals";
import { formatPercentMetric, formatUsdCompact } from "@/lib/market/key-stats-basic-format";

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

export type KeyStatsAssetsRow = { label: string; value: string };

export async function fetchEodhdKeyStatsAssetsLiabilities(ticker: string): Promise<{ rows: KeyStatsAssetsRow[] } | null> {
  const root = await fetchEodhdFundamentalsJson(ticker);
  if (!root) return null;

  const hl = root.Highlights && typeof root.Highlights === "object" ? (root.Highlights as Record<string, unknown>) : null;
  const row = pickLatestBalanceSheetRow(root);

  let totalAssets = numFromRow(row, ["totalAssets", "TotalAssets"]);
  let cash = numFromRow(row, [
    "cashAndCashEquivalents",
    "CashAndCashEquivalents",
    "cash",
    "Cash",
    "cashAndShortTermInvestments",
    "CashAndShortTermInvestments",
  ]);
  let longTermDebt = numFromRow(row, ["longTermDebt", "LongTermDebt", "longTermDebtNoncurrent"]);
  let totalLiab = numFromRow(row, ["totalLiab", "TotalLiab", "totalLiabilities", "TotalLiabilities"]);
  let equity = numFromRow(row, [
    "totalStockholderEquity",
    "TotalStockholderEquity",
    "totalStockholdersEquity",
    "ShareholdersEquity",
    "ShareHolderEquity",
  ]);

  if (totalAssets == null && hl) totalAssets = num(hl.TotalAssets ?? hl.TotalAssetsTTM);
  if (cash == null && hl) cash = num(hl.CashAndCashEquivalents ?? hl.Cash);

  let debtToEquity = num(hl?.DebtToEquity ?? hl?.DebtEquityRatio ?? hl?.TotalDebtToEquity);
  if (debtToEquity == null && row) {
    const debt = numFromRow(row, ["longTermDebt", "LongTermDebt", "shortLongTermDebtTotal", "totalDebt"]);
    if (debt != null && equity != null && equity !== 0) {
      debtToEquity = debt / Math.abs(equity);
    }
  }

  const rows: KeyStatsAssetsRow[] = [
    { label: "Total Assets", value: totalAssets != null ? formatUsdCompact(totalAssets) : "—" },
    { label: "Cash on Hand", value: cash != null ? formatUsdCompact(cash) : "—" },
    { label: "Long Term Debt", value: longTermDebt != null ? formatUsdCompact(longTermDebt) : "—" },
    { label: "Total Liabilities", value: totalLiab != null ? formatUsdCompact(totalLiab) : "—" },
    { label: "Share Holder Equity", value: equity != null ? formatUsdCompact(equity) : "—" },
    { label: "Debt/Equity", value: debtToEquity != null ? formatPercentMetric(debtToEquity) : "—" },
  ];

  return { rows };
}
