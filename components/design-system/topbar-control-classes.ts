import { whiteSurfaceButtonChromeClass } from "@/components/design-system/secondary-button-styles";

/** Icon-only squircle — matches topbar watchlist / help / bell triggers. */
export const topbarSquircleIconClass = `flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${whiteSurfaceButtonChromeClass} text-[#0F0F0F] transition-all duration-100 hover:bg-[#F4F4F5]`;

/** Label + icon, same surface as portfolio strip / squircle row (variable width). */
export const topbarSquircleTextButtonClass = `inline-flex h-9 shrink-0 items-center gap-2 rounded-[10px] ${whiteSurfaceButtonChromeClass} px-3 text-sm font-medium leading-5 text-[#0F0F0F] transition-all duration-100 hover:bg-[#F4F4F5]`;

/** Portfolio-style outer shell (split control). */
export const topbarSquircleSplitShellClass = `flex h-9 max-w-full min-w-0 items-stretch overflow-visible rounded-[10px] ${whiteSurfaceButtonChromeClass}`;

/** Open dropdown / menu trigger — same grey fill as hover. */
export const topbarSquircleActiveClass = "bg-[#F4F4F5]";

/** Icon cell inside a grouped mobile top-bar control (no per-button border). */
export const topbarSquircleClusterItemClass =
  "flex h-9 w-9 shrink-0 items-center justify-center text-[#0F0F0F] transition-colors hover:bg-[#F4F4F5] active:bg-[#E4E4E7]";
