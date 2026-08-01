import { cn } from "@/lib/utils";

/**
 * Dark glass fill + edge — same language as dropdown menus
 * (`bg-dropdown/70` + blur + `white/12` stroke).
 */
export const tooltipGlassDarkClassName =
  "dark:border-white/12 dark:bg-dropdown/70 dark:backdrop-blur-2xl dark:backdrop-saturate-150";

export const tooltipSurfaceShadowClassName =
  "shadow-[0px_1px_4px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-08)),0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-06))]";

/**
 * Chart / content tooltip shell — light: surface + stroke; dark: dropdown glass.
 */
export const tooltipSurfaceClassName = cn(
  "rounded-lg border border-stroke bg-surface text-fg",
  tooltipSurfaceShadowClassName,
  tooltipGlassDarkClassName,
);

/**
 * Compact dwell tip (topbar / sidebar rail).
 * Light: inverted fg pill; dark: dropdown glass.
 */
export const tooltipDwellSurfaceClassName = cn(
  "rounded-md border border-transparent bg-fg px-2.5 py-1.5 text-xs font-medium leading-4 text-white",
  "dark:text-fg",
  tooltipGlassDarkClassName,
  "dark:shadow-[0px_1px_4px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-08)),0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-06))]",
);
