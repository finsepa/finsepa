import "server-only";

function comparePeriodKeys(a: string, b: string): number {
  const ta = Date.parse(a.includes("T") ? a : `${a}T12:00:00.000Z`);
  const tb = Date.parse(b.includes("T") ? b : `${b}T12:00:00.000Z`);
  if (Number.isFinite(ta) && Number.isFinite(tb)) return ta - tb;
  return a.localeCompare(b);
}

/**
 * Latest row from `Financials.*` blocks (Ratios, Cash_Flow, etc.) — prefers TTM, then yearly, then quarterly.
 */
export function pickLatestFinancialSubTable(
  root: Record<string, unknown>,
  blockNames: [string, string][],
): Record<string, unknown> | null {
  const fin = root.Financials;
  if (!fin || typeof fin !== "object") return null;
  const f = fin as Record<string, unknown>;
  let raw: unknown = null;
  for (const [a, b] of blockNames) {
    raw = f[a] ?? f[b];
    if (raw && typeof raw === "object" && !Array.isArray(raw)) break;
  }
  if (!raw || typeof raw !== "object") return null;
  const block = raw as Record<string, unknown>;
  const ttm = block.ttm ?? block.TTM ?? block.trailing_twelve_months;
  if (ttm && typeof ttm === "object" && !Array.isArray(ttm)) return ttm as Record<string, unknown>;

  const pickFromBlock = (sub: unknown): Record<string, unknown> | null => {
    if (!sub || typeof sub !== "object" || Array.isArray(sub)) return null;
    const b = sub as Record<string, unknown>;
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

  return pickFromBlock(block.yearly) ?? pickFromBlock(block.quarterly) ?? pickFromBlock(block);
}
