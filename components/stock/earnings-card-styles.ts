import type { CSSProperties } from "react";

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

/** Diagonal hatch fill for forward estimate bars in the Estimates chart. */
export function earningsForecastBarFillStyle(barColor: string): CSSProperties {
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
  return {
    backgroundColor: fill,
    backgroundImage: `repeating-linear-gradient(45deg, ${line} 0, ${line} 1.5px, transparent 1.5px, transparent 7px)`,
    border: `1px solid ${border}`,
    boxSizing: "border-box",
  };
}

/** Multicharts / macro metric cards — Figma: 20px padding, 12px radius, 1px #E4E4E7 stroke. */
export const MULTICHART_CARD_CLASS =
  "flex flex-col gap-2 overflow-x-hidden overflow-y-visible rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition hover:shadow-[0px_2px_4px_0px_rgba(10,10,10,0.08)]";

/** Default chart plot height inside a multichart / macro card. */
export const MULTICHART_CARD_CHART_HEIGHT_PX = 278;
