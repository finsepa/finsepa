import { cn } from "@/lib/utils";

/** Grey page shell behind elevated cards (stock, screener, portfolio mobile). */
export const MOBILE_PAGE_BACKGROUND_CLASS = "bg-[#FAFAFA]";

/** Figma mobile card chrome: borderless + stacked drop shadows (0/1/2 @ 7%, 0/1/4 @ 12%, #0A0A0A). */
export const MOBILE_CARD_SURFACE_CLASS =
  "max-md:border-0 max-md:shadow-[0px_1px_2px_0px_rgba(10,10,10,0.07),0px_1px_4px_0px_rgba(10,10,10,0.12)]";

/** Desktop bordered card — light drop shadow (0 / 1 / 2 / 0, #000 @ 4%). */
export const DESKTOP_CARD_CHROME_CLASS =
  "md:border md:border-[#EBEBEC] md:shadow-[0px_1px_2px_0px_rgba(0,0,0,0.04)]";

/** White 16px-radius card — mobile elevation, desktop border + shadow. */
export const MOBILE_ELEVATED_CARD_CLASS = cn(
  "rounded-2xl bg-white",
  MOBILE_CARD_SURFACE_CLASS,
  DESKTOP_CARD_CHROME_CLASS,
);

/** Inset cards (Key Stats, Key Indicators) — same 16px / stroke / shadow as screener containers. */
export const MOBILE_INSET_CARD_CLASS = cn(
  "rounded-2xl border border-[#EBEBEC] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.04)]",
  MOBILE_CARD_SURFACE_CLASS,
);

/** Stock overview card section titles (Key Stats cards) — Inter Semi Bold 14/20, secondary grey. */
export const STOCK_OVERVIEW_SECTION_TITLE_CLASS = "text-[14px] font-semibold leading-5 text-[#5C5D5F]";

/** Stock overview section headings (Latest news) — Inter Semi Bold 20/28, black. */
export const STOCK_OVERVIEW_SECTION_HEADING_CLASS = "text-[20px] font-semibold leading-7 text-[#141414]";

/** Panel cards (crypto movers, empty states) — same 16px / stroke / shadow as screener containers. */
export const MOBILE_PANEL_CARD_CLASS = cn(
  "rounded-2xl border border-[#EBEBEC] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.04)]",
  MOBILE_CARD_SURFACE_CLASS,
);
