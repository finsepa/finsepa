"use client";

import { useEffect } from "react";

import { gaEvent } from "@/lib/analytics/google-analytics";

const NEW_ACCOUNT_WINDOW_MS = 30 * 60 * 1000;

/** Sends GA `sign_up` once per account, on the first app load shortly after the account was created. */
export function GoogleAnalyticsSignUp({ userId, createdAt }: { userId: string; createdAt: string }) {
  useEffect(() => {
    const created = new Date(createdAt).getTime();
    if (Number.isNaN(created) || Date.now() - created > NEW_ACCOUNT_WINDOW_MS) return;

    const key = `finsepa:ga-sign-up:${userId}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      return;
    }
    gaEvent("sign_up");
  }, [userId, createdAt]);

  return null;
}
