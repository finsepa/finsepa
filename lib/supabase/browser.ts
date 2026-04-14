import { createBrowserClient } from "@supabase/ssr";

let injected: { url: string; anonKey: string } | null = null;

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

export function getSupabaseBrowserClient() {
  const url = injected?.url || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = injected?.anonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured (missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY). Add them in Vercel → Project → Environment Variables, then redeploy.",
    );
  }
  return createBrowserClient(url, key);
}
