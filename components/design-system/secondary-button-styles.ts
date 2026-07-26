/** White-surface button chrome: 1px border + container drop shadow (0 / 1 / 2 / 0, #000 @ 4%). */
export const whiteSurfaceButtonBorderClass = "border border-[#E8E8EB]";

export const whiteSurfaceButtonShadowClass =
  "shadow-[0px_1px_2px_0px_rgba(0,0,0,0.04)]";

export const whiteSurfaceButtonChromeClass = `${whiteSurfaceButtonBorderClass} bg-white ${whiteSurfaceButtonShadowClass}`;

/**
 * White surface secondary / outline action button (border, light shadow, zinc hover).
 * Matches earnings row actions, pagination, and toolbar “Add …” controls.
 */
export const secondaryOutlineButtonClassName = `inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[10px] ${whiteSurfaceButtonChromeClass} px-3 text-[13px] font-semibold leading-none text-[#141414] transition-colors duration-100 hover:bg-[#F4F4F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#141414]/15`;

/** Grey fill toolbar action — Charting + Add Company / + Add Metric. */
export const secondaryFillButtonClassName =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-[10px] bg-[#F4F4F5] px-4 py-2 text-[14px] font-medium leading-5 text-[#141414] transition-colors hover:bg-[#EBEBEB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#141414]/15 disabled:pointer-events-none disabled:opacity-50";
