import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  CalendarDays,
  Compass,
  Globe,
  LineChart,
  Wallet,
} from "lucide-react";

/** Native PNG size for tour mockups (Figma app frames exported at 2× scale for crisp crop). */
export const PRODUCT_TOUR_PREVIEW_NATIVE_WIDTH = 4096;
export const PRODUCT_TOUR_PREVIEW_NATIVE_HEIGHT = 2731;

export type ProductTourStep = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  previewSrc: string;
  /** PNG pixel width when it differs from the default native size. */
  previewNativeWidth?: number;
  /** PNG pixel height when it differs from the default native size. */
  previewNativeHeight?: number;
};

/** Six-step product tour after welcome (Figma frames 2–7 / nodes 14090, 269266, …). */
export const PRODUCT_TOUR_STEPS: ProductTourStep[] = [
  {
    id: "screener",
    title: "Screener",
    description:
      "A powerful market screener that helps users filter and analyze stocks, crypto, ETFs, and more.",
    icon: Globe,
    previewSrc: "/onboarding/product-tour-screener.png",
  },
  {
    id: "asset-overview",
    title: "Asset overview",
    description: "Real-time market data, price charts, and financial insights for smarter investing.",
    icon: LineChart,
    previewSrc: "/onboarding/product-tour-asset-overview.png",
  },
  {
    id: "earnings",
    title: "Earnings",
    description: "Upcoming earnings reports to help investors stay ahead of market moves.",
    icon: CalendarDays,
    previewSrc: "/onboarding/product-tour-earnings.png",
    previewNativeWidth: PRODUCT_TOUR_PREVIEW_NATIVE_WIDTH,
    previewNativeHeight: PRODUCT_TOUR_PREVIEW_NATIVE_HEIGHT,
  },
  {
    id: "macro",
    title: "Macro Data",
    description: "Key economic indicators and market statistics for deeper analysis.",
    icon: Compass,
    previewSrc: "/onboarding/product-tour-macro.png",
  },
  {
    id: "superinvestors",
    title: "Superinvestors",
    description: "Track top investors' holdings, trades, and market moves.",
    icon: Briefcase,
    previewSrc: "/onboarding/product-tour-superinvestors.png",
  },
  {
    id: "portfolio",
    title: "Portfolio",
    description: "Get detailed breakdowns of holdings, returns, and market trends.",
    icon: Wallet,
    previewSrc: "/onboarding/product-tour-portfolio.png",
  },
];

export const PRODUCT_TOUR_STEP_COUNT = PRODUCT_TOUR_STEPS.length;

export const PRODUCT_TOUR_PREVIEW_SRCS = PRODUCT_TOUR_STEPS.map((s) => s.previewSrc);

/** Warm the browser cache before / between tour steps (no-op on server). */
export function preloadProductTourImages(): void {
  if (typeof window === "undefined") return;
  for (const src of PRODUCT_TOUR_PREVIEW_SRCS) {
    const img = new window.Image();
    img.decoding = "async";
    img.src = src;
  }
}
