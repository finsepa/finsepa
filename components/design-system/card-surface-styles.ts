import { cn } from "@/lib/utils";
import { semantic } from "@/lib/colors";

/** Grey page shell behind elevated cards (stock, screener, portfolio mobile). */
export const MOBILE_PAGE_BACKGROUND_CLASS = "bg-canvas";

/**
 * Desktop chrome panel fill — top bar, main, company rail, watchlist rail.
 * Keep in sync with `app/globals.css` `.shell-desktop-panel*` backgrounds (`--fs-panel`).
 */
export const SHELL_DESKTOP_PANEL_BG = semantic.panel;
export const SHELL_DESKTOP_PANEL_BG_CLASS = "bg-panel";
export const SHELL_DESKTOP_PANEL_BG_MD_CLASS = "md:bg-panel";

/**
 * Card stroke + elevation — same on mobile and web.
 * 1px stroke-subtle, drop shadow 0 / 1 / 2 / 0 @ 4%, surface fill applied by consumers.
 */
export const CARD_CHROME_CLASS =
  "border border-stroke-subtle shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-04))]";

/**
 * @deprecated Prefer {@link CARD_CHROME_CLASS} — same chrome at every breakpoint.
 * Kept as an alias so existing call sites still resolve.
 */
export const MOBILE_CARD_SURFACE_CLASS = CARD_CHROME_CLASS;

/** @deprecated Prefer {@link CARD_CHROME_CLASS}. */
export const DESKTOP_CARD_CHROME_CLASS = CARD_CHROME_CLASS;

/** Elevated card — 16px radius, surface fill, shared stroke + shadow. */
export const MOBILE_ELEVATED_CARD_CLASS = cn("rounded-2xl bg-surface", CARD_CHROME_CLASS);

/** Inset cards (Key Stats, Key Indicators) — same 16px / stroke / shadow as screener containers. */
export const MOBILE_INSET_CARD_CLASS = cn("rounded-2xl bg-surface", CARD_CHROME_CLASS);

/** Stock overview card section titles (Key Stats cards) — Inter Semi Bold 14/20, secondary grey. */
export const STOCK_OVERVIEW_SECTION_TITLE_CLASS = "text-[14px] font-semibold leading-5 text-fg-muted";

/** Stock overview section headings (Latest news) — Inter Semi Bold 20/28, primary. */
export const STOCK_OVERVIEW_SECTION_HEADING_CLASS = "text-[20px] font-semibold leading-7 text-fg";

/** Panel cards (crypto movers, empty states) — same 16px / stroke / shadow as screener containers. */
export const MOBILE_PANEL_CARD_CLASS = cn("rounded-2xl bg-surface", CARD_CHROME_CLASS);
