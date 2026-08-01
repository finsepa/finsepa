"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";

import type { LogoDevTheme } from "@/lib/screener/company-logo-url";

function subscribeNoop() {
  return () => {};
}

/** True only after client mount — keeps SSR / hydration markup identical. */
export function useClientMounted(): boolean {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

/**
 * Logo.dev proxy theme for `<img src>`.
 * Always `light` on the server and during hydration; switches to `dark` after mount when needed.
 * Avoids next-themes hydration mismatches (`theme=light` vs `theme=dark` on first paint).
 */
export function useLogoDevTheme(): LogoDevTheme {
  const mounted = useClientMounted();
  const { resolvedTheme } = useTheme();
  return mounted && resolvedTheme === "dark" ? "dark" : "light";
}

/**
 * Stable paint key for canvas charts — remount when light/dark flips so axis pills,
 * fills, and markers re-resolve `--fs-*` colors.
 */
export function useChartThemePaintKey(): "light" | "dark" {
  return useLogoDevTheme() === "dark" ? "dark" : "light";
}
