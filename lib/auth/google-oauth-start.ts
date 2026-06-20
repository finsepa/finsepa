import { PATH_APP_ENTRY } from "@/lib/auth/routes";

export const PATH_GOOGLE_OAUTH_START = "/api/auth/google";

/** Full-page navigation to server-owned Google OAuth (PKCE verifier stored in cookies). */
export function googleOAuthStartUrl(options?: {
  next?: string;
  intent?: "signup" | "login";
}): string {
  const params = new URLSearchParams();
  params.set("next", options?.next ?? PATH_APP_ENTRY);
  if (options?.intent === "signup") params.set("intent", "signup");
  return `${PATH_GOOGLE_OAUTH_START}?${params.toString()}`;
}
