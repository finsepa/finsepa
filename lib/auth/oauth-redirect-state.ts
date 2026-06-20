import { PATH_APP_ENTRY } from "@/lib/auth/routes";

const STORAGE_NEXT = "finsepa_oauth_next";
const STORAGE_INTENT = "finsepa_oauth_intent";

export function persistOAuthRedirectState(options?: {
  next?: string;
  intent?: "signup" | "login";
}): void {
  if (typeof window === "undefined") return;
  try {
    const next = options?.next ?? PATH_APP_ENTRY;
    localStorage.setItem(STORAGE_NEXT, next);
    if (options?.intent === "signup") {
      localStorage.setItem(STORAGE_INTENT, "signup");
    } else {
      localStorage.removeItem(STORAGE_INTENT);
    }
  } catch {
    /* ignore */
  }
}

export function consumeOAuthRedirectState(): { next: string; intent: "signup" | "login" | null } {
  if (typeof window === "undefined") {
    return { next: PATH_APP_ENTRY, intent: null };
  }
  try {
    const next = localStorage.getItem(STORAGE_NEXT) || PATH_APP_ENTRY;
    const intent = localStorage.getItem(STORAGE_INTENT) === "signup" ? "signup" : null;
    localStorage.removeItem(STORAGE_NEXT);
    localStorage.removeItem(STORAGE_INTENT);
    return { next, intent };
  } catch {
    return { next: PATH_APP_ENTRY, intent: null };
  }
}
