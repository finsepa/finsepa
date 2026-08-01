/**
 * Secondary rails (Company / Metric / Charts) — row chrome: `h-9`, hover `bg-surface-muted`.
 * Side inset for the hover fill is 12px (`px-3`); outer card/aside padding is 8px (`p-2`).
 */
export const chartingRailRowClass =
  "group flex h-9 min-w-0 w-full shrink-0 items-center gap-2 overflow-hidden rounded-lg px-3 py-2 text-sm font-medium leading-5 text-fg hover:bg-surface-muted";

export const chartingRailRowActionButtonClass =
  "flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-fg-subtle opacity-0 outline-none transition-opacity hover:bg-surface-hover hover:text-fg-muted group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-fg/10";

/**
 * Title / add-button row — Charting, Comparison, and Macro section headers.
 * `min-h-9` matches the chrome + button so labels without a plus keep the same height.
 * Horizontal inset comes from the parent `p-2` container.
 */
export const companyRailRowClass =
  "flex min-h-9 shrink-0 items-center justify-between gap-2";

/** Section title — same weight as Charting “Company” / “Metric”; 12px left inset. */
export const companyRailTitleClass =
  "flex min-w-0 flex-1 items-center gap-0.5 truncate pl-3 text-sm font-semibold leading-5 text-fg-muted";

/**
 * List around {@link chartingRailRowClass} rows.
 * Horizontal inset lives on the hover rows (`px-3`) and the parent container (`p-2`).
 */
export const companyRailListClass = "flex flex-col gap-0.5";

/** Scroll body for secondary rails — 8px padding on all sides. */
export const companyRailScrollClass =
  "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain p-2";

/**
 * Stack of labeled Macro sections — gaps close to the Company/Metric divider rhythm.
 */
export const companyRailSectionsClass = "flex flex-col gap-2";
