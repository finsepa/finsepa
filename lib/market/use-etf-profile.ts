"use client";

import { useEffect, useState } from "react";

import type { EtfProfile } from "@/lib/market/etf-profile-types";

const inflight = new Map<string, Promise<EtfProfile | null>>();

function loadEtfProfile(ticker: string): Promise<EtfProfile | null> {
  const key = ticker.trim().toUpperCase();
  let p = inflight.get(key);
  if (!p) {
    p = fetch(`/api/stocks/${encodeURIComponent(key)}/etf-profile`, { credentials: "include" })
      .then(async (res) => (res.ok ? (((await res.json()) as { profile: EtfProfile | null }).profile ?? null) : null))
      .catch(() => null);
    p.then((v) => {
      if (v == null) inflight.delete(key);
    });
    inflight.set(key, p);
  }
  return p;
}

/** Shared per-ticker ETF profile (overview key stats + holdings tab issue one request). */
export function useEtfProfile(ticker: string, enabled = true): { profile: EtfProfile | null; loading: boolean } {
  const [state, setState] = useState<{ key: string; profile: EtfProfile | null; loading: boolean }>({
    key: "",
    profile: null,
    loading: true,
  });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const key = ticker.trim().toUpperCase();
    void loadEtfProfile(key).then((profile) => {
      if (!cancelled) setState({ key, profile, loading: false });
    });
    return () => {
      cancelled = true;
    };
  }, [ticker, enabled]);

  const current = state.key === ticker.trim().toUpperCase();
  return { profile: current ? state.profile : null, loading: !current || state.loading };
}
