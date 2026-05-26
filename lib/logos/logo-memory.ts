"use client";

import { SCREENER_COMPANY_IDENTITY_TTL_MS } from "@/lib/screener/screener-company-identity-storage";

const STORAGE_KEY = "finsepa:logo-mem:v1";

type GlobalWithLogoMem = typeof globalThis & { __finsepaLogoMem?: Map<string, string | null> };

type StoredEntry = {
  url: string | null;
  expiresAt: number;
};

type StoredPayload = Record<string, StoredEntry>;

function map(): Map<string, string | null> {
  const g = globalThis as GlobalWithLogoMem;
  if (!g.__finsepaLogoMem) g.__finsepaLogoMem = new Map();
  return g.__finsepaLogoMem;
}

let hydrated = false;

function readPayload(): StoredPayload {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as StoredPayload;
  } catch {
    return {};
  }
}

function writePayload(payload: StoredPayload): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

function pruneExpired(payload: StoredPayload, now: number): StoredPayload {
  const out: StoredPayload = {};
  for (const [ticker, entry] of Object.entries(payload)) {
    if (entry && typeof entry.expiresAt === "number" && entry.expiresAt > now) {
      out[ticker] = entry;
    }
  }
  return out;
}

function hydrateFromStorage(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  const now = Date.now();
  const payload = pruneExpired(readPayload(), now);
  const mem = map();
  for (const [ticker, entry] of Object.entries(payload)) {
    mem.set(ticker, entry.url);
  }
}

function persistEntry(symbol: string, url: string | null): void {
  const tk = symbol.trim().toUpperCase();
  if (!tk) return;
  const now = Date.now();
  const payload = pruneExpired(readPayload(), now);
  payload[tk] = { url, expiresAt: now + SCREENER_COMPANY_IDENTITY_TTL_MS };
  writePayload(payload);
}

/** Persist a resolved logo URL (or confirmed miss) for cross-route client reuse (7d localStorage). */
export function mergeLogoMemory(symbol: string, url: string | null): void {
  const tk = symbol.trim().toUpperCase();
  map().set(tk, url);
  persistEntry(tk, url);
}

/** Previously resolved URL for this symbol, if any (memory + localStorage, 7d TTL). */
export function readLogoMemory(symbol: string): string | null | undefined {
  hydrateFromStorage();
  const tk = symbol.trim().toUpperCase();
  const mem = map().get(tk);
  if (mem !== undefined) return mem;

  const now = Date.now();
  const payload = pruneExpired(readPayload(), now);
  const entry = payload[tk];
  if (!entry) return undefined;
  map().set(tk, entry.url);
  return entry.url;
}
