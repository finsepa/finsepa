import { semantic } from "@/lib/colors";

/** Light-theme fallbacks when CSS vars are unavailable (SSR / early paint). */
const LIGHT_FALLBACKS: Record<string, string> = {
  "--fs-up": semantic.up,
  "--fs-down": semantic.down,
  "--fs-accent": semantic.accent,
  "--fs-accent-hover": semantic.accentHover,
  "--fs-accent-soft": semantic.accentSoft,
  "--fs-fg": semantic.fg,
  "--fs-fg-muted": semantic.fgMuted,
  "--fs-fg-subtle": semantic.fgSubtle,
  "--fs-panel": semantic.panel,
  "--fs-nav": semantic.nav,
  "--fs-page": semantic.page,
  "--fs-surface": semantic.surface,
  "--fs-button": semantic.button,
  "--fs-modal": semantic.modal,
  "--fs-surface-muted": semantic.surfaceMuted,
  "--fs-skeleton": "#f4f4f5",
  "--fs-field": semantic.field,
  "--fs-field-stroke": semantic.fieldStroke,
  "--fs-field-hover": semantic.fieldHover,
  "--fs-field-stroke-hover": semantic.fieldStrokeHover,
  "--fs-field-stroke-active": semantic.fieldStrokeActive,
  "--fs-field-ring": semantic.fieldRing,
  "--fs-stroke": semantic.stroke,
  "--fs-icon": semantic.icon,
};

/**
 * Dark-theme fallbacks — keep in sync with `.dark` in `app/globals.css`.
 * Used when `.dark` is on but computed vars are missing (or still light during theme boot).
 */
const DARK_FALLBACKS: Record<string, string> = {
  "--fs-up": "#35d96c",
  "--fs-down": "#ff3349",
  "--fs-accent": "#364aff",
  "--fs-accent-hover": "#2b3fe6",
  "--fs-accent-soft": "#0f1e29",
  "--fs-fg": "#ffffff",
  "--fs-fg-muted": "#999999",
  "--fs-fg-subtle": "#5d5d5f",
  "--fs-panel": "#000000",
  "--fs-page": "#000000",
  "--fs-nav": "#000000",
  "--fs-surface": "#151515",
  "--fs-button": "#212123",
  "--fs-modal": "#0a0a0b",
  "--fs-modal-title": "#212123",
  "--fs-modal-title-stroke": "rgba(255, 255, 255, 0.12)",
  "--fs-surface-muted": "#242424",
  "--fs-skeleton": "#1a1a1b",
  "--fs-field": "#151515",
  "--fs-field-stroke": "#222222",
  "--fs-field-hover": "#2c2c2e",
  "--fs-field-stroke-hover": "#2a2a2a",
  "--fs-field-stroke-active": "#222222",
  "--fs-field-ring": "rgba(255, 255, 255, 0.12)",
  "--fs-stroke": "#212121",
  "--fs-icon": "#ffffff",
};

export function isDarkDocument(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

/**
 * Resolve a `--fs-*` custom property to a concrete paint color.
 * Canvas / lightweight-charts cannot parse `var(--fs-*)` (addColorStop throws).
 */
export function resolveFsColor(cssVar: string): string {
  const key = cssVar.trim().replace(/^var\(\s*/i, "").replace(/\s*\)$/, "");
  const dark = isDarkDocument();
  const fallback = (dark ? DARK_FALLBACKS[key] : undefined) ?? LIGHT_FALLBACKS[key] ?? semantic.fg;
  if (typeof document === "undefined") return fallback;

  const value = getComputedStyle(document.documentElement).getPropertyValue(key).trim();
  if (!value) return fallback;

  // Theme boot / HMR edge case: `.dark` is set but cascade still reports light panel/page.
  // Chart axis pills bake that into a white tag on a black panel.
  if (dark) {
    const lightTwin = LIGHT_FALLBACKS[key];
    if (lightTwin && value.toLowerCase() === lightTwin.toLowerCase()) {
      return DARK_FALLBACKS[key] ?? value;
    }
  }

  return value;
}

/** Snapshot of chart-facing semantic colors for the active theme. */
export function chartFsColors() {
  return {
    up: resolveFsColor("--fs-up"),
    down: resolveFsColor("--fs-down"),
    accent: resolveFsColor("--fs-accent"),
    accentSoft: resolveFsColor("--fs-accent-soft"),
    fg: resolveFsColor("--fs-fg"),
    fgMuted: resolveFsColor("--fs-fg-muted"),
    fgSubtle: resolveFsColor("--fs-fg-subtle"),
    panel: resolveFsColor("--fs-panel"),
    surface: resolveFsColor("--fs-surface"),
    stroke: resolveFsColor("--fs-stroke"),
  } as const;
}
