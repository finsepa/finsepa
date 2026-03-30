function comparePeriodKeys(a: string, b: string): number {
  const ta = Date.parse(a.includes("T") ? a : `${a}T12:00:00.000Z`);
  const tb = Date.parse(b.includes("T") ? b : `${b}T12:00:00.000Z`);
  if (Number.isFinite(ta) && Number.isFinite(tb)) return ta - tb;
  return a.localeCompare(b);
}

function asBalanceSheetRow(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const keys = [
    "totalAssets",
    "TotalAssets",
    "totalLiab",
    "TotalLiab",
    "totalStockholderEquity",
    "cash",
    "CashAndCashEquivalents",
  ];
  if (keys.some((k) => o[k] != null)) return o;
  return null;
}

/**
 * Latest period row from EODHD `Financials.Balance_Sheet`:
 * prefers TTM, then `yearly`, then `quarterly`, then flat date keys.
 */
export function pickLatestBalanceSheetRow(root: Record<string, unknown>): Record<string, unknown> | null {
  const fin = root.Financials;
  if (!fin || typeof fin !== "object") return null;
  const f = fin as Record<string, unknown>;
  const raw = (f.Balance_Sheet ?? f.BalanceSheet) as unknown;
  if (!raw || typeof raw !== "object") return null;
  const bs = raw as Record<string, unknown>;

  const ttmRow = asBalanceSheetRow(bs.ttm ?? bs.TTM ?? bs.trailing_twelve_months);
  if (ttmRow) return ttmRow;

  const pickFromBlock = (block: unknown): Record<string, unknown> | null => {
    if (!block || typeof block !== "object" || Array.isArray(block)) return null;
    const b = block as Record<string, unknown>;
    const keys = Object.keys(b).filter((k) => {
      const v = b[k];
      return v != null && typeof v === "object" && !Array.isArray(v);
    });
    if (!keys.length) return null;
    keys.sort(comparePeriodKeys);
    const last = keys[keys.length - 1];
    if (!last) return null;
    const row = b[last];
    return row && typeof row === "object" && !Array.isArray(row) ? (row as Record<string, unknown>) : null;
  };

  const yearly = pickFromBlock(bs.yearly);
  if (yearly) return yearly;
  const quarterly = pickFromBlock(bs.quarterly);
  if (quarterly) return quarterly;
  return pickFromBlock(bs);
}
