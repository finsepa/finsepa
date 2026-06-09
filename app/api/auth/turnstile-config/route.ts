import { NextResponse } from "next/server";

import { CACHE_CONTROL_PRIVATE_NO_STORE } from "@/lib/data/cache-policy";

/** Runtime Turnstile site key (server reads env at request time for local dev + prod). */
export async function GET() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
  const localOverride = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY_LOCAL?.trim() ?? "";
  const resolved = localOverride || siteKey;
  return NextResponse.json(
    {
      siteKey: resolved,
      enabled: Boolean(resolved),
      keySuffix: resolved.slice(-6) || null,
    },
    { headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_NO_STORE } },
  );
}
