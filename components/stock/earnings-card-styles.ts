import type { CSSProperties } from "react";

import { MOBILE_CARD_SURFACE_CLASS } from "@/components/design-system/card-surface-styles";
import { cn } from "@/lib/utils";

/** Figma: card value titles — Inter Semi Bold 24 / 36, #09090B. Shared by Earnings summary cards and Multicharts metric cards. */
export const EARNINGS_CARD_VALUE_CLASS =
  "font-['Inter'] text-[24px] font-semibold leading-[36px] tracking-normal text-[#09090B]";

/** Figma: card labels — Inter Semi Bold 14 / 20, #71717A. */
export const EARNINGS_CARD_LABEL_CLASS =
  "font-['Inter'] text-[14px] font-semibold leading-5 tracking-normal text-[#71717A]";

/** Prior-period line under summary metric headline (e.g. "from $416.16B"). */
export const EARNINGS_CARD_PRIOR_LINE_CLASS =
  "font-['Inter'] text-[14px] font-medium leading-5 tracking-normal text-[#71717A] tabular-nums";

/** Forward / consensus-only periods in Estimates (chart bars, table columns, summary cards). */
export const EARNINGS_FORECAST_OPACITY_CLASS = "opacity-60";

/** Soft diagonal hatch behind forecast chart band and table columns. */
export const EARNINGS_FORECAST_BAND_BG_STYLE: CSSProperties = {
  backgroundColor: "rgba(113, 113, 122, 0.025)",
  backgroundImage:
    "repeating-linear-gradient(45deg, rgba(113, 113, 122, 0.055) 0, rgba(113, 113, 122, 0.055) 1px, transparent 1px, transparent 9px)",
};

/** Left edge of the forecast band (chart + first forecast table column). */
export const EARNINGS_FORECAST_BAND_EDGE_STYLE: CSSProperties = {
  borderLeft: "1px dashed rgba(161, 161, 170, 0.35)",
};

/** Opaque Forecast pill — chart band + table overlay. */
export const EARNINGS_FORECAST_BADGE_CLASS =
  "pointer-events-none whitespace-nowrap rounded-md border border-[#E4E4E7] bg-white px-2 py-0.5 font-['Inter'] text-[10px] font-semibold uppercase tracking-wider text-[#A1A1AA] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]";

/** Diagonal hatch fill for forward estimate bars in the Estimates chart. */
export function earningsForecastBarFillStyle(barColor: string): CSSProperties {
  const { fill, line, border } = earningsForecastHatchColors(barColor);
  return {
    backgroundColor: fill,
    backgroundImage: `repeating-linear-gradient(45deg, ${line} 0, ${line} 1.5px, transparent 1.5px, transparent 7px)`,
    border: `1px solid ${border}`,
    boxSizing: "border-box",
  };
}

/** Same hatch language as forecast bars, tuned for small estimate dots. */
export function earningsForecastDotFillStyle(barColor: string): CSSProperties {
  const { fill, line, border } = earningsForecastHatchColors(barColor);
  return {
    backgroundColor: fill,
    backgroundImage: `repeating-linear-gradient(45deg, ${line} 0, ${line} 1px, transparent 1px, transparent 3.5px)`,
    border: `1.5px solid ${border}`,
    boxSizing: "border-box",
  };
}

function earningsForecastHatchColors(barColor: string): { fill: string; line: string; border: string } {
  const hex = barColor.match(/^#([0-9a-f]{6})$/i);
  let fill = "rgba(37, 99, 235, 0.16)";
  let line = "rgba(37, 99, 235, 0.72)";
  let border = "rgba(37, 99, 235, 0.45)";
  if (hex) {
    const v = parseInt(hex[1]!, 16);
    const r = (v >> 16) & 255;
    const g = (v >> 8) & 255;
    const b = v & 255;
    fill = `rgba(${r},${g},${b},0.16)`;
    line = `rgba(${r},${g},${b},0.72)`;
    border = `rgba(${r},${g},${b},0.45)`;
  }
  return { fill, line, border };
}

/** Multicharts / macro metric cards — Figma desktop: 20px padding, 12px radius, 1px stroke; mobile matches home screener table card. */
export const MULTICHART_CARD_CLASS = cn(
  "flex flex-col gap-2 overflow-x-hidden overflow-y-visible rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition md:hover:shadow-[0px_2px_4px_0px_rgba(10,10,10,0.08)]",
  "max-md:rounded-2xl",
  MOBILE_CARD_SURFACE_CLASS,
);

/** Default chart plot height inside a multichart / macro card. */
export const MULTICHART_CARD_CHART_HEIGHT_PX = 278;
