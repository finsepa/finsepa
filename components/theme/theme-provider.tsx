"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * Class-based theme (`html.dark`) — matches `--fs-*` overrides in `app/globals.css`.
 *
 * - Default / first visit: `"system"` (follows OS light/dark).
 * - Preference stored in `localStorage` key `"theme"` — survives logout/login on this browser.
 * - Auth pages share this provider (no forced light theme).
 *
 * `next-themes@0.4.6` is patched (`patches/next-themes+0.4.6.patch`) so its FOUC
 * `<script>` only renders on the server — React 19 / Next 16 reject client-rendered scripts.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      enableColorScheme
      storageKey="theme"
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
