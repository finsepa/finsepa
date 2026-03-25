import type { User } from "@supabase/supabase-js";

export function displayNameFromUser(user: User): string | null {
  const m = user.user_metadata as Record<string, unknown> | undefined;
  if (!m) return null;
  const first = typeof m.first_name === "string" ? m.first_name.trim() : "";
  const last = typeof m.last_name === "string" ? m.last_name.trim() : "";
  const full = [first, last].filter(Boolean).join(" ");
  return full || null;
}

export function initialsFromUser(user: User): string {
  const name = displayNameFromUser(user);
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  const email = user.email?.trim();
  if (email) {
    const local = email.split("@")[0] ?? email;
    const alnum = local.replace(/[^a-zA-Z0-9]/g, "");
    if (alnum.length >= 2) return alnum.slice(0, 2).toUpperCase();
    if (alnum.length === 1) return `${alnum}${alnum}`.toUpperCase();
  }
  return "?";
}
