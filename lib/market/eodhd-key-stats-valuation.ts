import "server-only";

import { pickLatestBalanceSheetRow } from "@/lib/market/eodhd-balance-sheet";
import { fetchEodhdFundamentalsJson } from "@/lib/market/eodhd-fundamentals";
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

export type KeyStatsValuationRow = { label: string; value: string };

export async function fetchEodhdKeyStatsValuation(ticker: string): Promise<{ rows: KeyStatsValuationRow[] } | null> {
  const root = await fetchEodhdFundamentalsJson(ticker);
  if (!root) return null;

  const hl = root.Highlights && typeof root.Highlights === "object" ? (root.Highlights as Record<string, unknown>) : null;
  const val = root.Valuation && typeof root.Valuation === "object" ? (root.Valuation as Record<string, unknown>) : null;
  const row = pickLatestBalanceSheetRow(root);

  const peRatio = num(hl?.PERatio ?? hl?.PE);
  const trailingPe = num(hl?.TrailingPE ?? hl?.TrailingPe);
  const forwardPe = num(hl?.ForwardPE ?? hl?.ForwardPe);
  const ps = num(hl?.PriceSalesTTM ?? hl?.PriceToSalesTTM ?? hl?.PSRatio);
  const pb = num(hl?.PriceBookMRQ ?? hl?.PriceToBookMRQ ?? hl?.PriceBook);

  const priceFcf = num(
    val?.PriceFreeCashFlow ??
      val?.PriceFCF ??
      hl?.PriceFreeCashFlow ??
      hl?.PriceToFreeCashFlowsTTM,
  );

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

  const peDisplay =
    peRatio != null ? formatRatio(peRatio) : trailingPe != null ? formatRatio(trailingPe) : "—";
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
