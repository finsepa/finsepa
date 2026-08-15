import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationPreferences = {
  earningsResultsEnabled: boolean;
  superinvestorActivityEnabled: boolean;
};

const DEFAULT_PREFERENCES: NotificationPreferences = {
  earningsResultsEnabled: true,
  superinvestorActivityEnabled: true,
};

export async function getNotificationPreferences(
  supabase: SupabaseClient,
  userId: string,
): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from("user_notification_preferences")
    .select("earnings_results_enabled, superinvestor_activity_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return DEFAULT_PREFERENCES;

  return {
    earningsResultsEnabled: data.earnings_results_enabled !== false,
    superinvestorActivityEnabled: data.superinvestor_activity_enabled !== false,
  };
}

export async function setEarningsResultsEnabled(
  supabase: SupabaseClient,
  userId: string,
  enabled: boolean,
): Promise<NotificationPreferences> {
  const current = await getNotificationPreferences(supabase, userId);
  const { error } = await supabase.from("user_notification_preferences").upsert(
    {
      user_id: userId,
      earnings_results_enabled: enabled,
      superinvestor_activity_enabled: current.superinvestorActivityEnabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) throw new Error(error.message);
  return { ...current, earningsResultsEnabled: enabled };
}

export async function setSuperinvestorActivityEnabled(
  supabase: SupabaseClient,
  userId: string,
  enabled: boolean,
): Promise<NotificationPreferences> {
  const current = await getNotificationPreferences(supabase, userId);
  const { error } = await supabase.from("user_notification_preferences").upsert(
    {
      user_id: userId,
      earnings_results_enabled: current.earningsResultsEnabled,
      superinvestor_activity_enabled: enabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) throw new Error(error.message);
  return { ...current, superinvestorActivityEnabled: enabled };
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

/** Users who opted out of superinvestor activity alerts (cron / service role). */
export async function loadSuperinvestorActivityDisabledUserIds(
  admin: SupabaseClient,
): Promise<Set<string>> {
  const { data, error } = await admin
    .from("user_notification_preferences")
    .select("user_id")
    .eq("superinvestor_activity_enabled", false);

  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => row.user_id as string));
}
