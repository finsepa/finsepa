import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { DetectedEarningsRelease } from "@/lib/notifications/earnings-release-detect";
import type { TickerInterestMap } from "@/lib/notifications/earnings-notify-universe";
import type { UserNotificationRow } from "@/lib/notifications/earnings-notify-types";
import { loadEarningsNotificationsDisabledUserIds } from "@/lib/notifications/notification-preferences-store";

export async function insertEarningsReleaseNotifications(
  admin: SupabaseClient,
  interest: TickerInterestMap,
  releases: readonly DetectedEarningsRelease[],
): Promise<number> {
  if (releases.length === 0) return 0;

  const disabledUserIds = await loadEarningsNotificationsDisabledUserIds(admin);

  const rows: {
    user_id: string;
    kind: string;
    ticker: string;
    title: string;
    body: string;
    href: string;
    payload: Record<string, unknown>;
    dedupe_key: string;
  }[] = [];

  for (const release of releases) {
    const users = interest.get(release.row.ticker);
    if (!users || users.size === 0) continue;
    for (const userId of users) {
      if (disabledUserIds.has(userId)) continue;
      rows.push({
        user_id: userId,
        kind: "earnings_released",
        ticker: release.row.ticker,
        title: release.title,
        body: release.body,
        href: release.href,
        payload: release.payload,
        dedupe_key: release.dedupeKey,
      });
    }
  }

  if (rows.length === 0) return 0;

  const { data, error } = await admin
    .from("user_notifications")
    .upsert(rows, { onConflict: "user_id,kind,dedupe_key", ignoreDuplicates: true })
    .select("id");

  if (error) throw new Error(`user_notifications_insert_failed: ${error.message}`);
  return data?.length ?? 0;
}

export async function listUserNotifications(
  supabase: SupabaseClient,
  userId: string,
  limit = 40,
): Promise<UserNotificationRow[]> {
  const { data, error } = await supabase
    .from("user_notifications")
    .select("id,user_id,kind,ticker,title,body,href,payload,dedupe_key,read_at,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as UserNotificationRow[];
}

export async function countUnreadNotifications(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("user_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function markNotificationRead(
  supabase: SupabaseClient,
  userId: string,
  notificationId: string,
): Promise<void> {
  const { error } = await supabase
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) throw new Error(error.message);
}

export async function deleteAllNotifications(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await supabase.from("user_notifications").delete().eq("user_id", userId);

  if (error) throw new Error(error.message);
}
