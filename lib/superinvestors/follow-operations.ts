import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeSuperinvestorFollowHref } from "@/lib/superinvestors/superinvestor-follow-storage";
import type { SuperinvestorFollowRow } from "@/lib/superinvestors/follow-types";

const TABLE = "superinvestor_follows";

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
