import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { filterUserIdsWithActivityAlerts } from "@/lib/account/activity-alerts-entitlement";
import { resolveAuthAppOriginForServer } from "@/lib/auth/app-origin";
import { listDevicePushTokensForUsers } from "@/lib/notifications/device-push-tokens-store";
import { sendEarningsApnsToDevices } from "@/lib/notifications/apns-push";
import { loadSuperinvestorActivityDisabledUserIds } from "@/lib/notifications/notification-preferences-store";
import {
  SUPERINVESTOR_ACTIVITY_KIND,
  formatSuperinvestorPushCopy,
  formatSuperinvestorQuarterLabel,
} from "@/lib/notifications/superinvestor-activity-model";
import type { Superinvestor13fProfilePageData } from "@/lib/superinvestors/types";
import { SUPERINVESTOR_REGISTRY } from "@/lib/superinvestors/superinvestor-registry";

export type SuperinvestorActivityNotifyInput = {
  slug: string;
  page: Superinvestor13fProfilePageData;
  /** Prior durable accession — notify only when this differs from the new filing. */
  priorAccession: string | null;
};

export type SuperinvestorActivityNotifyResult = {
  notified: boolean;
  reason?: string;
  activityCount: number;
  notificationsCreated: number;
};

function absoluteAssetUrl(path: string): string | undefined {
  const trimmed = path.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const origin = resolveAuthAppOriginForServer("") || "https://app.finsepa.com";
  if (trimmed.startsWith("/")) return `${origin.replace(/\/$/, "")}${trimmed}`;
  return `${origin.replace(/\/$/, "")}/${trimmed}`;
}

async function listFollowerUserIdsForSlug(
  admin: SupabaseClient,
  slug: string,
): Promise<string[]> {
  const profilePath = `/superinvestors/${slug}`;
  const { data, error } = await admin
    .from("superinvestor_follows")
    .select("user_id")
    .eq("profile_path", profilePath);

  if (error) throw new Error(`superinvestor_follows_lookup_failed: ${error.message}`);
  return [...new Set((data ?? []).map((row) => row.user_id as string).filter(Boolean))];
}

/**
 * After a 13F refresh, notify Pro/Trial followers when accession changed.
 * Skips first-ever snapshot (no prior accession) so we don't spam on initial ingest.
 */
export async function notifySuperinvestorActivityIfFilingChanged(
  admin: SupabaseClient,
  input: SuperinvestorActivityNotifyInput,
): Promise<SuperinvestorActivityNotifyResult> {
  const slug = input.slug.trim();
  const registry = SUPERINVESTOR_REGISTRY.find((item) => item.slug === slug);
  if (!registry) {
    return { notified: false, reason: "unknown_slug", activityCount: 0, notificationsCreated: 0 };
  }

  const newAccession = (input.page.comparison.current.accessionNumber ?? "").trim();
  if (!newAccession) {
    return { notified: false, reason: "missing_accession", activityCount: 0, notificationsCreated: 0 };
  }

  const prior = (input.priorAccession ?? "").trim();
  if (!prior) {
    return { notified: false, reason: "no_prior_snapshot", activityCount: 0, notificationsCreated: 0 };
  }
  if (prior === newAccession) {
    return { notified: false, reason: "same_accession", activityCount: 0, notificationsCreated: 0 };
  }

  const newestQuarter = input.page.transactions.quarters[0];
  const activityCount = newestQuarter?.transactions.length ?? 0;
  const quarterLabel = formatSuperinvestorQuarterLabel(
    newestQuarter?.quarterLabel ?? "",
  );
  const href = `/superinvestors/${encodeURIComponent(slug)}?tab=activity`;
  const { title, body } = formatSuperinvestorPushCopy({
    managerName: registry.managerName,
    quarterLabel: newestQuarter?.quarterLabel ?? quarterLabel,
    activityCount,
  });
  const avatarSrc = registry.avatarSrc;
  const logoUrl = absoluteAssetUrl(avatarSrc);
  const dedupeKey = `${slug}:${newAccession}`;
  const payload = {
    slug,
    managerName: registry.managerName,
    avatarSrc,
    logoUrl,
    quarterLabel,
    activityCount,
    accession: newAccession,
    filingDate: input.page.comparison.current.filingDate ?? null,
    href,
  };

  const followerIds = await listFollowerUserIdsForSlug(admin, slug);
  if (followerIds.length === 0) {
    return { notified: false, reason: "no_followers", activityCount, notificationsCreated: 0 };
  }

  const [disabledUserIds, eligibleUserIds] = await Promise.all([
    loadSuperinvestorActivityDisabledUserIds(admin),
    filterUserIdsWithActivityAlerts(admin, followerIds),
  ]);

  const rows = followerIds
    .filter((userId) => !disabledUserIds.has(userId) && eligibleUserIds.has(userId))
    .map((userId) => ({
      user_id: userId,
      kind: SUPERINVESTOR_ACTIVITY_KIND,
      ticker: slug,
      title,
      body,
      href,
      payload,
      dedupe_key: dedupeKey,
    }));

  if (rows.length === 0) {
    return {
      notified: false,
      reason: "no_eligible_followers",
      activityCount,
      notificationsCreated: 0,
    };
  }

  const { data, error } = await admin
    .from("user_notifications")
    .upsert(rows, { onConflict: "user_id,kind,dedupe_key", ignoreDuplicates: true })
    .select("id,user_id,ticker,title,body,kind,payload");

  if (error) throw new Error(`user_notifications_insert_failed: ${error.message}`);

  const inserted = (data ?? []) as {
    id: string;
    user_id: string;
    ticker: string;
    title: string;
    body: string;
    kind: string;
    payload: Record<string, unknown> | null;
  }[];

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
          const pushLogo =
            typeof row.payload?.logoUrl === "string" && row.payload.logoUrl.trim()
              ? row.payload.logoUrl.trim()
              : logoUrl;
          await sendEarningsApnsToDevices(admin, userDevices, {
            title: row.title,
            body: row.body,
            ticker: row.ticker,
            kind: row.kind,
            notificationId: row.id,
            logoUrl: pushLogo,
          });
        }),
      );
    }
  }

  return {
    notified: inserted.length > 0,
    activityCount,
    notificationsCreated: inserted.length,
  };
}
