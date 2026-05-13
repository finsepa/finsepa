"use client";

import type { BillingSummary } from "@/lib/account/billing";

const CACHE_VERSION = 1 as const;
const STORAGE_PREFIX = `finsepa.billingSummaryMenu.v${CACHE_VERSION}:`;

/** How long the profile menu trusts cached billing data before revalidating (Stripe plan rarely changes mid-month). */
export const BILLING_SUMMARY_MENU_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type BillingSummaryMenuCacheEntry = {
  v: typeof CACHE_VERSION;
  fetchedAt: number;
  summary: BillingSummary;
};

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

function isBillingSummary(x: unknown): x is BillingSummary {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    (o.plan === "pro" || o.plan === "trial") &&
    typeof o.accessState === "string" &&
    Array.isArray(o.paymentHistory)
  );
}

export function readBillingSummaryMenuCache(userId: string): BillingSummaryMenuCacheEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const p = parsed as Record<string, unknown>;
    if (p.v !== CACHE_VERSION || typeof p.fetchedAt !== "number" || !isBillingSummary(p.summary)) return null;
    return { v: CACHE_VERSION, fetchedAt: p.fetchedAt, summary: p.summary };
  } catch {
    return null;
  }
}

export function writeBillingSummaryMenuCache(userId: string, summary: BillingSummary): void {
  if (typeof window === "undefined") return;
  try {
    const payload: BillingSummaryMenuCacheEntry = {
      v: CACHE_VERSION,
      fetchedAt: Date.now(),
      summary,
    };
    localStorage.setItem(storageKey(userId), JSON.stringify(payload));
  } catch {
    // private mode / quota
  }
}

export function invalidateBillingSummaryMenuCache(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {
    // ignore
  }
}

export function isBillingSummaryMenuCacheFresh(fetchedAt: number): boolean {
  return Date.now() - fetchedAt < BILLING_SUMMARY_MENU_CACHE_TTL_MS;
}
