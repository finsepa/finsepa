/**
 * GICS-style sector rows for the Screener “Sectors” tab (fixed order, matches product table).
 * Provider/API strings are normalized into these names via {@link mapProviderSectorToCanonical}.
 */
export const SCREENER_SECTOR_TABLE_ORDER = [
  "Technology",
  "Financials",
  "Healthcare",
  "Consumer Discretionary",
  "Communication Services",
  "Industrials",
  "Consumer Staples",
  "Energy",
  "Materials",
  "Real Estate",
  "Utilities",
] as const;

export type ScreenerCanonicalSector = (typeof SCREENER_SECTOR_TABLE_ORDER)[number];

function normKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Explicit aliases → canonical (keys are {@link normKey} output). */
const ALIAS_TO_CANONICAL: Record<string, ScreenerCanonicalSector> = {
  // Technology
  technology: "Technology",
  "information technology": "Technology",
  // Financials
  financials: "Financials",
  "financial services": "Financials",
  // Healthcare
  healthcare: "Healthcare",
  "health care": "Healthcare",
  // Consumer
  "consumer discretionary": "Consumer Discretionary",
  "consumer cyclical": "Consumer Discretionary",
  "communication services": "Communication Services",
  "telecommunication services": "Communication Services",
  "telecommunications": "Communication Services",
  // Industrials
  industrials: "Industrials",
  industrial: "Industrials",
  // Staples
  "consumer staples": "Consumer Staples",
  "consumer defensive": "Consumer Staples",
  // Energy
  energy: "Energy",
  // Materials
  materials: "Materials",
  "basic materials": "Materials",
  // Real estate
  "real estate": "Real Estate",
  // Utilities
  utilities: "Utilities",
};

/**
 * Map an EODHD (or similar) sector string onto {@link SCREENER_SECTOR_TABLE_ORDER}.
 * Returns null when the label cannot be placed (caller may skip that row’s market cap).
 */
export function mapProviderSectorToCanonical(raw: string | null | undefined): ScreenerCanonicalSector | null {
  if (raw == null || !String(raw).trim()) return null;
  const key = normKey(String(raw));

  const direct = ALIAS_TO_CANONICAL[key];
  if (direct) return direct;

  for (const c of SCREENER_SECTOR_TABLE_ORDER) {
    if (normKey(c) === key) return c;
  }

  // Light keyword fallbacks for odd provider labels
  if (key.includes("information tech") || key === "it sector") return "Technology";
  if (key.includes("financial") || key.includes("insurance") || key.includes("bank")) return "Financials";
  if (key.includes("health")) return "Healthcare";
  if (key.includes("consumer disc") || key.includes("cyclical")) return "Consumer Discretionary";
  if (key.includes("communication") || key.includes("telecom") || key.includes("media")) return "Communication Services";
  if (key.includes("industrial")) return "Industrials";
  if (key.includes("staples") || key.includes("defensive")) return "Consumer Staples";
  if (key.includes("energy") || key.includes("oil") || key.includes("gas")) return "Energy";
  if (key.includes("material") || key.includes("chemical") || key.includes("mining")) return "Materials";
  if (key.includes("real estate") || key.includes("reit")) return "Real Estate";
  if (key.includes("utilit")) return "Utilities";

  return null;
}
