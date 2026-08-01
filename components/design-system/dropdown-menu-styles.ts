import { cn } from "@/lib/utils";
import { fieldChromeClassName } from "@/components/design-system/text-input-styles";

/**
 * Figma — dual drop shadow for dropdown / popover menus / toasts.
 * Use on any floating menu surface for consistent elevation.
 */
export const dropdownMenuElevationClass =
  "shadow-[0px_10px_16px_-3px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-10)),0px_4px_6px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-04))]";

/** Same elevation with `!important` — beats Sonner’s default toast box-shadow. */
export const dropdownMenuElevationImportantClass =
  "!shadow-[0px_10px_16px_-3px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-10)),0px_4px_6px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-04))]";

/**
 * Figma — menu shell: 16px radius, surface fill, 1px stroke, dual elevation.
 * Light + dark: iOS-style glass — 70% opaque fill + blur/saturate over content behind.
 * No padding — use for composite menus (search header + scroll list).
 */
export function dropdownMenuSurfaceClassName(...extra: (string | undefined | null | false)[]) {
  return cn(
    // Dark stroke uses `--fs-dropdown-stroke` (#484848) — matches button gradient peak;
    // do not override with white/12 (too faint on glass menus).
    "rounded-2xl border border-dropdown-stroke bg-dropdown/70 text-fg outline-none backdrop-blur-2xl backdrop-saturate-150",
    dropdownMenuElevationClass,
    ...extra.filter(Boolean),
  );
}

/**
 * Figma — padded panel body: vertical stack, 4px gap between rows, 4px inset on all sides.
 */
export const dropdownMenuPanelBodyClassName = "flex flex-col gap-1 p-1";

/** Search field row above a scrollable list — equal inset on all sides of the input. */
export const dropdownMenuSearchHeaderClassName = "border-b border-dropdown-divider p-2";

/** Internal section rule inside a menu (header / columns) — not the outer outline. */
export const dropdownMenuDividerClassName = "border-dropdown-divider";

/** Same field chrome + focus ring as top bar / {@link SearchInlineInputShell} (`h-9`). */
export const dropdownMenuSearchInputClassName = [
  "h-9 w-full rounded-[10px] px-3 text-sm leading-5 text-fg placeholder:text-fg-subtle",
  fieldChromeClassName,
  "outline-none transition-[color,background-color,border-color,box-shadow]",
  "dark:[&:not(:focus)]:hover:border-field-stroke-hover",
  "focus:shadow-[0_0_0_2px_var(--fs-field-ring)] focus-visible:outline-none",
].join(" ");

/** Overlay scrollbar — transparent track, visible thumb only. */
export const dropdownMenuFloatingScrollbarClassName =
  "[scrollbar-width:thin] [scrollbar-color:color-mix(in_srgb,var(--fs-fg-subtle)_65%,transparent)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:border-0 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-solid [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-clip-padding [&::-webkit-scrollbar-thumb]:bg-fg-subtle/60";

/** Hidden overlay scrollbar — thin gutter always; thumb fades in while scrolling (no layout shift). */
export const dropdownMenuOverlayScrollbarClassName =
  "[scrollbar-width:thin] [scrollbar-color:transparent_transparent] [-ms-overflow-style:none] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar]:bg-transparent [&::-webkit-scrollbar-track]:border-0 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-solid [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-clip-padding [&::-webkit-scrollbar-thumb]:bg-transparent [&::-webkit-scrollbar-thumb]:transition-[background-color] [&::-webkit-scrollbar-thumb]:duration-150";

export const dropdownMenuOverlayScrollbarActiveClassName =
  "[scrollbar-color:color-mix(in_srgb,var(--fs-fg-subtle)_65%,transparent)_transparent] [&::-webkit-scrollbar-thumb]:bg-fg-subtle/60";

/** Horizontal variant for tab rows — thumb appears only while scrolling. */
export const horizontalOverlayScrollbarClassName =
  "[scrollbar-width:thin] [scrollbar-color:transparent_transparent] [-ms-overflow-style:none] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:bg-transparent [&::-webkit-scrollbar-track]:border-0 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-solid [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-clip-padding [&::-webkit-scrollbar-thumb]:bg-transparent [&::-webkit-scrollbar-thumb]:transition-[background-color] [&::-webkit-scrollbar-thumb]:duration-150";

export const horizontalOverlayScrollbarActiveClassName =
  "[scrollbar-color:color-mix(in_srgb,var(--fs-fg-subtle)_65%,transparent)_transparent] [&::-webkit-scrollbar-thumb]:bg-fg-subtle/60";

/** Scrollport extends past the panel edge so the thumb draws over content, not beside it. */
export const panelOverlayScrollGutterClassName = "-mr-1.5";

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

/** Body padding when a dropdown panel is rendered inside a mobile bottom sheet. */
export const dropdownMenuMobileSheetBodyClassName = "flex flex-col gap-1 p-2";

/**
 * Strip floating-menu chrome when nesting `dropdownMenuPanelClassName()` inside a mobile sheet.
 * Apply on the sheet body wrapper around the menu panel.
 */
export const dropdownMenuMobileSheetStripPanelClassName =
  "[&>*]:!rounded-none [&>*]:!border-0 [&>*]:!bg-transparent [&>*]:!p-0 [&>*]:!shadow-none";

const plainItemBase =
  "flex w-full shrink-0 cursor-pointer items-center gap-2 rounded-lg bg-transparent px-4 py-2 text-left text-sm font-normal leading-5 text-fg transition-colors hover:bg-dropdown-item-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/10";

/**
 * Single-line option (~40px): surface row; use `dropdownMenuPlainItemRowClassName` when showing a trailing check.
 */
export function dropdownMenuPlainItemClassName(_opts?: { selected?: boolean }) {
  void _opts;
  return cn(plainItemBase, "h-10 min-h-10");
}

/**
 * Same row affordances with space for a trailing check (active) or spacer.
 * Selected row uses dropdown item hover fill.
 * Grid keeps label + trailing controls aligned across rows in modal sheets.
 */
export function dropdownMenuPlainItemRowClassName(opts?: { selected?: boolean }) {
  return cn(
    plainItemBase,
    "!grid h-10 min-h-10 grid-cols-[minmax(0,1fr)_auto] items-center",
    opts?.selected && "bg-dropdown-item-hover",
  );
}

/**
 * Row with split hit targets (e.g. portfolio label + edit icon).
 */
export const dropdownMenuCompositeRowClassName =
  "flex min-h-12 w-full items-center gap-0 overflow-hidden rounded-lg bg-transparent text-sm text-fg transition-colors hover:bg-dropdown-item-hover";

/**
 * Searchable menus — slightly denser two-line rows (company / metric pickers).
 */
export function dropdownMenuRichItemClassName() {
  return cn(
    "flex w-full cursor-pointer items-start gap-2 rounded-lg bg-transparent px-3 py-2 text-left text-[13px] leading-4 text-fg transition-colors hover:bg-dropdown-item-hover",
  );
}
