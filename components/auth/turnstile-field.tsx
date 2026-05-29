"use client";

import { useEffect, useRef, useState } from "react";

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
  }
}

const TURNSTILE_SCRIPT_ID = "cloudflare-turnstile-script";
const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

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

/** Load Turnstile once; safe when the widget mounts after the user fills the form. */
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

/**
 * Cloudflare Turnstile widget. Callbacks are kept in refs so parent re-renders
 * (e.g. setState on success) do not remove/re-render the iframe mid-interaction.
 */
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
  const onTokenRef = useRef(onToken);
  const onExpireRef = useRef(onExpire);
  const [scriptReady, setScriptReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    loadTurnstileScript()
      .then(() => {
        if (!cancelled) setScriptReady(true);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!scriptReady || !siteKey) return;

    const el = containerRef.current;
    if (!el || !window.turnstile) return;
    if (widgetIdRef.current) return;

    widgetIdRef.current = window.turnstile.render(el, {
      sitekey: siteKey,
      callback: (token) => onTokenRef.current(token),
      "expired-callback": () => onExpireRef.current?.(),
      "error-callback": () => onExpireRef.current?.(),
    });

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
  }, [scriptReady, siteKey]);

  if (loadError) {
    return (
      <p className="text-sm leading-5 text-[#B91C1C]" role="alert">
        Security check failed to load. Refresh the page and try again.
      </p>
    );
  }

  return (
    <div
      ref={containerRef}
      className="min-h-[65px]"
      aria-label={scriptReady ? "Security check" : "Loading security check"}
    />
  );
}
