"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type PreferencesResponse = {
  earningsResultsEnabled?: boolean;
  superinvestorActivityEnabled?: boolean;
  slidesEnabled?: boolean;
  reportsEnabled?: boolean;
  error?: string;
};

export function useNotificationPreferences(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const [earningsResultsEnabled, setEarningsResultsEnabled] = useState(true);
  const [superinvestorActivityEnabled, setSuperinvestorActivityEnabled] = useState(true);
  const [slidesEnabled, setSlidesEnabled] = useState(true);
  const [reportsEnabled, setReportsEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const res = await fetch("/api/notifications/preferences", { credentials: "include" });
      const json = (await res.json()) as PreferencesResponse;
      if (res.ok) {
        if (typeof json.earningsResultsEnabled === "boolean") {
          setEarningsResultsEnabled(json.earningsResultsEnabled);
        }
        if (typeof json.superinvestorActivityEnabled === "boolean") {
          setSuperinvestorActivityEnabled(json.superinvestorActivityEnabled);
        }
        if (typeof json.slidesEnabled === "boolean") {
          setSlidesEnabled(json.slidesEnabled);
        }
        if (typeof json.reportsEnabled === "boolean") {
          setReportsEnabled(json.reportsEnabled);
        }
      }
    } catch {
      /* keep default */
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const patchPreference = useCallback(
    async (
      body: Record<string, boolean>,
      applyOptimistic: () => void,
      revert: () => void,
      successOn: string,
      successOff: string,
      next: boolean,
    ) => {
      applyOptimistic();
      setSaving(true);
      try {
        const res = await fetch("/api/notifications/preferences", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          revert();
          toast.error("Could not update notification preference. Try again.");
          return;
        }
        toast.success(next ? successOn : successOff);
      } catch {
        revert();
        toast.error("Could not update notification preference. Try again.");
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const setEarningsResults = useCallback(
    async (next: boolean) => {
      const prev = earningsResultsEnabled;
      await patchPreference(
        { earningsResultsEnabled: next },
        () => setEarningsResultsEnabled(next),
        () => setEarningsResultsEnabled(prev),
        "Earning results alerts turned on.",
        "Earning results alerts turned off.",
        next,
      );
    },
    [earningsResultsEnabled, patchPreference],
  );

  const setSuperinvestorActivity = useCallback(
    async (next: boolean) => {
      const prev = superinvestorActivityEnabled;
      await patchPreference(
        { superinvestorActivityEnabled: next },
        () => setSuperinvestorActivityEnabled(next),
        () => setSuperinvestorActivityEnabled(prev),
        "Superinvestor activity alerts turned on.",
        "Superinvestor activity alerts turned off.",
        next,
      );
    },
    [superinvestorActivityEnabled, patchPreference],
  );

  const setSlides = useCallback(
    async (next: boolean) => {
      const prev = slidesEnabled;
      await patchPreference(
        { slidesEnabled: next },
        () => setSlidesEnabled(next),
        () => setSlidesEnabled(prev),
        "Slides alerts turned on.",
        "Slides alerts turned off.",
        next,
      );
    },
    [slidesEnabled, patchPreference],
  );

  const setReports = useCallback(
    async (next: boolean) => {
      const prev = reportsEnabled;
      await patchPreference(
        { reportsEnabled: next },
        () => setReportsEnabled(next),
        () => setReportsEnabled(prev),
        "Reports alerts turned on.",
        "Reports alerts turned off.",
        next,
      );
    },
    [reportsEnabled, patchPreference],
  );

  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh]);

  return {
    earningsResultsEnabled,
    superinvestorActivityEnabled,
    slidesEnabled,
    reportsEnabled,
    loading,
    saving,
    refresh,
    setEarningsResults,
    setSuperinvestorActivity,
    setSlides,
    setReports,
  };
}
