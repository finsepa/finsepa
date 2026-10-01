import type { IndexCardData } from "@/lib/screener/indices-today";

/** Display order for screener Stocks index strip (matches {@link IndexCards}). */
export const SCREENER_INDEX_CARD_LABELS = [
  "S&P 500",
  "Nasdaq 100",
  "Dow Jones",
  "Russell 2000",
  "VIX",
] as const;

export type ScreenerIndexCardLabel = (typeof SCREENER_INDEX_CARD_LABELS)[number];

function finiteOrNull(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}

/**
 * One card per label in display order. Missing values stay null (tiles render "—"): hardcoded
 * offline numbers go stale and contradict the asset page.
 */
export function withIndexCardLocalFallbacks(cards: IndexCardData[]): IndexCardData[] {
  const byName = new Map(cards.map((c) => [c.name, c] as const));
  return SCREENER_INDEX_CARD_LABELS.map((name) => {
    const live = byName.get(name);
    return {
      name,
      price: finiteOrNull(live?.price),
      changePercent1D: finiteOrNull(live?.changePercent1D),
      sparklineToday: live?.sparklineToday ?? null,
    };
  });
}

/** True when at least one card carries a real price — empty batches must not be persisted. */
export function indexCardsHaveAnyPrice(cards: readonly IndexCardData[] | null | undefined): boolean {
  return Array.isArray(cards) && cards.some((c) => finiteOrNull(c?.price) != null);
}
