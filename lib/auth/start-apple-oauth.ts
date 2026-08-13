"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

import { startSocialOAuth } from "@/lib/auth/start-social-oauth";

/**
 * Starts Apple OAuth in the browser (Services ID + Supabase Apple provider).
 * redirectTo must be an exact Supabase allow-listed URL (no query string).
 */
export async function startAppleOAuth(
  supabase: SupabaseClient,
  options?: { next?: string; intent?: "signup" | "login" },
): Promise<void> {
  return startSocialOAuth(supabase, "apple", options);
}
