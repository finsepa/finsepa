/** Shown first on `/macro` (valuation block). */
export const MACRO_CHART_PRIORITY_IDS = [
  "shiller_pe",
  "sp500_earnings",
  "sp500_trailing_pe",
] as const;

const PRIORITY_RANK = new Map<string, number>(
  MACRO_CHART_PRIORITY_IDS.map((id, index) => [id, index]),
);

export function sortMacroChartCards<T extends { id: string; title: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ra = PRIORITY_RANK.get(a.id) ?? 999;
    const rb = PRIORITY_RANK.get(b.id) ?? 999;
    if (ra !== rb) return ra - rb;
    return a.title.localeCompare(b.title);
  });
}
