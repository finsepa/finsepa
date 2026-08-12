import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type DevicePushTokenRow = {
  id: string;
  user_id: string;
  token: string;
  platform: "ios" | "android";
  environment: "sandbox" | "production";
  updated_at: string;
};

export async function upsertDevicePushToken(
  supabase: SupabaseClient,
  args: {
    userId: string;
    token: string;
    platform: "ios" | "android";
    environment: "sandbox" | "production";
  },
): Promise<void> {
  const { error } = await supabase.from("device_push_tokens").upsert(
    {
      user_id: args.userId,
      token: args.token,
      platform: args.platform,
      environment: args.environment,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,token" },
  );
  if (error) throw new Error(`device_push_token_upsert_failed: ${error.message}`);
}

export async function deleteDevicePushToken(
  supabase: SupabaseClient,
  args: { userId: string; token: string },
): Promise<void> {
  const { error } = await supabase
    .from("device_push_tokens")
    .delete()
    .eq("user_id", args.userId)
    .eq("token", args.token);
  if (error) throw new Error(`device_push_token_delete_failed: ${error.message}`);
}

export async function listDevicePushTokensForUsers(
  admin: SupabaseClient,
  userIds: readonly string[],
): Promise<DevicePushTokenRow[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await admin
    .from("device_push_tokens")
    .select("id,user_id,token,platform,environment,updated_at")
    .in("user_id", [...userIds]);
  if (error) throw new Error(`device_push_token_list_failed: ${error.message}`);
  return (data ?? []) as DevicePushTokenRow[];
}

export async function deleteDevicePushTokensByToken(
  admin: SupabaseClient,
  token: string,
): Promise<void> {
  const { error } = await admin.from("device_push_tokens").delete().eq("token", token);
  if (error) throw new Error(`device_push_token_purge_failed: ${error.message}`);
}
