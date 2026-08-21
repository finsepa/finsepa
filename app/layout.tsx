import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { SupabaseBrowserEnvProvider } from "@/components/supabase/supabase-browser-env-provider";
import { AuthTokenLandingBootstrap } from "@/components/auth/auth-token-landing-bootstrap";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ModalStackProvider } from "@/components/ui/modal-stack-provider";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Finsepa",
  description: "Market intelligence platform",
  icons: {
    icon: [{ url: "/favicon.ico" }, { url: "/icon.png", type: "image/png" }],
    apple: "/apple-icon.png",
  },
  /** Safari on iOS: native Smart App Banner → App Store / open Finsepa. */
  other: {
    "apple-itunes-app":
      "app-id=6801018314, app-argument=https://apps.apple.com/app/finsepa/id6801018314",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  /** Resize layout when Safari’s bottom toolbar collapses/expands (iOS 15+). */
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#E4E4E7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <SupabaseBrowserEnvProvider url={supabaseUrl} anonKey={supabaseAnonKey}>
            <AuthTokenLandingBootstrap />
            <ModalStackProvider>{children}</ModalStackProvider>
          </SupabaseBrowserEnvProvider>
          <Toaster position="top-center" closeButton />
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
