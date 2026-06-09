"use client";

import { useCallback, useEffect, useState } from "react";

type PreferencesResponse = {
  earningsResultsEnabled?: boolean;
  error?: string;
};

export function useNotificationPreferences(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const [earningsResultsEnabled, setEarningsResultsEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const res = await fetch("/api/notifications/preferences", { credentials: "include" });
      const json = (await res.json()) as PreferencesResponse;
      if (res.ok && typeof json.earningsResultsEnabled === "boolean") {
        setEarningsResultsEnabled(json.earningsResultsEnabled);
      }
    } catch {
      /* keep default */
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const setEarningsResults = useCallback(async (next: boolean) => {
    const prev = earningsResultsEnabled;
    setEarningsResultsEnabled(next);
    setSaving(true);
    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ earningsResultsEnabled: next }),
      });
      if (!res.ok) setEarningsResultsEnabled(prev);
    } catch {
      setEarningsResultsEnabled(prev);
    } finally {
      setSaving(false);
    }
  }, [earningsResultsEnabled]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh]);

  return {
    earningsResultsEnabled,
    loading,
    saving,
    refresh,
    setEarningsResults,
  };
}
