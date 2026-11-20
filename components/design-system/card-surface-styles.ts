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
  "border border-transparent shadow-card [--fs-chart-plot-bg:var(--fs-surface)] dark:[--fs-segment-track:#000000]";

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

/** Asset page (stock, ETF, crypto, index, currency) gutter + vertical rhythm. */
export const ASSET_PAGE_SHELL_CLASS = "space-y-5 px-4 py-0 max-md:pt-4 sm:space-y-5 sm:px-9 sm:pt-5 sm:pb-6";

/** Desktop asset breadcrumbs — flush on the panel (no card). */
export const ASSET_BREADCRUMB_CARD_CLASS = "max-md:hidden";

/**
 * Asset header + overview chart — flush on the panel (no elevated card).
 * Flex gap (not `space-y`) so offscreen fixed charts add no trailing space.
 * Chart plot backdrop matches the shell panel (`--fs-panel`).
 */
export const ASSET_HERO_CARD_CLASS =
  "flex flex-col gap-5 [--fs-chart-plot-bg:var(--fs-panel)]";

/**
 * Desktop non-overview tabs: keep header + tabs on screen; park the overview chart offscreen
 * (still mounted so it can drive live header state). `hidden` would zero the chart's layout size.
 */
export const ASSET_HERO_OFFSCREEN_DESKTOP_CLASS =
  "md:pointer-events-none md:fixed md:left-0 md:top-0 md:-z-10 md:w-[min(1200px,calc(100vw-4.5rem))] md:-translate-x-[120vw] md:opacity-0";

/** Panel cards (crypto movers, empty states) — same 16px / stroke / shadow as screener containers. */
export const MOBILE_PANEL_CARD_CLASS = cn("rounded-2xl bg-surface", CARD_CHROME_CLASS);
