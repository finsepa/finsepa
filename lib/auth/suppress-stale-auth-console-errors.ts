import { isDefinitiveSessionInvalid } from "@/lib/auth/session-invalid";

let installed = false;

function looksLikeStaleAuthConsoleArg(value: unknown): boolean {
  if (isDefinitiveSessionInvalid(value)) return true;
  if (typeof value === "string") {
    const msg = value.toLowerCase();
    return (
      msg.includes("invalid refresh token") ||
      msg.includes("refresh token not found") ||
      msg.includes("refresh_token_not_found") ||
      msg.includes("session_not_found")
    );
  }
  return false;
}

/**
 * Supabase GoTrue calls `console.error(AuthApiError)` when a stored refresh token
 * is already gone (common after logout elsewhere / expired cookies). Next.js 16
 * promotes those to a full-screen overlay even though the client then clears the
 * session. Swallow only those expected stale-session logs.
 */
export function installSupabaseAuthConsoleErrorFilter(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    if (args.some(looksLikeStaleAuthConsoleArg)) return;
    original(...args);
  };
}
