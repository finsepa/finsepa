import { cn } from "@/lib/utils";

/**
 * Figma — dual drop shadow for dropdown / popover menus.
 * Use on any floating menu surface for consistent elevation.
 */
export const dropdownMenuElevationClass =
  "shadow-[0px_10px_16px_-3px_rgba(10,10,10,0.10),0px_4px_6px_0px_rgba(10,10,10,0.04)]";

/**
 * Figma — menu shell: 12px radius, white fill, 1px `#E4E4E7` border, elevation.
 * No padding — use for composite menus (search header + scroll list).
 */
export function dropdownMenuSurfaceClassName(...extra: (string | undefined | null | false)[]) {
  return cn(
    "rounded-[12px] border border-[#E4E4E7] bg-white text-[#09090B] outline-none",
    dropdownMenuElevationClass,
    ...extra.filter(Boolean),
  );
}

/**
 * Figma — padded panel body: vertical stack, 4px gap, 8px vertical / 4px horizontal padding.
 */
export const dropdownMenuPanelBodyClassName = "flex flex-col gap-1 py-2 pl-1 pr-1";

/**
 * Simple list dropdown (surface + padded body).
 */
export function dropdownMenuPanelClassName(...extra: (string | undefined | null | false)[]) {
  return cn(dropdownMenuSurfaceClassName(), dropdownMenuPanelBodyClassName, ...extra.filter(Boolean));
}

const plainItemBase =
  "flex w-full shrink-0 cursor-pointer items-center gap-2 rounded-lg bg-white px-4 py-2 text-left text-sm font-normal leading-5 text-[#09090B] transition-colors hover:bg-[#F4F4F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/10";

/**
 * Single-line option (~40px): white row; use `dropdownMenuPlainItemRowClassName` when showing a trailing check.
 */
export function dropdownMenuPlainItemClassName(_opts?: { selected?: boolean }) {
  void _opts;
  return cn(plainItemBase, "h-10 min-h-10");
}

/**
 * Same row affordances with space for a trailing check (active) or spacer.
 * Selected row uses `#F4F4F5` (same as hover) per design spec.
 */
export function dropdownMenuPlainItemRowClassName(opts?: { selected?: boolean }) {
  return cn(plainItemBase, "h-10 min-h-10 justify-between", opts?.selected && "bg-[#F4F4F5]");
}

/**
 * Row with split hit targets (e.g. portfolio label + edit icon).
 */
export const dropdownMenuCompositeRowClassName =
  "flex min-h-10 w-full items-center gap-0 overflow-hidden rounded-lg bg-white text-sm text-[#09090B] transition-colors hover:bg-[#F4F4F5]";

/**
 * Searchable menus — slightly denser two-line rows (company / metric pickers).
 */
export function dropdownMenuRichItemClassName() {
  return cn(
    "flex w-full cursor-pointer items-start gap-2 rounded-lg bg-white px-3 py-2 text-left text-[13px] leading-4 text-[#09090B] transition-colors hover:bg-[#F4F4F5]",
  );
}
