"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        },
      ) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

export function TurnstileField({
  siteKey,
  onToken,
  onExpire,
}: {
  siteKey: string;
  onToken: (token: string) => void;
  onExpire?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  const mountWidget = useCallback(() => {
    const el = containerRef.current;
    if (!el || !window.turnstile || !siteKey) return;
    if (widgetIdRef.current) {
      try {
        window.turnstile.remove(widgetIdRef.current);
      } catch {
        /* ignore */
      }
      widgetIdRef.current = null;
    }
    widgetIdRef.current = window.turnstile.render(el, {
      sitekey: siteKey,
      callback: onToken,
      "expired-callback": () => onExpire?.(),
      "error-callback": () => onExpire?.(),
    });
  }, [onExpire, onToken, siteKey]);

  useEffect(() => {
    if (scriptReady) mountWidget();
    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* ignore */
        }
      }
      widgetIdRef.current = null;
    };
  }, [mountWidget, scriptReady]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => {
          setScriptReady(true);
          window.onTurnstileLoad?.();
        }}
      />
      <div ref={containerRef} className="min-h-[65px]" aria-label="Security check" />
    </>
  );
}
