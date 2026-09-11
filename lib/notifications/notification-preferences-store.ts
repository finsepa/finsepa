import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationPreferences = {
  earningsResultsEnabled: boolean;
  superinvestorActivityEnabled: boolean;
  slidesEnabled: boolean;
  reportsEnabled: boolean;
};

const DEFAULT_PREFERENCES: NotificationPreferences = {
  earningsResultsEnabled: true,
  superinvestorActivityEnabled: true,
  slidesEnabled: true,
  reportsEnabled: true,
};

type PrefRow = {
  earnings_results_enabled?: boolean | null;
  superinvestor_activity_enabled?: boolean | null;
  slides_enabled?: boolean | null;
  reports_enabled?: boolean | null;
};

function preferencesFromRow(data: PrefRow | null): NotificationPreferences {
  if (!data) return DEFAULT_PREFERENCES;
  return {
    earningsResultsEnabled: data.earnings_results_enabled !== false,
    superinvestorActivityEnabled: data.superinvestor_activity_enabled !== false,
    slidesEnabled: data.slides_enabled !== false,
    reportsEnabled: data.reports_enabled !== false,
  };
}

export async function getNotificationPreferences(
  supabase: SupabaseClient,
  userId: string,
): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from("user_notification_preferences")
    .select(
      "earnings_results_enabled, superinvestor_activity_enabled, slides_enabled, reports_enabled",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return preferencesFromRow(data);
}

async function upsertPreferences(
  supabase: SupabaseClient,
  userId: string,
  next: NotificationPreferences,
): Promise<NotificationPreferences> {
  const { error } = await supabase.from("user_notification_preferences").upsert(
    {
      user_id: userId,
      earnings_results_enabled: next.earningsResultsEnabled,
      superinvestor_activity_enabled: next.superinvestorActivityEnabled,
      slides_enabled: next.slidesEnabled,
      reports_enabled: next.reportsEnabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
  return next;
}

export async function setEarningsResultsEnabled(
  supabase: SupabaseClient,
  userId: string,
  enabled: boolean,
): Promise<NotificationPreferences> {
  const current = await getNotificationPreferences(supabase, userId);
  return upsertPreferences(supabase, userId, { ...current, earningsResultsEnabled: enabled });
}

export async function setSuperinvestorActivityEnabled(
  supabase: SupabaseClient,
  userId: string,
  enabled: boolean,
): Promise<NotificationPreferences> {
  const current = await getNotificationPreferences(supabase, userId);
  return upsertPreferences(supabase, userId, {
    ...current,
    superinvestorActivityEnabled: enabled,
  });
}

export async function setSlidesEnabled(
  supabase: SupabaseClient,
  userId: string,
  enabled: boolean,
): Promise<NotificationPreferences> {
  const current = await getNotificationPreferences(supabase, userId);
  return upsertPreferences(supabase, userId, { ...current, slidesEnabled: enabled });
}

export async function setReportsEnabled(
  supabase: SupabaseClient,
  userId: string,
  enabled: boolean,
): Promise<NotificationPreferences> {
  const current = await getNotificationPreferences(supabase, userId);
  return upsertPreferences(supabase, userId, { ...current, reportsEnabled: enabled });
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

export async function loadSlidesNotificationsDisabledUserIds(
  admin: SupabaseClient,
): Promise<Set<string>> {
  const { data, error } = await admin
    .from("user_notification_preferences")
    .select("user_id")
    .eq("slides_enabled", false);

  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => row.user_id as string));
}

export async function loadReportsNotificationsDisabledUserIds(
  admin: SupabaseClient,
): Promise<Set<string>> {
  const { data, error } = await admin
    .from("user_notification_preferences")
    .select("user_id")
    .eq("reports_enabled", false);

  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => row.user_id as string));
}
