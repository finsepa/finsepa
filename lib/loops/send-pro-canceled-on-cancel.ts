import "server-only";

import type Stripe from "stripe";

import {
  claimProCancelEmailSend,
  clearProCancelEmailClaim,
  resolveUserEmailById,
} from "@/lib/account/billing-db";
import { resolveAuthAppOriginForServer } from "@/lib/auth/app-origin";
import { displayFirstNameFromUser } from "@/lib/auth/display-name";
import { getLoopsApiKey } from "@/lib/env/loops";
import { sendLoopsProCanceledEmail } from "@/lib/loops/send-pro-canceled";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

function periodEndSeconds(subscription: Stripe.Subscription): number | null {
  const end = (subscription as unknown as { current_period_end?: unknown }).current_period_end;
  if (typeof end === "number" && Number.isFinite(end)) return end;
  const cancelAt = (subscription as unknown as { cancel_at?: unknown }).cancel_at;
  if (typeof cancelAt === "number" && Number.isFinite(cancelAt)) return cancelAt;
  return null;
}

/** e.g. "Sep 5, 2026" */
export function formatProAccessEndsAtForEmail(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Whole days remaining until period end (at least 1 when end is still in the future). */
export function proDaysRemainingLabel(epochSeconds: number, nowMs = Date.now()): string | null {
  const msLeft = epochSeconds * 1000 - nowMs;
  if (msLeft <= 0) return null;
  const days = Math.max(1, Math.ceil(msLeft / 86_400_000));
  return days === 1 ? "1 day" : `${days} days`;
}

/**
 * True when this Stripe `customer.subscription.updated` event newly schedules cancel at period end.
 */
export function stripeSubscriptionCancelJustScheduled(
  subscription: Stripe.Subscription,
  previousAttributes: Partial<Stripe.Subscription> | undefined,
): boolean {
  if (!subscription.cancel_at_period_end) return false;
  if (subscription.status !== "active" && subscription.status !== "trialing") return false;
  if (!previousAttributes || !("cancel_at_period_end" in previousAttributes)) return false;
  return previousAttributes.cancel_at_period_end === false;
}

/**
 * Send Loops “Pro subscription canceled” when cancel-at-period-end is newly scheduled
 * and Pro access still has remaining days.
 */
export async function trySendLoopsProCanceledEmail(args: {
  userId: string;
  subscription: Stripe.Subscription;
}): Promise<void> {
  const loopsKey = getLoopsApiKey();
  if (!loopsKey) return;

  const endSec = periodEndSeconds(args.subscription);
  if (endSec == null) return;
  const daysRemaining = proDaysRemainingLabel(endSec);
  if (!daysRemaining) return;

  if (!(await claimProCancelEmailSend(args.userId))) return;

  const admin = getSupabaseAdminClient();
  const userRes = admin ? await admin.auth.admin.getUserById(args.userId) : null;
  const user = userRes?.data?.user ?? null;
  const to =
    (user?.email?.trim() || (await resolveUserEmailById(args.userId)) || "").trim() || null;
  if (!to) {
    await clearProCancelEmailClaim(args.userId);
    console.error("[billing] Pro cancel email skipped: no recipient for user", args.userId);
    return;
  }

  const firstName = displayFirstNameFromUser(user, to);
  const origin = resolveAuthAppOriginForServer("") || "https://app.finsepa.com";
  const billingLink = `${origin}/account?tab=billing`;
  const accessEndsAt = formatProAccessEndsAtForEmail(endSec);

  const sent = await sendLoopsProCanceledEmail({
    apiKey: loopsKey,
    to,
    firstName,
    daysRemaining,
    accessEndsAt,
    billingLink,
  });
  if (!sent.ok) {
    await clearProCancelEmailClaim(args.userId);
    console.error("[billing] Loops Pro cancel email failed:", sent.message);
  }
}
