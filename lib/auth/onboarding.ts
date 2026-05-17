import type { SupabaseClient, User } from "@supabase/supabase-js";

/** Session flag set during signup / auth callback. */
export const ONBOARDING_PENDING_KEY = "finsepa_onboarding_pending";

/** Local backup when sessionStorage is cleared mid-OAuth. */
export const ONBOARDING_PENDING_LOCAL_KEY = "finsepa_onboarding_pending_local";

/** Persists after the user finishes or skips onboarding. */
export const ONBOARDING_COMPLETE_KEY = "finsepa_onboarding_complete";

/** Query flag on `/screener` after auth redirect (survives OAuth round-trips). */
export const ONBOARDING_QUERY_VALUE = "1";

/** Written on signup; cleared when onboarding is done. */
export const ONBOARDING_META_PENDING = "onboarding_pending";
export const ONBOARDING_META_COMPLETE = "onboarding_completed";

const NEW_ACCOUNT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function userMetadata(user: User | null): Record<string, unknown> {
  return (user?.user_metadata ?? {}) as Record<string, unknown>;
}

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
    localStorage.setItem(ONBOARDING_PENDING_LOCAL_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function isOnboardingPending(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (sessionStorage.getItem(ONBOARDING_PENDING_KEY) === "1") return true;
    return localStorage.getItem(ONBOARDING_PENDING_LOCAL_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearOnboardingPendingFlags(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(ONBOARDING_PENDING_KEY);
    localStorage.removeItem(ONBOARDING_PENDING_LOCAL_KEY);
  } catch {
    /* ignore */
  }
}

/** Server + client: should this user see welcome onboarding? */
export function userNeedsOnboarding(user: User | null): boolean {
  if (!user) return false;

  const meta = userMetadata(user);
  if (meta[ONBOARDING_META_COMPLETE] === true) return false;

  if (meta[ONBOARDING_META_PENDING] === true) return true;

  const createdAt = new Date(user.created_at).getTime();
  if (!Number.isNaN(createdAt) && Date.now() - createdAt < NEW_ACCOUNT_WINDOW_MS) {
    return true;
  }

  return false;
}

/** True when this auth exchange is a fresh signup (email confirm, OAuth, etc.). */
export function shouldMarkOnboardingAfterAuth(user: User | null, authType: string | null | undefined): boolean {
  if (!user) return false;
  if (hasCompletedOnboarding()) return false;

  const meta = userMetadata(user);
  if (meta[ONBOARDING_META_COMPLETE] === true) return false;

  if (authType === "signup" || authType === "invite") return true;
  if (meta[ONBOARDING_META_PENDING] === true) return true;

  const createdAt = new Date(user.created_at).getTime();
  if (Number.isNaN(createdAt)) return false;
  return Date.now() - createdAt < NEW_ACCOUNT_WINDOW_MS;
}

export function shouldShowWelcomeOnboarding(user?: User | null): boolean {
  if (hasCompletedOnboarding()) return false;
  if (isOnboardingPending()) return true;
  if (user) return userNeedsOnboarding(user);
  return false;
}

export async function persistOnboardingPendingOnUser(supabase: SupabaseClient): Promise<void> {
  markOnboardingPending();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (userMetadata(user)[ONBOARDING_META_COMPLETE] === true) return;
    await supabase.auth.updateUser({
      data: {
        [ONBOARDING_META_PENDING]: true,
      },
    });
  } catch {
    /* non-blocking */
  }
}

export async function markOnboardingCompleteForUser(supabase?: SupabaseClient): Promise<void> {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(ONBOARDING_COMPLETE_KEY, "1");
    } catch {
      /* ignore */
    }
    clearOnboardingPendingFlags();
  }

  if (!supabase) return;

  try {
    await supabase.auth.updateUser({
      data: {
        [ONBOARDING_META_PENDING]: false,
        [ONBOARDING_META_COMPLETE]: true,
      },
    });
  } catch {
    /* non-blocking */
  }
}

/** @deprecated Prefer `markOnboardingCompleteForUser`. */
export function markOnboardingComplete(): void {
  void markOnboardingCompleteForUser();
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

const SESSION_RETRY_MS = [0, 50, 150, 350, 700, 1200];

/** Wait until Supabase exposes a session user (avoids race right after redirect). */
export async function waitForSessionUser(supabase: SupabaseClient): Promise<User | null> {
  for (const delay of SESSION_RETRY_MS) {
    if (delay > 0) {
      await new Promise((r) => setTimeout(r, delay));
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) return session.user;
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (user: User | null) => {
      if (settled) return;
      settled = true;
      resolve(user);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) finish(session.user);
    });

    const timeout = window.setTimeout(() => {
      subscription.unsubscribe();
      void supabase.auth.getSession().then(({ data: { session } }) => {
        finish(session?.user ?? null);
      });
    }, 4000);

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        window.clearTimeout(timeout);
        subscription.unsubscribe();
        finish(session.user);
      }
    });
  });
}
