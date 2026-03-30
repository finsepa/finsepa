function comparePeriodKeys(a: string, b: string): number {
  const ta = Date.parse(a.includes("T") ? a : `${a}T12:00:00.000Z`);
  const tb = Date.parse(b.includes("T") ? b : `${b}T12:00:00.000Z`);
  if (Number.isFinite(ta) && Number.isFinite(tb)) return ta - tb;
  return a.localeCompare(b);
}

/** TTM / single-row objects that are already one period (not nested by date). */
function asIncomeStatementRow(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const keys = [
    "totalRevenue",
    "TotalRevenue",
    "revenue",
    "Revenue",
    "netIncome",
    "NetIncome",
    "grossProfit",
    "GrossProfit",
  ];
  if (keys.some((k) => o[k] != null)) return o;
  return null;
}

/**
 * Latest period row from EODHD `Financials.Income_Statement`:
 * prefers TTM block, then `yearly`, then `quarterly`, then flat date-keyed object.
 */
export function pickLatestIncomeStatementRow(root: Record<string, unknown>): Record<string, unknown> | null {
  const fin = root.Financials;
  if (!fin || typeof fin !== "object") return null;
  const f = fin as Record<string, unknown>;
  const is = (f.Income_Statement ?? f.IncomeStatement) as unknown;
  if (!is || typeof is !== "object") return null;
  const inc = is as Record<string, unknown>;

  const ttmRow = asIncomeStatementRow(inc.ttm ?? inc.TTM ?? inc.trailing_twelve_months);
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

  const yearly = pickFromBlock(inc.yearly);
  if (yearly) return yearly;
  const quarterly = pickFromBlock(inc.quarterly);
  if (quarterly) return quarterly;
  return pickFromBlock(inc);
}
