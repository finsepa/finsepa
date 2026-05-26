"use client";

import {
  DEFAULT_IDENTITY_LRU_MAX_ENTRIES,
  evictIdentityLru,
  pruneIdentityStore,
  touchIdentityEntry,
  type IdentityLruStore,
} from "@/lib/cache/client-identity-lru";

/** Client-side reuse of screener row identity (name + logo URL) — 7d TTL + LRU cap. */
export const SCREENER_COMPANY_IDENTITY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const STORAGE_KEY = "finsepa:screener:company-identity:v2-lru";

function readPayload(): IdentityLruStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as IdentityLruStore;
  } catch {
    return {};
  }
}

function writePayload(payload: IdentityLruStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export type ScreenerCompanyIdentitySlice = {
  name: string;
  logoUrl: string;
};

/** Previously stored identity for this ticker, if still within the TTL window. */
export function readScreenerCompanyIdentity(ticker: string): ScreenerCompanyIdentitySlice | null {
  const tk = ticker.trim().toUpperCase();
  if (!tk) return null;
  const now = Date.now();
  let payload = pruneIdentityStore(readPayload(), now);
  const entry = payload[tk];
  if (!entry) return null;
  const name = typeof entry.name === "string" ? entry.name.trim() : "";
  const logoUrl = typeof entry.logoUrl === "string" ? entry.logoUrl.trim() : "";
  if (!name) return null;
  payload[tk] = touchIdentityEntry(entry, now);
  payload = evictIdentityLru(payload, DEFAULT_IDENTITY_LRU_MAX_ENTRIES);
  writePayload(payload);
  return { name, logoUrl };
}

/** Persist identities from a loaded screener table (SSR or API pagination). */
export function mergeScreenerCompanyIdentities(
  rows: readonly { ticker: string; name: string; logoUrl?: string | null }[],
): void {
  if (!rows.length || typeof window === "undefined") return;
  const now = Date.now();
  const expiresAt = now + SCREENER_COMPANY_IDENTITY_TTL_MS;
  let payload = pruneIdentityStore(readPayload(), now);
  for (const row of rows) {
    const ticker = row.ticker.trim().toUpperCase();
    const name = row.name.trim();
    if (!ticker || !name) continue;
    const logoUrl = typeof row.logoUrl === "string" ? row.logoUrl.trim() : "";
    payload[ticker] = { name, logoUrl, expiresAt, lastAccessedAt: now };
  }
  payload = evictIdentityLru(payload, DEFAULT_IDENTITY_LRU_MAX_ENTRIES);
  writePayload(payload);
}
