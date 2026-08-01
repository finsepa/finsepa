import { whiteSurfaceButtonChromeClass } from "@/components/design-system/secondary-button-styles";

/** Icon-only squircle — matches topbar watchlist / help / bell triggers. */
export const topbarSquircleIconClass = `flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${whiteSurfaceButtonChromeClass} text-icon transition-all duration-100 hover:bg-surface-muted dark:hover:bg-dropdown-item-hover`;

/** Label + icon, same surface as portfolio strip / squircle row (variable width). */
export const topbarSquircleTextButtonClass = `inline-flex h-9 shrink-0 items-center gap-2 rounded-[10px] ${whiteSurfaceButtonChromeClass} px-3 text-sm font-medium leading-5 text-fg transition-all duration-100 hover:bg-surface-muted dark:hover:bg-dropdown-item-hover`;

/** Portfolio-style outer shell (split control). */
export const topbarSquircleSplitShellClass = `flex h-9 max-w-full min-w-0 items-stretch overflow-visible rounded-[10px] ${whiteSurfaceButtonChromeClass}`;

/** Open dropdown / menu trigger — light: muted wash; dark: lifted button face. */
export const topbarSquircleActiveClass =
  "bg-surface-muted dark:[--fs-button-face:var(--fs-dropdown-item-hover)]";

/** Icon cell inside a grouped mobile top-bar control (no per-button border). */
export const topbarSquircleClusterItemClass =
  "flex h-9 w-9 shrink-0 items-center justify-center text-icon transition-colors hover:bg-surface-muted active:bg-stroke dark:hover:bg-dropdown-item-hover";
