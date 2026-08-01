/** White-surface button chrome: 1px border + soft drop shadow (0 / 1 / 2 / 0 @ 4%). */
export const whiteSurfaceButtonBorderClass = "border border-stroke-muted";

export const whiteSurfaceButtonShadowClass =
  "shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-04))]";

/** Button fill — `--fs-button` (cards keep `--fs-surface` / `bg-surface`). Dark fill via `.fs-button-gradient-stroke`. */
export const whiteSurfaceButtonFillClass = "bg-button";

export const whiteSurfaceButtonChromeClass = `${whiteSurfaceButtonBorderClass} ${whiteSurfaceButtonFillClass} ${whiteSurfaceButtonShadowClass} fs-button-gradient-stroke`;

/**
 * White surface secondary / outline action button (border, light shadow, muted hover).
 * Matches earnings row actions, pagination, and toolbar “Add …” controls.
 * Horizontal padding: 12px (`px-3`) — same as topbar text squircles.
 */
export const secondaryOutlineButtonClassName = `inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[10px] ${whiteSurfaceButtonChromeClass} px-3 text-[13px] font-semibold leading-none text-fg transition-colors duration-100 hover:bg-surface-muted dark:hover:bg-dropdown-item-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15`;

/**
 * Inverted fill CTA — black on light / white on dark.
 * Same size, radius, border, and shadow geometry as outline chrome.
 */
export const invertedFillButtonClassName = `inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[10px] border border-stroke-muted bg-fg px-3 text-[13px] font-semibold leading-none text-surface ${whiteSurfaceButtonShadowClass} transition-colors duration-100 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15 disabled:cursor-not-allowed disabled:opacity-60`;

/**
 * Accent primary CTA — blue fill, darker accent stroke, soft blue shadow.
 */
export const accentFillButtonClassName = `inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[10px] border border-[color-mix(in_srgb,var(--fs-accent)_55%,#000)] bg-accent px-3 text-[13px] font-semibold leading-none text-white shadow-[0px_1px_2px_0px_rgba(54,74,255,0.25)] transition-colors duration-100 hover:border-accent-hover hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-60`;

/**
 * Grey fill toolbar action — Charting / Comparison + Add Company / + Add Metric.
 * Same 12px horizontal padding as white surface; no stroke/shadow (flat grey).
 */
export const secondaryFillButtonClassName =
  "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-[10px] bg-surface-muted px-3 text-[14px] font-medium leading-5 text-fg transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15 disabled:pointer-events-none disabled:opacity-50";

/** Removable white chip shell (ticker / metric tags) — same chrome as topbar white buttons. */
export const whiteSurfaceChipShellClass = `inline-flex h-9 max-w-full min-w-0 items-stretch overflow-hidden rounded-[10px] ${whiteSurfaceButtonChromeClass}`;

/** Label cell inside a white chip — 12px horizontal padding. */
export const whiteSurfaceChipLabelClass =
  "flex min-w-0 items-center px-3 text-[14px] font-medium leading-5 text-fg";

/** Vertical rule before the remove control — matches white surface border. */
export const whiteSurfaceChipDividerClass = "border-r border-stroke-muted";

/** Remove (×) hit target on the right of a white chip. */
export const whiteSurfaceChipRemoveClass =
  "flex w-9 shrink-0 items-center justify-center text-fg transition-colors hover:bg-surface-muted dark:hover:bg-dropdown-item-hover";
