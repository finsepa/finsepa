/**
 * Text-entry / dropdown trigger chrome.
 * Dark fill/stroke hex aligned with cards (`--fs-surface` / `--fs-stroke-subtle`) but
 * kept on separate `--fs-field*` tokens. Solid border (not button gradient stroke).
 * Focus / open: soft `--fs-field-ring` shadow only (same as topbar search — no Tailwind ring offset).
 */
import { whiteSurfaceButtonShadowClass } from "@/components/design-system/secondary-button-styles";

/** Soft focus / open ring — matches search; keep as a full literal for Tailwind scan. */
export const textInputActiveRingClassName =
  "shadow-[0_0_0_2px_var(--fs-field-ring)]";

/** Card-aligned face + edge via field tokens. */
export const fieldChromeClassName = [
  "border border-field-stroke",
  "bg-field",
  whiteSurfaceButtonShadowClass,
].join(" ");

/**
 * @deprecated Prefer {@link fieldChromeClassName}. Kept for any leftover outline-based shells.
 */
export const fieldStrokeOutlineClassName =
  "outline outline-1 outline-offset-0 outline-field-stroke";

/** Locked 36px control height — inputs + dropdown triggers in forms/modals. */
export const formFieldControlHeightClassName = "box-border h-9 min-h-9 max-h-9 shrink-0";

/** Dark-only: lighten stroke on idle hover (outline-based shells). */
export const fieldIdleHoverStrokeClassName =
  "dark:[&:not(:focus-within)]:hover:outline-field-stroke-hover";

/**
 * Dark idle hover — lighten 1px field stroke (Date, Portfolio, Operation, …).
 * Applied whether or not the control is focused so triggers stay consistent.
 */
export const fieldIdleHoverBorderClassName = "dark:hover:border-field-stroke-hover";

export const textInputShellClassName = [
  fieldChromeClassName,
  "outline-none",
  "transition-[color,background-color,border-color,box-shadow]",
  fieldIdleHoverBorderClassName,
  "focus-within:shadow-[0_0_0_2px_var(--fs-field-ring)]",
].join(" ");

/** Base native `<input>` fill when the element itself is the chrome (no outer shell). */
export const textInputFieldClassName = [
  formFieldControlHeightClassName,
  fieldChromeClassName,
  "py-0 text-fg placeholder:text-fg-muted outline-none",
  "transition-[color,background-color,border-color,box-shadow]",
  fieldIdleHoverBorderClassName,
  // Same active stroke as search — no `focus:ring-*` (causes offset gap / blue UA look).
  "focus:shadow-[0_0_0_2px_var(--fs-field-ring)]",
  "focus-visible:outline-none",
].join(" ");

/**
 * Dropdown / listbox triggers (Date, Portfolio, Operation, FormListboxSelect, …).
 * Same field chrome as text inputs — including idle hover stroke.
 */
export const dropdownTriggerFieldClassName = [
  formFieldControlHeightClassName,
  fieldChromeClassName,
  "outline-none",
  "transition-[color,background-color,border-color,box-shadow]",
  fieldIdleHoverBorderClassName,
  "focus-visible:shadow-[0_0_0_2px_var(--fs-field-ring)]",
  "focus-visible:outline-none",
  "data-[state=open]:shadow-[0_0_0_2px_var(--fs-field-ring)]",
  "aria-[expanded=true]:shadow-[0_0_0_2px_var(--fs-field-ring)]",
].join(" ");
