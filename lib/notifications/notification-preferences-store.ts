import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationPreferences = {
  earningsResultsEnabled: boolean;
};

const DEFAULT_PREFERENCES: NotificationPreferences = {
  earningsResultsEnabled: true,
};

export async function getNotificationPreferences(
  supabase: SupabaseClient,
  userId: string,
): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from("user_notification_preferences")
    .select("earnings_results_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return DEFAULT_PREFERENCES;

  return {
    earningsResultsEnabled: data.earnings_results_enabled !== false,
  };
}

export async function setEarningsResultsEnabled(
  supabase: SupabaseClient,
  userId: string,
  enabled: boolean,
): Promise<NotificationPreferences> {
  const { error } = await supabase.from("user_notification_preferences").upsert(
    {
      user_id: userId,
      earnings_results_enabled: enabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) throw new Error(error.message);
  return { earningsResultsEnabled: enabled };
}

/** Users who opted out of earnings release notifications (cron / service role). */
export async function loadEarningsNotificationsDisabledUserIds(
  admin: SupabaseClient,
): Promise<Set<string>> {
  const { data, error } = await admin
    .from("user_notification_preferences")
    .select("user_id")
    .eq("earnings_results_enabled", false);

  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => row.user_id as string));
}
