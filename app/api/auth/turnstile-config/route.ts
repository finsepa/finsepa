import { NextResponse } from "next/server";

/** Runtime Turnstile site key (server reads .env.local even when the client bundle missed it). */
export async function GET() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
  const localOverride = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY_LOCAL?.trim() ?? "";
  return NextResponse.json({
    siteKey: localOverride || siteKey,
    enabled: Boolean(localOverride || siteKey),
    keySuffix: (localOverride || siteKey).slice(-6) || null,
  });
}
