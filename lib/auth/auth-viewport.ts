import type { Metadata, Viewport } from "next";

/** White Safari top/bottom chrome on login, signup, and related auth screens. */
export const authViewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export const authMetadata: Metadata = {
  appleWebApp: {
    statusBarStyle: "default",
  },
};
