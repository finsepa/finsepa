/**
 * Manual portfolio accent color + icon (web create flow).
 * Missing / default values keep the classic Finsepa brand tile in lists.
 */

export const PORTFOLIO_ACCENT_COLORS = [
  "#60A5FA",
  "#2DD4BF",
  "#C4B5FD",
  "#A78BFA",
  "#2563EB",
  "#E879F9",
  "#F43F5E",
  "#FBBF24",
  "#86EFAC",
  "#16A34A",
  "#FB923C",
  "#64748B",
] as const;

export type PortfolioAccentColor = (typeof PORTFOLIO_ACCENT_COLORS)[number];

/** Fallback swatch when a non-default icon is chosen without a color. */
export const DEFAULT_PORTFOLIO_ACCENT_COLOR: PortfolioAccentColor = "#2563EB";

/**
 * Curated filled icons for create-portfolio — finance / goal themed.
 * `finsepa` is the brand mark (default).
 */
export const PORTFOLIO_ICON_IDS = [
  "finsepa",
  "briefcase",
  "pie",
  "coins",
  "piggy",
  "wallet",
  "shield",
  "umbrella",
  "safe",
  "scales",
  "trendUp",
  "rocket",
  "zap",
  "target",
  "trophy",
  "hourglass",
  "home",
  "family",
  "child",
  "education",
  "heart",
  "globe",
  "building",
  "crypto",
] as const;

export type PortfolioIconId = (typeof PORTFOLIO_ICON_IDS)[number];

export const DEFAULT_PORTFOLIO_ICON_ID: PortfolioIconId = "finsepa";

const COLOR_SET = new Set<string>(PORTFOLIO_ACCENT_COLORS);
const ICON_SET = new Set<string>(PORTFOLIO_ICON_IDS);

export function isPortfolioAccentColor(x: unknown): x is PortfolioAccentColor {
  return typeof x === "string" && COLOR_SET.has(x);
}

export function isPortfolioIconId(x: unknown): x is PortfolioIconId {
  return typeof x === "string" && ICON_SET.has(x);
}

export function normalizePortfolioAccentColor(x: unknown): PortfolioAccentColor | undefined {
  return isPortfolioAccentColor(x) ? x : undefined;
}

export function normalizePortfolioIconId(x: unknown): PortfolioIconId | undefined {
  return isPortfolioIconId(x) ? x : undefined;
}

/** True when the portfolio should render a custom colored icon tile (not the classic Finsepa plate). */
export function portfolioHasCustomAppearance(p: {
  accentColor?: string | null;
  iconId?: string | null;
}): boolean {
  const color = typeof p.accentColor === "string" ? p.accentColor.trim() : "";
  const icon = typeof p.iconId === "string" ? p.iconId.trim() : "";
  if (color && isPortfolioAccentColor(color)) return true;
  if (icon && isPortfolioIconId(icon) && icon !== DEFAULT_PORTFOLIO_ICON_ID) return true;
  return false;
}

/** Picker state from a saved portfolio (missing → classic Finsepa defaults). */
export function appearanceValueFromPortfolio(p: {
  accentColor?: string | null;
  iconId?: string | null;
} | null | undefined): {
  accentColor: PortfolioAccentColor | null;
  iconId: PortfolioIconId;
} {
  return {
    accentColor: normalizePortfolioAccentColor(p?.accentColor) ?? null,
    iconId: normalizePortfolioIconId(p?.iconId) ?? DEFAULT_PORTFOLIO_ICON_ID,
  };
}

/** Fields to persist — omits classic defaults so list logos stay theme-aware. */
export function appearancePersistFields(appearance: {
  accentColor: PortfolioAccentColor | null;
  iconId: PortfolioIconId;
}): { accentColor?: PortfolioAccentColor; iconId?: PortfolioIconId } {
  return {
    ...(appearance.accentColor ? { accentColor: appearance.accentColor } : {}),
    ...(appearance.iconId !== DEFAULT_PORTFOLIO_ICON_ID ? { iconId: appearance.iconId } : {}),
  };
}

function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#([0-9A-Fa-f]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = Number.parseInt(m[1]!, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Relative luminance 0–1 (sRGB). */
function relativeLuminance(hex: string): number | null {
  const rgb = parseHexRgb(hex);
  if (!rgb) return null;
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = lin(rgb.r);
  const g = lin(rgb.g);
  const b = lin(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Icon color on an accent tile. Picks black vs white for stronger contrast
 * (mint / yellow / teal → black; deep blue / red → white).
 */
export function portfolioAccentIconColor(accentHex: string): "#FFFFFF" | "#141414" {
  const L = relativeLuminance(accentHex);
  if (L == null) return "#FFFFFF";
  const white = contrastRatio(L, 1);
  const black = contrastRatio(L, 0.006); // ≈ #141414
  return black >= white ? "#141414" : "#FFFFFF";
}

export function portfolioAccentIconClassName(accentHex: string): string {
  return portfolioAccentIconColor(accentHex) === "#141414" ? "text-[#141414]" : "text-white";
}
