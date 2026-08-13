import "server-only";

import { AutoRenewStatus, type JWSRenewalInfoDecodedPayload, type JWSTransactionDecodedPayload } from "@apple/app-store-server-library";

import { hasActivePaidProSubscription } from "@/lib/account/billing-guard";
import { cancelOtherLiveSubscriptionsForUser } from "@/lib/account/billing-db";
import {
  appleAmountUsdForProductId,
  appleInvoiceDescription,
  applePlanCodeForProductId,
  isAppleProProductId,
} from "@/lib/apple/products";
import { getStripeClient } from "@/lib/stripe/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type AppleBillingApplyResult = {
  planCode: string;
  status: string;
  isPro: boolean;
};

function msToIso(ms: number | undefined): string | null {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function isAutoRenewOn(renewal: JWSRenewalInfoDecodedPayload | null): boolean {
  if (!renewal) return true;
  return renewal.autoRenewStatus === AutoRenewStatus.ON || renewal.autoRenewStatus === 1;
}

async function cancelLiveStripeForUser(userId: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  if (!admin) return;
  const { data } = await admin
    .from("billing_subscriptions")
    .select("stripe_account_key,stripe_subscription_id,stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle<{
      stripe_account_key: string | null;
      stripe_subscription_id: string | null;
      stripe_customer_id: string | null;
    }>();
  if (!data?.stripe_subscription_id || !data.stripe_account_key) return;
  const stripe = getStripeClient(data.stripe_account_key);
  if (!stripe) return;
  try {
    await cancelOtherLiveSubscriptionsForUser({
      stripe,
      stripeAccountKey: data.stripe_account_key,
      userId,
      keepSubscriptionId: "__apple_iap__",
      seedCustomerIds: [data.stripe_customer_id],
    });
  } catch (error) {
    console.error("[billing-apple] cancel Stripe before Apple Pro failed", error);
  }
}

export async function findUserIdByAppleOriginalTransactionId(
  originalTransactionId: string,
): Promise<string | null> {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("billing_subscriptions")
    .select("user_id")
    .eq("apple_original_transaction_id", originalTransactionId)
    .maybeSingle<{ user_id: string }>();
  return data?.user_id ?? null;
}

/**
 * Apply a verified App Store transaction to `billing_subscriptions`.
 * Grants Pro while the subscription is unexpired and not revoked.
 */
export async function applyAppleTransaction(args: {
  userId: string;
  transaction: JWSTransactionDecodedPayload;
  renewal?: JWSRenewalInfoDecodedPayload | null;
}): Promise<AppleBillingApplyResult> {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    throw new Error("Billing admin is not configured.");
  }

  const productId = args.transaction.productId ?? "";
  if (!isAppleProProductId(productId)) {
    throw new Error("Unknown Apple product.");
  }

  const originalTransactionId = args.transaction.originalTransactionId;
  if (!originalTransactionId) {
    throw new Error("Apple transaction is missing originalTransactionId.");
  }

  const { data: claimed } = await admin
    .from("billing_subscriptions")
    .select("user_id")
    .eq("apple_original_transaction_id", originalTransactionId)
    .maybeSingle<{ user_id: string }>();
  if (claimed && claimed.user_id !== args.userId) {
    throw new Error("This Apple subscription is already linked to another Finsepa account.");
  }

  const revoked = typeof args.transaction.revocationDate === "number";
  const expiresMs = args.transaction.expiresDate;
  const stillActive =
    !revoked && typeof expiresMs === "number" && Number.isFinite(expiresMs) && expiresMs > Date.now();
  const autoRenew = isAutoRenewOn(args.renewal ?? null);
  const planCode = applePlanCodeForProductId(productId);
  const amountUsd = appleAmountUsdForProductId(productId);

  if (stillActive) {
    await cancelLiveStripeForUser(args.userId);
  }

  const status = stillActive ? "active" : "expired";
  const planForRow = stillActive ? planCode : "free";

  await admin.from("billing_subscriptions").upsert(
    {
      user_id: args.userId,
      billing_provider: "apple",
      apple_original_transaction_id: originalTransactionId,
      apple_product_id: productId,
      apple_environment: args.transaction.environment ?? null,
      plan_code: planForRow,
      status: stillActive ? "active" : "free",
      recurring_amount_usd: stillActive ? amountUsd : 0,
      current_period_end: msToIso(expiresMs),
      cancel_at_period_end: stillActive && !autoRenew,
      stripe_subscription_id: stillActive ? null : undefined,
      stripe_price_id: stillActive ? null : undefined,
      platform_trial_ends_at: stillActive ? null : undefined,
      loops_pro_ended_free_email_sent_at: stillActive ? null : undefined,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  const transactionId = args.transaction.transactionId;
  const paidAt = msToIso(args.transaction.purchaseDate);
  if (stillActive && transactionId && paidAt) {
    await admin.from("billing_invoices").upsert(
      {
        user_id: args.userId,
        stripe_account_key: "apple",
        stripe_invoice_id: transactionId,
        stripe_subscription_id: originalTransactionId,
        amount_usd: amountUsd,
        currency: "usd",
        paid_at: paidAt,
        description: appleInvoiceDescription(productId),
      },
      { onConflict: "stripe_account_key,stripe_invoice_id" },
    );
  }

  return {
    planCode: planForRow,
    status,
    isPro: stillActive,
  };
}

export async function applyAppleTransactionForKnownOrTokenUser(args: {
  transaction: JWSTransactionDecodedPayload;
  renewal?: JWSRenewalInfoDecodedPayload | null;
  fallbackUserId?: string | null;
}): Promise<string | null> {
  const originalTransactionId = args.transaction.originalTransactionId;
  if (!originalTransactionId) return null;

  const tokenUserId =
    typeof args.transaction.appAccountToken === "string" && args.transaction.appAccountToken.trim()
      ? args.transaction.appAccountToken.trim().toLowerCase()
      : null;
  const mapped = await findUserIdByAppleOriginalTransactionId(originalTransactionId);
  const userId = mapped ?? tokenUserId ?? args.fallbackUserId ?? null;
  if (!userId) return null;

  await applyAppleTransaction({
    userId,
    transaction: args.transaction,
    renewal: args.renewal ?? null,
  });
  return userId;
}

export function appleRowIsActivePro(row: {
  billing_provider?: string | null;
  plan_code?: string | null;
  status?: string | null;
} | null): boolean {
  return row?.billing_provider === "apple" && hasActivePaidProSubscription(row);
}
