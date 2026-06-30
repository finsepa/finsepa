import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let injected: { url: string; anonKey: string } | null = null;

let browserClient: SupabaseClient | null = null;
let browserClientCacheKey: string | null = null;

/**
 * Server layout passes env here so the client can auth even when `NEXT_PUBLIC_*` were not
 * embedded at build time (Vercel still exposes them to the Node server at runtime).
 */
export function setSupabaseBrowserEnv(
  url: string | null | undefined,
  anonKey: string | null | undefined,
): void {
  const u = typeof url === "string" ? url.trim() : "";
  const k = typeof anonKey === "string" ? anonKey.trim() : "";
  injected = u && k ? { url: u, anonKey: k } : null;
}

function resolveSupabaseBrowserEnv(): { url: string; key: string } {
  const url = injected?.url || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    injected?.anonKey ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured (missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY). Local: copy `.env.example` to `.env.local` and add your Supabase URL + anon key from the Supabase dashboard, then restart `npm run dev`. Production: set the same vars in Vercel → Environment Variables and redeploy.",
    );
  }
  return { url, key };
}

/** Prevent Supabase token refresh / auth `fetch` failures from surfacing as Next.js runtime overlays. */
async function supabaseSafeFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    return new Response(JSON.stringify({ message: "Network Error" }), {
      status: 503,
      statusText: "Network Error",
      headers: { "Content-Type": "application/json" },
    });
  }
}

export function getSupabaseBrowserClient(): SupabaseClient {
  const { url, key } = resolveSupabaseBrowserEnv();
  const cacheKey = `${url}\0${key}`;
  if (browserClient && browserClientCacheKey === cacheKey) {
    return browserClient;
  }

  browserClient = createBrowserClient(url, key, {
    auth: {
      detectSessionInUrl: false,
    },
    global: {
      fetch: supabaseSafeFetch,
    },
  });
  browserClientCacheKey = cacheKey;
  return browserClient;
}
