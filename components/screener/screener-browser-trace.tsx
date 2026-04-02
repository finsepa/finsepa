"use client";

import { useEffect } from "react";

/**
 * When NEXT_PUBLIC_FINSEPA_PROVIDER_TRACE=1, logs same-origin fetch URLs (browser → Next.js)
 * so you can separate browser network from internal route handlers vs EODHD (server logs).
 */
export function ScreenerBrowserTrace() {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_FINSEPA_PROVIDER_TRACE !== "1") return;

    let count = 0;
    const orig = window.fetch.bind(window);
    window.fetch = function fetchTrace(...args: Parameters<typeof fetch>) {
      count += 1;
      const input = args[0];
      const url =
        typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
      try {
        const u = new URL(url, window.location.origin);
        if (u.origin === window.location.origin) {
          console.info("[FINSEPA_BROWSER→APP]", count, u.pathname + u.search);
        }
      } catch {
        console.info("[FINSEPA_BROWSER→APP]", count, url);
      }
      return orig(...args);
    };

    return () => {
      console.info("[FINSEPA_BROWSER→APP] session_total", count);
      window.fetch = orig;
    };
  }, []);

  return null;
}
