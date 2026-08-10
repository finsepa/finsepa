"use client";

import type { ReactNode } from "react";

import { installSupabaseAuthConsoleErrorFilter } from "@/lib/auth/suppress-stale-auth-console-errors";
import { setSupabaseBrowserEnv } from "@/lib/supabase/browser";

/**
 * Injects Supabase URL + anon key from the server into the browser module before any client code
 * calls {@link getSupabaseBrowserClient}. Fixes production when `NEXT_PUBLIC_*` were not inlined
 * into the client bundle (e.g. env added after a build, or tooling edge cases) while still set on the server.
 */
export function SupabaseBrowserEnvProvider({
  url,
  anonKey,
  children,
}: {
  url: string | undefined;
  anonKey: string | undefined;
  children: ReactNode;
}) {
  if (typeof window !== "undefined") {
    installSupabaseAuthConsoleErrorFilter();
    setSupabaseBrowserEnv(url, anonKey);
  }
  return children;
}
