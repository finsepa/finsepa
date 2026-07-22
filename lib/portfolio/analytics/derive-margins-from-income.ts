/**
 * Derive gross / operating margins from income-statement rows when Highlights omit ratios.
 * Shared with stock Key Stats field fallbacks (GrossProfit ÷ Revenue, etc.).
 */

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function numFromRow(row: Record<string, unknown> | null | undefined, keys: string[]): number | null {
  if (!row) return null;
  for (const k of keys) {
    const n = num(row[k]);
    if (n != null) return n;
  }
  return null;
}

export function deriveMarginsFromIncome(
  hl: Record<string, unknown> | null | undefined,
  incRow: Record<string, unknown> | null | undefined,
): { gross: number | null; operating: number | null } {
  let revenue = numFromRow(incRow, [
    "totalRevenue",
    "TotalRevenue",
    "revenue",
    "Revenue",
    "totalRevenueFromOperations",
    "Sales",
  ]);
  if (revenue == null && hl) {
    revenue = num(hl.RevenueTTM ?? hl.Revenue ?? hl.TotalRevenue);
  }
  if (revenue == null || Math.abs(revenue) < 1e-9) {
    return { gross: null, operating: null };
  }

  const gp = numFromRow(incRow, ["grossProfit", "GrossProfit", "grossIncome", "GrossIncome"]);
  const op = numFromRow(incRow, [
    "operatingIncome",
    "OperatingIncome",
    "operationIncome",
    "operatingIncomeLoss",
    "OperatingIncomeLoss",
  ]);

  return {
    gross: gp != null ? gp / revenue : null,
    operating: op != null ? op / revenue : null,
  };
}
