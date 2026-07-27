/** White-surface button chrome: 1px border + container drop shadow (0 / 1 / 2 / 0, #000 @ 4%). */
export const whiteSurfaceButtonBorderClass = "border border-[#E8E8EB]";

export const whiteSurfaceButtonShadowClass =
  "shadow-[0px_1px_2px_0px_rgba(0,0,0,0.04)]";

export const whiteSurfaceButtonChromeClass = `${whiteSurfaceButtonBorderClass} bg-white ${whiteSurfaceButtonShadowClass}`;

/**
 * White surface secondary / outline action button (border, light shadow, zinc hover).
 * Matches earnings row actions, pagination, and toolbar “Add …” controls.
 * Horizontal padding: 12px (`px-3`) — same as topbar text squircles.
 */
export const secondaryOutlineButtonClassName = `inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[10px] ${whiteSurfaceButtonChromeClass} px-3 text-[13px] font-semibold leading-none text-[#141414] transition-colors duration-100 hover:bg-[#F4F4F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#141414]/15`;

/**
 * Grey fill toolbar action — Charting / Comparison + Add Company / + Add Metric.
 * Same 12px horizontal padding as white surface; no stroke/shadow (flat grey).
 */
export const secondaryFillButtonClassName =
  "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-[10px] bg-[#F4F4F5] px-3 text-[14px] font-medium leading-5 text-[#141414] transition-colors hover:bg-[#EBEBEB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#141414]/15 disabled:pointer-events-none disabled:opacity-50";

/** Removable white chip shell (ticker / metric tags) — same chrome as topbar white buttons. */
export const whiteSurfaceChipShellClass = `inline-flex h-9 max-w-full min-w-0 items-stretch overflow-hidden rounded-[10px] ${whiteSurfaceButtonChromeClass}`;

/** Label cell inside a white chip — 12px horizontal padding. */
export const whiteSurfaceChipLabelClass =
  "flex min-w-0 items-center px-3 text-[14px] font-medium leading-5 text-[#141414]";

/** Vertical rule before the remove control — matches white surface border. */
export const whiteSurfaceChipDividerClass = "border-r border-[#E8E8EB]";

/** Remove (×) hit target on the right of a white chip. */
export const whiteSurfaceChipRemoveClass =
  "flex w-9 shrink-0 items-center justify-center text-[#141414] transition-colors hover:bg-[#F4F4F5]";
