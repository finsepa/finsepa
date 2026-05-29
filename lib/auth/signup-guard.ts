import "server-only";

import { pickProcessEnv } from "@/lib/env/pick-process-env";

/** Emergency stop — set `AUTH_SIGNUP_DISABLED=1` in Vercel until attack subsides. */
export function isSignupDisabled(): boolean {
  const v = pickProcessEnv("AUTH" + "_" + "SIGNUP" + "_" + "DISABLED");
  return v === "1" || v?.toLowerCase() === "true";
}

/** When set (or when Turnstile secret is set), client must not fall back to direct `supabase.auth.signUp`. */
export function isSignupLoopsApiOnly(): boolean {
  const v = pickProcessEnv("AUTH" + "_" + "SIGNUP" + "_" + "LOOPS" + "_" + "API" + "_" + "ONLY");
  if (v === "1" || v?.toLowerCase() === "true") return true;
  return Boolean(getTurnstileSecretKey());
}

export function getTurnstileSecretKey(): string | undefined {
  const v = pickProcessEnv("TURNSTILE" + "_" + "SECRET" + "_" + "KEY");
  return v || undefined;
}

export function clientIpFromRequest(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;
  return "unknown";
}

const SPAM_NAME_RE =
  /anında|kazan|5000\s*tl|bahis|casino|bet\s*now|free\s*money|✨|💰|🎰|telegram\.me|t\.me\//iu;

const EMOJI_HEAVY_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

/** Returns a machine error code when the signup looks like automated spam. */
export function detectSignupSpam(fields: {
  firstName: string;
  lastName: string;
  email: string;
}): string | null {
  const first = fields.firstName.trim();
  const last = fields.lastName.trim();
  const email = fields.email.trim().toLowerCase();
  const combined = `${first} ${last} ${email}`;

  if (SPAM_NAME_RE.test(combined)) return "blocked_content";
  if (EMOJI_HEAVY_RE.test(`${first}${last}`)) return "blocked_content";

  // Bot pattern from attack: numeric-heavy display names + disposable-looking mail.com/gmail combos.
  const local = email.split("@")[0] ?? "";
  if (/^\d{6,}/.test(local) && /@(mail\.com|gmail\.com)$/i.test(email)) return "blocked_content";
  if (/^[\d._-]+@mail\.com$/i.test(email)) return "blocked_content";

  if (first.length > 48 || last.length > 48) return "invalid_name";

  return null;
}

export async function verifyTurnstileToken(
  token: string | undefined,
  remoteIp: string,
): Promise<{ ok: true } | { ok: false; reason: "missing" | "invalid" | "not_configured" }> {
  const secret = getTurnstileSecretKey();
  if (!secret) {
    return { ok: false, reason: "not_configured" };
  }
  const trimmed = token?.trim();
  if (!trimmed) return { ok: false, reason: "missing" };

  try {
    const body = new URLSearchParams({
      secret,
      response: trimmed,
      remoteip: remoteIp !== "unknown" ? remoteIp : "",
    });
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
    const json = (await res.json()) as { success?: boolean };
    return json.success === true ? { ok: true } : { ok: false, reason: "invalid" };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}
