/**
 * Secondary left rails (Company / Metric / Charts) — matches Comparison/Charting
 * row chrome: `h-9`, `px-4`, hover `#F4F4F5`. No color transition (keeps hover/active snappy).
 */
export const chartingRailRowClass =
  "group flex h-9 min-w-0 w-full shrink-0 items-center gap-2 overflow-hidden rounded-lg px-4 py-2 text-sm font-medium leading-5 text-[#0F0F0F] hover:bg-[#F4F4F5]";

export const chartingRailRowActionButtonClass =
  "flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[#A1A1AA] opacity-0 outline-none transition-opacity hover:bg-[#EBEBEB] hover:text-[#71717A] group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[#0F0F0F]/10";

/**
 * Title / add-button row — Charting, Comparison, and Macro section headers.
 * `min-h-9` matches the chrome + button so labels without a plus keep the same height.
 */
export const companyRailRowClass =
  "flex min-h-9 shrink-0 items-center justify-between gap-2 px-3";

/** Section title — same inset/weight as Charting “Company” / “Metric”. */
export const companyRailTitleClass =
  "flex min-w-0 flex-1 items-center gap-0.5 truncate pl-4 text-sm font-semibold leading-5 text-[#52525B]";

/**
 * List around {@link chartingRailRowClass} rows.
 * Horizontal inset lives on the list (`px-3`) so it lines up with title rows.
 */
export const companyRailListClass = "flex flex-col gap-0.5 px-3";

/** Scroll body for secondary left rails (Company / Metric / Charts). */
export const companyRailScrollClass =
  "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain pb-2";

/**
 * Stack of labeled Macro sections — same top inset as Charting’s Company header,
 * section gaps close to the Company/Metric divider rhythm.
 */
export const companyRailSectionsClass = "flex flex-col gap-2 pt-3";
