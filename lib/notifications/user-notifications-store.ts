import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { DetectedEarningsRelease } from "@/lib/notifications/earnings-release-detect";
import type { TickerInterestMap } from "@/lib/notifications/earnings-notify-universe";
import type { UserNotificationRow } from "@/lib/notifications/earnings-notify-types";
import { filterUserIdsWithActivityAlerts } from "@/lib/account/activity-alerts-entitlement";
import { loadEarningsNotificationsDisabledUserIds } from "@/lib/notifications/notification-preferences-store";
import { listDevicePushTokensForUsers } from "@/lib/notifications/device-push-tokens-store";
import { sendEarningsApnsToDevices } from "@/lib/notifications/apns-push";

export async function insertEarningsReleaseNotifications(
  admin: SupabaseClient,
  interest: TickerInterestMap,
  releases: readonly DetectedEarningsRelease[],
): Promise<number> {
  if (releases.length === 0) return 0;

  const interestedUserIds = new Set<string>();
  for (const users of interest.values()) {
    for (const userId of users) interestedUserIds.add(userId);
  }

  const [disabledUserIds, eligibleUserIds] = await Promise.all([
    loadEarningsNotificationsDisabledUserIds(admin),
    filterUserIdsWithActivityAlerts(admin, [...interestedUserIds]),
  ]);

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
      // UI toggle opted out.
      if (disabledUserIds.has(userId)) continue;
      // Free plan: no new activity alerts (prefs may still be "on" in DB after downgrade).
      if (!eligibleUserIds.has(userId)) continue;
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
    .select("id,user_id,ticker,title,body,kind");

  if (error) throw new Error(`user_notifications_insert_failed: ${error.message}`);

  const inserted = (data ?? []) as {
    id: string;
    user_id: string;
    ticker: string;
    title: string;
    body: string;
    kind: string;
  }[];

  // Push only newly inserted rows (ignoreDuplicates means updates aren't returned).
  if (inserted.length > 0) {
    const userIds = [...new Set(inserted.map((row) => row.user_id))];
    const devices = await listDevicePushTokensForUsers(admin, userIds);
    if (devices.length > 0) {
      const devicesByUser = new Map<string, typeof devices>();
      for (const device of devices) {
        const list = devicesByUser.get(device.user_id) ?? [];
        list.push(device);
        devicesByUser.set(device.user_id, list);
      }
      await Promise.all(
        inserted.map(async (row) => {
          const userDevices = devicesByUser.get(row.user_id) ?? [];
          if (userDevices.length === 0) return;
          await sendEarningsApnsToDevices(admin, userDevices, {
            title: row.title,
            body: row.body,
            ticker: row.ticker,
            kind: row.kind,
            notificationId: row.id,
          });
        }),
      );
    }
  }

  return inserted.length;
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

export async function deleteNotification(
  supabase: SupabaseClient,
  userId: string,
  notificationId: string,
): Promise<void> {
  const { error } = await supabase
    .from("user_notifications")
    .delete()
    .eq("id", notificationId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}
