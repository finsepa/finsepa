import { cn } from "@/lib/utils";

/** Grey page shell behind elevated cards (stock, screener, portfolio mobile). */
export const MOBILE_PAGE_BACKGROUND_CLASS = "bg-[#FAFAFA]";

/** Figma mobile card chrome: borderless + stacked drop shadows (0/1/2 @ 7%, 0/1/4 @ 12%, #0A0A0A). */
export const MOBILE_CARD_SURFACE_CLASS =
  "max-md:border-0 max-md:shadow-[0px_1px_2px_0px_rgba(10,10,10,0.07),0px_1px_4px_0px_rgba(10,10,10,0.12)]";

/** Desktop bordered card with light single shadow. */
export const DESKTOP_CARD_CHROME_CLASS =
  "md:border md:border-[#E4E4E7] md:shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]";

/** White 16px-radius card — mobile elevation, desktop border + shadow. */
export const MOBILE_ELEVATED_CARD_CLASS = cn(
  "rounded-2xl bg-white",
  MOBILE_CARD_SURFACE_CLASS,
  DESKTOP_CARD_CHROME_CLASS,
);

/** Key Stats / screener table — 12px radius desktop, 16px mobile, stacked shadow on small screens. */
export const MOBILE_INSET_CARD_CLASS = cn(
  "rounded-xl border border-[#E4E4E7] bg-white max-md:rounded-2xl",
  MOBILE_CARD_SURFACE_CLASS,
);

/** Stock overview card section titles (Key Indicators, Key Stats) — watchlist rail grey label. */
export const STOCK_OVERVIEW_SECTION_TITLE_CLASS = "text-[14px] font-medium leading-5 text-[#71717A]";

/** Panel cards (crypto movers, empty states) — 12px desktop, 16px mobile. */
export const MOBILE_PANEL_CARD_CLASS = cn(
  "rounded-[12px] border border-[#E4E4E7] bg-white shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] max-md:rounded-2xl",
  MOBILE_CARD_SURFACE_CLASS,
);
