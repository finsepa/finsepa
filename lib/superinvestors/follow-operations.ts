import type { SupabaseClient } from "@supabase/supabase-js";

import { defaultSuperinvestorFollowPaths } from "@/lib/superinvestors/default-superinvestor-follows";
import { normalizeSuperinvestorFollowHref } from "@/lib/superinvestors/superinvestor-follow-storage";
import type { SuperinvestorFollowRow } from "@/lib/superinvestors/follow-types";

const TABLE = "superinvestor_follows";

/** Same window as watchlist new-account reset — only auto-seed brand-new accounts. */
export const NEW_ACCOUNT_SUPERINVESTOR_FOLLOW_SEED_WINDOW_MS = 24 * 60 * 60 * 1000;

export class SuperinvestorFollowValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SuperinvestorFollowValidationError";
  }
}

/** Canonical profile path stored in `profile_path` (e.g. `/superinvestors/berkshire-hathaway`). */
export function normalizeSuperinvestorFollowPath(raw: string): string {
  const path = normalizeSuperinvestorFollowHref(raw);
  if (!path) {
    throw new SuperinvestorFollowValidationError("Profile path is required.");
  }
  if (!path.startsWith("/superinvestors/") || path === "/superinvestors") {
    throw new SuperinvestorFollowValidationError("Invalid superinvestor profile path.");
  }
  if (path.length > 128) {
    throw new SuperinvestorFollowValidationError("Profile path is too long.");
  }
  return path;
}

export function isWithinNewAccountFollowSeedWindow(createdAtIso: string | null | undefined): boolean {
  if (!createdAtIso) return false;
  const createdAt = new Date(createdAtIso).getTime();
  if (Number.isNaN(createdAt)) return false;
  return Date.now() - createdAt <= NEW_ACCOUNT_SUPERINVESTOR_FOLLOW_SEED_WINDOW_MS;
}

export async function listSuperinvestorFollowsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<SuperinvestorFollowRow[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("id,user_id,profile_path,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as SuperinvestorFollowRow[];
}

/**
 * For brand-new accounts with an empty Following list, seed Buffett + Terry Smith.
 * Does not re-seed older accounts that cleared their follows.
 */
export async function ensureDefaultSuperinvestorFollows(
  supabase: SupabaseClient,
  userId: string,
  userCreatedAt: string | null | undefined,
): Promise<SuperinvestorFollowRow[]> {
  const existing = await listSuperinvestorFollowsForUser(supabase, userId);
  if (existing.length > 0) return existing;
  if (!isWithinNewAccountFollowSeedWindow(userCreatedAt)) return existing;

  const paths = defaultSuperinvestorFollowPaths();
  const rows = paths.map((profile_path) => ({ user_id: userId, profile_path }));
  const { error } = await supabase.from(TABLE).upsert(rows, {
    onConflict: "user_id,profile_path",
    ignoreDuplicates: true,
  });
  if (error) throw new Error(error.message);

  return listSuperinvestorFollowsForUser(supabase, userId);
}

export async function addSuperinvestorFollow(
  supabase: SupabaseClient,
  userId: string,
  profilePath: string,
): Promise<{ row: SuperinvestorFollowRow; created: boolean }> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ user_id: userId, profile_path: profilePath })
    .select("id,user_id,profile_path,created_at")
    .single();

  if (!error && data) {
    return { row: data as SuperinvestorFollowRow, created: true };
  }

  if (error?.code === "23505") {
    const { data: existing, error: fetchError } = await supabase
      .from(TABLE)
      .select("id,user_id,profile_path,created_at")
      .eq("user_id", userId)
      .eq("profile_path", profilePath)
      .maybeSingle();

    if (fetchError) {
      throw new Error(fetchError.message);
    }
    if (!existing) {
      throw new Error("Duplicate follow but row not found.");
    }
    return { row: existing as SuperinvestorFollowRow, created: false };
  }

  throw new Error(error?.message ?? "Insert failed.");
}

export async function removeSuperinvestorFollow(
  supabase: SupabaseClient,
  userId: string,
  profilePath: string,
): Promise<{ removed: boolean }> {
  const { data: existing, error: selectError } = await supabase
    .from(TABLE)
    .select("id")
    .eq("user_id", userId)
    .eq("profile_path", profilePath)
    .maybeSingle();

  if (selectError) {
    throw new Error(selectError.message);
  }
  if (!existing) {
    return { removed: false };
  }

  const { data: deletedRows, error: deleteError } = await supabase
    .from(TABLE)
    .delete()
    .eq("id", existing.id)
    .select("id");

  if (deleteError) {
    throw new Error(deleteError.message);
  }
  return { removed: (deletedRows?.length ?? 0) > 0 };
}
