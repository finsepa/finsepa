import type { User } from "@supabase/supabase-js";

function metaString(meta: Record<string, unknown>, key: string): string | null {
  const v = meta[key];
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t || null;
}

/** First name for emails and UI — metadata, Google fields, then email local-part. */
export function displayFirstNameFromUser(user: User | null | undefined, email: string): string {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const fromMeta =
    metaString(meta, "first_name") ??
    metaString(meta, "given_name") ??
    (() => {
      const full = metaString(meta, "full_name") ?? metaString(meta, "name");
      if (!full) return null;
      return full.split(/\s+/)[0] ?? full;
    })();
  if (fromMeta) return fromMeta.slice(0, 80);

  const local = email.split("@")[0]?.trim() || "there";
  return local.slice(0, 80) || "there";
}
