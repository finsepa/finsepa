"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      ready: (cb: () => void) => void;
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          retry?: "auto" | "never";
          "refresh-expired"?: "auto" | "manual" | "never";
        },
      ) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
  }
}

const TURNSTILE_SCRIPT_ID = "cloudflare-turnstile-script";
/** Implicit + explicit render (no `render=explicit` — more reliable on localhost). */
const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

let turnstileLoadPromise: Promise<void> | null = null;

function waitForTurnstile(): Promise<void> {
  return new Promise((resolve) => {
    const tick = () => {
      if (window.turnstile) resolve();
      else requestAnimationFrame(tick);
    };
    tick();
  });
}

export function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (turnstileLoadPromise) return turnstileLoadPromise;

  turnstileLoadPromise = new Promise((resolve, reject) => {
    const finish = () => {
      waitForTurnstile().then(resolve).catch(reject);
    };

    const existing = document.getElementById(TURNSTILE_SCRIPT_ID);
    if (existing) {
      finish();
      return;
    }

    const script = document.createElement("script");
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = finish;
    script.onerror = () => {
      turnstileLoadPromise = null;
      reject(new Error("Turnstile script failed to load"));
    };
    document.head.appendChild(script);
  });

  return turnstileLoadPromise;
}

function renderErrorMessage(siteKey: string): string {
  const suffix = siteKey.length >= 6 ? siteKey.slice(-6) : siteKey;
  const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
  return `Cloudflare security check failed on ${host}. In Cloudflare → Turnstile, open the widget whose Site Key ends with “${suffix}”, confirm localhost and 127.0.0.1 are listed, wait a few minutes after saving, then hard-refresh. Try an incognito window or Continue with Google.`;
}

export function TurnstileField({
  siteKey,
  onToken,
  onExpire,
  onRenderError,
}: {
  siteKey: string;
  onToken: (token: string) => void;
  onExpire?: () => void;
  onRenderError?: (message: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const onExpireRef = useRef(onExpire);
  const onRenderErrorRef = useRef(onRenderError);
  const [loadError, setLoadError] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    onRenderErrorRef.current = onRenderError;
  }, [onRenderError]);

  useEffect(() => {
    if (!siteKey) return;

    let cancelled = false;
    setLoadError(false);
    setRenderError(null);

    const reportRenderError = (message: string) => {
      if (cancelled) return;
      setRenderError(message);
      onRenderErrorRef.current?.(message);
    };

    const mountWidget = () => {
      const el = containerRef.current;
      if (!el || !window.turnstile || widgetIdRef.current || cancelled) return;

      try {
        widgetIdRef.current = window.turnstile.render(el, {
          sitekey: siteKey,
          retry: "auto",
          "refresh-expired": "auto",
          callback: (token) => {
            setRenderError(null);
            onTokenRef.current(token);
          },
          "expired-callback": () => onExpireRef.current?.(),
          "error-callback": () => {
            onExpireRef.current?.();
            reportRenderError(renderErrorMessage(siteKey));
          },
        });
      } catch {
        reportRenderError(renderErrorMessage(siteKey));
      }
    };

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !window.turnstile) return;
        window.turnstile.ready(mountWidget);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* ignore */
        }
      }
      widgetIdRef.current = null;
    };
  }, [siteKey]);

  if (loadError) {
    return (
      <p className="text-sm leading-5 text-[#B91C1C]" role="alert">
        Security check failed to load. Refresh the page and try again.
      </p>
    );
  }

  if (renderError) {
    return (
      <p className="text-sm leading-5 text-[#B91C1C]" role="alert">
        {renderError}
      </p>
    );
  }

  return (
    <div
      ref={containerRef}
      className="min-h-[65px]"
      aria-label="Loading security check"
    />
  );
}
