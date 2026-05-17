import type { User } from "@supabase/supabase-js";

/** Set when auth callback detects a new account; cleared after welcome modal. */
export const ONBOARDING_PENDING_KEY = "finsepa_onboarding_pending";

/** Persists after the user dismisses welcome onboarding. */
export const ONBOARDING_COMPLETE_KEY = "finsepa_onboarding_complete";

/** Query flag on `/screener` after auth redirect (survives OAuth round-trips). */
export const ONBOARDING_QUERY_VALUE = "1";

const NEW_ACCOUNT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function hasCompletedOnboarding(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(ONBOARDING_COMPLETE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markOnboardingPending(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(ONBOARDING_PENDING_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function isOnboardingPending(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(ONBOARDING_PENDING_KEY) === "1";
  } catch {
    return false;
  }
}

export function markOnboardingComplete(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, "1");
    sessionStorage.removeItem(ONBOARDING_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

/** True when this auth exchange is a fresh signup (email confirm, OAuth, etc.). */
export function shouldMarkOnboardingAfterAuth(user: User | null, authType: string | null | undefined): boolean {
  if (!user || hasCompletedOnboarding()) return false;
  if (authType === "signup" || authType === "invite") return true;
  const createdAt = new Date(user.created_at).getTime();
  if (Number.isNaN(createdAt)) return false;
  return Date.now() - createdAt < NEW_ACCOUNT_WINDOW_MS;
}

export function shouldShowWelcomeOnboarding(): boolean {
  if (hasCompletedOnboarding()) return false;
  return isOnboardingPending();
}

export function hasOnboardingQueryFlag(search: string): boolean {
  if (!search) return false;
  try {
    return new URLSearchParams(search).get("onboarding") === ONBOARDING_QUERY_VALUE;
  } catch {
    return false;
  }
}

export function appendOnboardingQuery(path: string): string {
  const [pathname, search = ""] = path.split("?");
  const params = new URLSearchParams(search);
  params.set("onboarding", ONBOARDING_QUERY_VALUE);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : `${pathname}?${qs}`;
}

/** Remove `onboarding` from the address bar without navigation. */
export function stripOnboardingQueryFromUrl(): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("onboarding")) return;
    url.searchParams.delete("onboarding");
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, "", next);
  } catch {
    /* ignore */
  }
}
