import { cn } from "@/lib/utils";

/**
 * Figma — dual drop shadow for dropdown / popover menus.
 * Use on any floating menu surface for consistent elevation.
 */
export const dropdownMenuElevationClass =
  "shadow-[0px_10px_16px_-3px_rgba(10,10,10,0.10),0px_4px_6px_0px_rgba(10,10,10,0.04)]";

/**
 * Figma — menu shell: 16px radius, white fill, 1px `#E4E4E7` border, dual elevation.
 * No padding — use for composite menus (search header + scroll list).
 */
export function dropdownMenuSurfaceClassName(...extra: (string | undefined | null | false)[]) {
  return cn(
    "rounded-2xl border border-[#E4E4E7] bg-white text-[#09090B] outline-none",
    dropdownMenuElevationClass,
    ...extra.filter(Boolean),
  );
}

/**
 * Figma — padded panel body: vertical stack, 4px gap between rows, 4px inset on all sides.
 */
export const dropdownMenuPanelBodyClassName = "flex flex-col gap-1 p-1";

/** Search field row above a scrollable list — equal inset on all sides of the input. */
export const dropdownMenuSearchHeaderClassName = "border-b border-[#F4F4F5] p-2";

/** Matches top bar / {@link SearchInlineInputShell} search shell (`#F4F4F5`, `h-9`, `rounded-lg`). */
export const dropdownMenuSearchInputClassName =
  "h-9 w-full rounded-lg border-0 bg-[#F4F4F5] px-3 text-sm leading-5 text-[#09090B] placeholder:text-[#A1A1AA] outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/10";

/** Overlay scrollbar — transparent track, visible thumb only. */
export const dropdownMenuFloatingScrollbarClassName =
  "[scrollbar-width:thin] [scrollbar-color:rgba(161,161,170,0.65)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:border-0 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-solid [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-clip-padding [&::-webkit-scrollbar-thumb]:bg-[#A1A1AA]/60";

/** Hidden overlay scrollbar — thumb appears only while actively scrolling. */
export const dropdownMenuOverlayScrollbarClassName =
  "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar]:bg-transparent [&::-webkit-scrollbar-track]:border-0 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-solid [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-clip-padding [&::-webkit-scrollbar-thumb]:bg-transparent";

export const dropdownMenuOverlayScrollbarActiveClassName =
  "[scrollbar-width:thin] [scrollbar-color:rgba(161,161,170,0.65)_transparent] [&::-webkit-scrollbar-thumb]:bg-[#A1A1AA]/60";

/**
 * Scrollable dropdown lists — thin scrollbar only.
 * Use {@link DropdownScrollArea} for edge fade when content overflows.
 */
export const dropdownMenuFloatingScrollClassName = dropdownMenuFloatingScrollbarClassName;

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
