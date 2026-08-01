import type { Metadata, Viewport } from "next";

/**
 * Auth screens follow the same system theme as the app (next-themes).
 * Do not force `colorScheme: "light"` — login/signup should match OS / stored preference.
 */
export const authViewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#E4E4E7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  colorScheme: "normal",
};

export const authMetadata: Metadata = {
  appleWebApp: {
    statusBarStyle: "black-translucent",
  },
};
