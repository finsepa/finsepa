/** Public Turnstile site key (browser). Secret stays server-only. */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

export const TURNSTILE_ENABLED = Boolean(TURNSTILE_SITE_KEY);
