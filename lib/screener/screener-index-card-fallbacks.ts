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

/** Offline display values when EODHD / cache layers are empty (aligned with `INDEX_TOP10` fallbacks). */
const FALLBACK_BY_NAME: Record<ScreenerIndexCardLabel, { price: number; changePercent1D: number }> = {
  "S&P 500": { price: 5648.4, changePercent1D: 0.44 },
  "Nasdaq 100": { price: 17713.53, changePercent1D: 1.13 },
  "Dow Jones": { price: 41563.08, changePercent1D: 0.55 },
  "Russell 2000": { price: 2217.63, changePercent1D: 0.67 },
  VIX: { price: 15.0, changePercent1D: -4.15 },
};

export function withIndexCardLocalFallbacks(cards: IndexCardData[]): IndexCardData[] {
  const byName = new Map(cards.map((c) => [c.name, c] as const));
  return SCREENER_INDEX_CARD_LABELS.map((name) => {
    const live = byName.get(name);
    const fb = FALLBACK_BY_NAME[name];
    const price =
      live?.price != null && Number.isFinite(live.price) ? live.price : fb.price;
    const changePercent1D =
      live?.changePercent1D != null && Number.isFinite(live.changePercent1D)
        ? live.changePercent1D
        : fb.changePercent1D;
    return {
      name,
      price,
      changePercent1D,
      sparklineToday: live?.sparklineToday ?? null,
    };
  });
}
