"use client";

import { useEffect, useState } from "react";

import { TURNSTILE_ENABLED, TURNSTILE_SITE_KEY } from "@/lib/auth/turnstile-public";

type TurnstileConfig = {
  siteKey: string;
  enabled: boolean;
  ready: boolean;
};

/**
 * Resolves Turnstile site key for auth forms.
 * Always confirms against `/api/auth/turnstile-config` so local `next dev` works even when
 * the client bundle was compiled without `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
 */
export function useTurnstileConfig(): TurnstileConfig {
  const [siteKey, setSiteKey] = useState(TURNSTILE_SITE_KEY);
  const [enabled, setEnabled] = useState(TURNSTILE_ENABLED);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/turnstile-config", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { siteKey?: string; enabled?: boolean } | null) => {
        if (cancelled) return;
        const key =
          typeof data?.siteKey === "string" && data.siteKey.trim()
            ? data.siteKey.trim()
            : TURNSTILE_SITE_KEY;
        setSiteKey(key);
        setEnabled(Boolean(key) || Boolean(data?.enabled) || TURNSTILE_ENABLED);
      })
      .catch(() => {
        if (!cancelled) {
          setSiteKey(TURNSTILE_SITE_KEY);
          setEnabled(TURNSTILE_ENABLED);
        }
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { siteKey, enabled, ready };
}
