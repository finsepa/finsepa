import "server-only";

import type { User } from "@supabase/supabase-js";

import { displayFirstNameFromUser } from "@/lib/auth/display-name";
import { resolveAuthAppOriginForServer } from "@/lib/auth/app-origin";
import { PATH_APP_ENTRY } from "@/lib/auth/routes";
import {
  GOOGLE_WELCOME_EMAIL_SENT_META,
  WELCOME_TRIAL_START_SENT_META,
  shouldSendWelcomeTrialStartEmail,
  welcomeTrialStartAlreadySent,
} from "@/lib/auth/welcome-trial-start-email";
import {
  effectivePlatformTrialEndsAtIso,
  PLATFORM_TRIAL_DAYS,
  platformTrialDaysRemaining,
} from "@/lib/account/platform-trial";
import { getLoopsApiKey } from "@/lib/env/loops";
import {
  formatTrialEndsAtForEmail,
  LOOPS_TRIAL_PRO_INFO_LINE,
} from "@/lib/loops/trial-email-variables";
import { sendLoopsWelcomeTrialStartEmail } from "@/lib/loops/send-welcome-trial-start";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type WelcomeTrialStartSendResult =
  | { sent: true }
  | {
      sent: false;
      reason:
        | "not_applicable"
        | "already_sent"
        | "loops_not_configured"
        | "admin_unavailable"
        | "send_failed";
      message?: string;
    };

export async function sendWelcomeTrialStartEmailIfNeeded(
  user: User,
  requestOrigin = "",
): Promise<WelcomeTrialStartSendResult> {
  if (!shouldSendWelcomeTrialStartEmail(user)) {
    return {
      sent: false,
      reason: welcomeTrialStartAlreadySent(user) ? "already_sent" : "not_applicable",
    };
  }

  const loopsKey = getLoopsApiKey();
  if (!loopsKey) {
    return { sent: false, reason: "loops_not_configured" };
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return { sent: false, reason: "admin_unavailable" };
  }

  const email = user.email!.trim().toLowerCase();
  const origin = resolveAuthAppOriginForServer(requestOrigin) || requestOrigin.replace(/\/$/, "");
  const platformLink = `${origin}${PATH_APP_ENTRY}`;

  let trialEndsIso: string | null = null;
  const { data: billing } = await admin
    .from("billing_subscriptions")
    .select("platform_trial_ends_at, plan_code, status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (billing) {
    trialEndsIso = effectivePlatformTrialEndsAtIso(billing);
  }
  if (!trialEndsIso) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + PLATFORM_TRIAL_DAYS);
    trialEndsIso = d.toISOString();
  }

  const daysLeft = platformTrialDaysRemaining(trialEndsIso) ?? PLATFORM_TRIAL_DAYS;
  const trialEndsAt = formatTrialEndsAtForEmail(trialEndsIso);
  const firstName = displayFirstNameFromUser(user, email);
  const proInfoLine = LOOPS_TRIAL_PRO_INFO_LINE;

  const sendResult = await sendLoopsWelcomeTrialStartEmail({
    apiKey: loopsKey,
    to: email,
    firstName,
    platformLink,
    trialDays: daysLeft,
    trialEndsAt,
    proInfoLine,
  });

  if (!sendResult.ok) {
    return { sent: false, reason: "send_failed", message: sendResult.message };
  }

  const sentAt = new Date().toISOString();
  const existingMeta = (user.user_metadata ?? {}) as Record<string, unknown>;
  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...existingMeta,
      [WELCOME_TRIAL_START_SENT_META]: sentAt,
      [GOOGLE_WELCOME_EMAIL_SENT_META]: sentAt,
    },
  });

  return { sent: true };
}

/** @deprecated Use {@link sendWelcomeTrialStartEmailIfNeeded}. */
export const sendGoogleWelcomeEmailIfNeeded = sendWelcomeTrialStartEmailIfNeeded;

/** @deprecated Use {@link WelcomeTrialStartSendResult}. */
export type GoogleWelcomeSendResult = WelcomeTrialStartSendResult;
