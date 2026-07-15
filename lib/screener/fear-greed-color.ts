/** Shared Fear & Greed colors — match the crypto screener pie/gauge segments. */
export const FEAR_GREED_COLORS = {
  extremeFear: "#E03D3E",
  fear: "#E8881A",
  neutral: "#E8C42E",
  greed: "#8FCF2E",
  extremeGreed: "#2DB873",
} as const;

/** Soft band fills for the history chart (CMC-style zones). */
export const FEAR_GREED_ZONE_FILLS = {
  extremeFear: "rgba(224, 61, 62, 0.1)",
  extremeGreed: "rgba(45, 184, 115, 0.1)",
} as const;

/**
 * Score bands (matches Alternative.me classifications; live API treats 25 as Extreme Fear).
 * Extreme Fear 0–25 · Fear 26–49 · Neutral 50–54 · Greed 55–74 · Extreme Greed 75–100
 */
export const FEAR_GREED_BANDS = [
  { from: 0, to: 25, color: FEAR_GREED_COLORS.extremeFear },
  { from: 25, to: 49, color: FEAR_GREED_COLORS.fear },
  { from: 49, to: 55, color: FEAR_GREED_COLORS.neutral },
  { from: 55, to: 75, color: FEAR_GREED_COLORS.greed },
  { from: 75, to: 100, color: FEAR_GREED_COLORS.extremeGreed },
] as const;

export function fearGreedColorForValue(v: number): string {
  const n = Math.max(0, Math.min(100, v));
  // 0–25 Extreme Fear (API includes 25); 26–49 Fear; …
  if (n <= 25) return FEAR_GREED_COLORS.extremeFear;
  if (n <= 49) return FEAR_GREED_COLORS.fear;
  if (n <= 54) return FEAR_GREED_COLORS.neutral;
  if (n <= 74) return FEAR_GREED_COLORS.greed;
  return FEAR_GREED_COLORS.extremeGreed;
}

/** Prefer API classification so e.g. Extreme Fear stays on the red segment even at boundary values. */
export function fearGreedColorForClassification(
  classification: string,
  value?: number | null,
): string {
  const c = classification.trim().toLowerCase();
  if (c.includes("extreme fear")) return FEAR_GREED_COLORS.extremeFear;
  if (c.includes("extreme greed")) return FEAR_GREED_COLORS.extremeGreed;
  if (c.includes("fear") && !c.includes("greed")) return FEAR_GREED_COLORS.fear;
  if (c.includes("greed")) return FEAR_GREED_COLORS.greed;
  if (c.includes("neutral")) return FEAR_GREED_COLORS.neutral;
  if (value != null && Number.isFinite(value)) return fearGreedColorForValue(value);
  return "#09090B";
}
