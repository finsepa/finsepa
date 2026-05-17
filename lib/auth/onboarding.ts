import type { SupabaseClient, User } from "@supabase/supabase-js";

/** Session flag set during signup / auth callback. */
export const ONBOARDING_PENDING_KEY = "finsepa_onboarding_pending";

/** Local backup when sessionStorage is cleared mid-OAuth. */
export const ONBOARDING_PENDING_LOCAL_KEY = "finsepa_onboarding_pending_local";

/** Per-user completion (suffix with user id). Legacy global key migrated away. */
export const ONBOARDING_COMPLETE_KEY = "finsepa_onboarding_complete";

/** @deprecated Global key from early builds — do not write. */
const ONBOARDING_COMPLETE_LEGACY_KEY = "finsepa_onboarding_complete";

/** Query flag on `/screener` after auth redirect (survives OAuth round-trips). */
export const ONBOARDING_QUERY_VALUE = "1";

/** Written on signup; cleared when onboarding is done. */
export const ONBOARDING_META_PENDING = "onboarding_pending";
export const ONBOARDING_META_COMPLETE = "onboarding_completed";

const NEW_ACCOUNT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function userMetadata(user: User | null): Record<string, unknown> {
  return (user?.user_metadata ?? {}) as Record<string, unknown>;
}

function metaTruthy(value: unknown): boolean {
  return value === true || value === "true" || value === 1;
}

export function onboardingCompleteStorageKey(userId: string): string {
  return `${ONBOARDING_COMPLETE_KEY}_${userId}`;
}

export function onboardingPendingStorageKey(userId: string): string {
  return `${ONBOARDING_PENDING_KEY}_${userId}`;
}

export function onboardingPendingLocalStorageKey(userId: string): string {
  return `${ONBOARDING_PENDING_LOCAL_KEY}_${userId}`;
}

/** Per-user local completion (avoids blocking new accounts on a shared browser). */
export function hasCompletedOnboardingForUser(userId: string | null | undefined): boolean {
  if (!userId || typeof window === "undefined") return false;
  try {
    return localStorage.getItem(onboardingCompleteStorageKey(userId)) === "1";
  } catch {
    return false;
  }
}

/** @deprecated Use `hasCompletedOnboardingForUser(userId)`. */
export function hasCompletedOnboarding(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(ONBOARDING_COMPLETE_LEGACY_KEY) === "1";
  } catch {
    return false;
  }
}

export function markOnboardingPending(userId?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(ONBOARDING_PENDING_KEY, "1");
    localStorage.setItem(ONBOARDING_PENDING_LOCAL_KEY, "1");
    if (userId) {
      sessionStorage.setItem(onboardingPendingStorageKey(userId), "1");
      localStorage.setItem(onboardingPendingLocalStorageKey(userId), "1");
    }
  } catch {
    /* ignore */
  }
}

export function isOnboardingPending(userId?: string | null): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (userId) {
      if (sessionStorage.getItem(onboardingPendingStorageKey(userId)) === "1") return true;
      if (localStorage.getItem(onboardingPendingLocalStorageKey(userId)) === "1") return true;
    }
    if (sessionStorage.getItem(ONBOARDING_PENDING_KEY) === "1") return true;
    return localStorage.getItem(ONBOARDING_PENDING_LOCAL_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearOnboardingPendingFlags(userId?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(ONBOARDING_PENDING_KEY);
    localStorage.removeItem(ONBOARDING_PENDING_LOCAL_KEY);
    if (userId) {
      sessionStorage.removeItem(onboardingPendingStorageKey(userId));
      localStorage.removeItem(onboardingPendingLocalStorageKey(userId));
    }
  } catch {
    /* ignore */
  }
}

/** Server + client: should this user see welcome onboarding? */
export function userNeedsOnboarding(user: User | null): boolean {
  if (!user) return false;

  const meta = userMetadata(user);
  if (metaTruthy(meta[ONBOARDING_META_COMPLETE])) return false;
  if (metaTruthy(meta[ONBOARDING_META_PENDING])) return true;

  const createdAt = new Date(user.created_at).getTime();
  if (!Number.isNaN(createdAt) && Date.now() - createdAt < NEW_ACCOUNT_WINDOW_MS) {
    return true;
  }

  return false;
}

/** True when this auth exchange is a fresh signup (email confirm, OAuth, etc.). */
export function shouldMarkOnboardingAfterAuth(user: User | null, authType: string | null | undefined): boolean {
  if (!user) return false;

  const meta = userMetadata(user);
  if (metaTruthy(meta[ONBOARDING_META_COMPLETE])) return false;

  if (authType === "signup" || authType === "invite") return true;
  if (metaTruthy(meta[ONBOARDING_META_PENDING])) return true;

  const createdAt = new Date(user.created_at).getTime();
  if (Number.isNaN(createdAt)) return false;
  return Date.now() - createdAt < NEW_ACCOUNT_WINDOW_MS;
}

export function shouldShowWelcomeOnboarding(user?: User | null): boolean {
  if (user && hasCompletedOnboardingForUser(user.id)) return false;
  if (!user && hasCompletedOnboarding()) return false;
  if (isOnboardingPending(user?.id)) return true;
  if (user) return userNeedsOnboarding(user);
  return false;
}

export async function persistOnboardingPendingOnUser(supabase: SupabaseClient): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    markOnboardingPending(user?.id);
    if (!user || metaTruthy(userMetadata(user)[ONBOARDING_META_COMPLETE])) return;
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
  let userId: string | undefined;
  if (supabase) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      userId = user?.id;
    } catch {
      /* ignore */
    }
  }

  if (typeof window !== "undefined") {
    try {
      if (userId) {
        localStorage.setItem(onboardingCompleteStorageKey(userId), "1");
      }
      localStorage.removeItem(ONBOARDING_COMPLETE_LEGACY_KEY);
    } catch {
      /* ignore */
    }
    clearOnboardingPendingFlags(userId);
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

const SESSION_RETRY_MS = [0, 50, 150, 350, 700, 1200, 2000];

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
    }, 6000);

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        window.clearTimeout(timeout);
        subscription.unsubscribe();
        finish(session.user);
      }
    });
  });
}

export const ONBOARDING_AUTH_READY_EVENT = "finsepa-auth-established";
