/** Shown first on `/macro` (valuation block). */
export const MACRO_CHART_PRIORITY_IDS = [
  "shiller_pe",
  "sp500_earnings",
  "sp500_trailing_pe",
] as const;

/** Default selection on Macro charts (Charting-style single chart). */
export const DEFAULT_MACRO_CHART_ID = "shiller_pe";

export type MacroChartSectionId =
  | "sp500"
  | "rates"
  | "inflation"
  | "economy"
  | "crypto";

export type MacroChartSectionDef = {
  id: MacroChartSectionId;
  title: string;
  chartIds: readonly string[];
};

/**
 * Macro Charts rail — sectioned like the main sidebar (Markets / Data / …).
 * Order within each section is display order.
 */
export const MACRO_CHART_SECTIONS: readonly MacroChartSectionDef[] = [
  {
    id: "sp500",
    title: "S&P 500",
    chartIds: ["shiller_pe", "sp500_earnings", "sp500_trailing_pe"],
  },
  {
    id: "rates",
    title: "Rates",
    chartIds: ["ust_par_yield_10y", "ust_par_yield_20y", "fed_interest_rate"],
  },
  {
    id: "inflation",
    title: "Inflation",
    chartIds: ["consumer_price_index", "inflation_consumer_prices_annual", "inflation_gdp_deflator_annual"],
  },
  {
    id: "economy",
    title: "Economy",
    chartIds: [
      "gdp_current_usd",
      "gdp_growth_annual",
      "gdp_per_capita_usd",
      "debt_percent_gdp",
      "unemployment_total_percent",
    ],
  },
  {
    id: "crypto",
    title: "Crypto",
    chartIds: ["crypto_fear_greed"],
  },
] as const;

const SECTION_ORDER = new Map<string, number>();
for (let s = 0; s < MACRO_CHART_SECTIONS.length; s++) {
  const section = MACRO_CHART_SECTIONS[s]!;
  for (let i = 0; i < section.chartIds.length; i++) {
    SECTION_ORDER.set(section.chartIds[i]!, s * 100 + i);
  }
}

export function sortMacroChartCards<T extends { id: string; title: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ra = SECTION_ORDER.get(a.id) ?? 9999;
    const rb = SECTION_ORDER.get(b.id) ?? 9999;
    if (ra !== rb) return ra - rb;
    return a.title.localeCompare(b.title);
  });
}

export function groupMacroChartCards<T extends { id: string; title: string }>(
  items: readonly T[],
): { id: MacroChartSectionId | "other"; title: string; items: T[] }[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const groups: { id: MacroChartSectionId | "other"; title: string; items: T[] }[] = [];

  for (const section of MACRO_CHART_SECTIONS) {
    const sectionItems = section.chartIds
      .map((id) => byId.get(id))
      .filter((item): item is T => item != null);
    if (sectionItems.length === 0) continue;
    groups.push({ id: section.id, title: section.title, items: sectionItems });
  }

  const known = new Set(MACRO_CHART_SECTIONS.flatMap((s) => s.chartIds));
  const other = items.filter((item) => !known.has(item.id));
  if (other.length > 0) {
    groups.push({
      id: "other",
      title: "Other",
      items: [...other].sort((a, b) => a.title.localeCompare(b.title)),
    });
  }

  return groups;
}

export function resolveMacroChartId(
  items: readonly { id: string }[],
  preferredId: string | null | undefined,
): string | null {
  if (items.length === 0) return null;
  const preferred = preferredId?.trim();
  if (preferred && items.some((item) => item.id === preferred)) return preferred;
  if (items.some((item) => item.id === DEFAULT_MACRO_CHART_ID)) return DEFAULT_MACRO_CHART_ID;
  return items[0]?.id ?? null;
}
