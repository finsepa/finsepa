import "server-only";

import type Stripe from "stripe";

import { getStripeAccounts, getStripeClient } from "@/lib/stripe/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSnaptradeSdk, isSnapTradeConfigured } from "@/lib/snaptrade/server";

export {
  DELETE_ACCOUNT_CONFIRM_PHRASE,
  isDeleteAccountConfirmPhrase,
} from "@/lib/account/delete-account-confirm";


async function collectStripeCustomerIds(args: {
  stripe: Stripe;
  stripeAccountKey: string;
  userId: string;
  email?: string | null;
}): Promise<string[]> {
  const ids = new Set<string>();
  const admin = getSupabaseAdminClient();

  if (admin) {
    const [{ data: custRows }, { data: subRow }] = await Promise.all([
      admin
        .from("billing_customers")
        .select("stripe_customer_id")
        .eq("user_id", args.userId)
        .eq("stripe_account_key", args.stripeAccountKey)
        .returns<{ stripe_customer_id: string }[]>(),
      admin
        .from("billing_subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", args.userId)
        .maybeSingle<{ stripe_customer_id: string | null }>(),
    ]);
    for (const row of custRows ?? []) {
      if (row.stripe_customer_id) ids.add(row.stripe_customer_id.trim());
    }
    if (subRow?.stripe_customer_id) ids.add(subRow.stripe_customer_id.trim());
  }

  try {
    const found = await args.stripe.customers.search({
      query: `metadata['finsepa_user_id']:'${args.userId}'`,
      limit: 25,
    });
    for (const customer of found.data) ids.add(customer.id);
  } catch {
    /* Search API unavailable — DB + email fallback */
  }

  const email = typeof args.email === "string" ? args.email.trim() : "";
  if (email) {
    try {
      const listed = await args.stripe.customers.list({ email, limit: 25 });
      for (const customer of listed.data) {
        const metaUserId =
          customer.metadata && typeof customer.metadata.finsepa_user_id === "string"
            ? customer.metadata.finsepa_user_id
            : "";
        if (!metaUserId || metaUserId === args.userId) ids.add(customer.id);
      }
    } catch {
      /* ignore */
    }
  }

  return [...ids].filter(Boolean);
}

/** Cancel live subscriptions then delete Stripe customers for this user (all configured accounts). */
export async function purgeStripeBillingForUser(args: {
  userId: string;
  email?: string | null;
}): Promise<void> {
  for (const account of getStripeAccounts()) {
    const stripe = getStripeClient(account.key);
    if (!stripe) continue;

    let customerIds: string[] = [];
    try {
      customerIds = await collectStripeCustomerIds({
        stripe,
        stripeAccountKey: account.key,
        userId: args.userId,
        email: args.email,
      });
    } catch (error) {
      console.error("[delete-account] list Stripe customers", account.key, error);
      continue;
    }

    for (const customerId of customerIds) {
      try {
        const subs = await stripe.subscriptions.list({
          customer: customerId,
          status: "all",
          limit: 100,
        });
        for (const sub of subs.data) {
          if (sub.status === "canceled" || sub.status === "incomplete_expired") continue;
          try {
            await stripe.subscriptions.cancel(sub.id);
          } catch (error) {
            console.error("[delete-account] cancel subscription", sub.id, error);
          }
        }
      } catch (error) {
        console.error("[delete-account] list subscriptions", customerId, error);
      }

      try {
        await stripe.customers.del(customerId);
      } catch (error) {
        console.error("[delete-account] delete Stripe customer", customerId, error);
      }
    }
  }
}

/** Best-effort: remove SnapTrade user + local credentials row. */
export async function purgeSnapTradeForUser(userId: string): Promise<void> {
  if (!isSnapTradeConfigured()) return;

  const admin = getSupabaseAdminClient();
  let snaptradeUserId = userId;
  if (admin) {
    const { data } = await admin
      .from("snaptrade_users")
      .select("snaptrade_user_id")
      .eq("user_id", userId)
      .maybeSingle<{ snaptrade_user_id: string }>();
    if (data?.snaptrade_user_id) snaptradeUserId = data.snaptrade_user_id;
  }

  try {
    const snaptrade = getSnaptradeSdk();
    await snaptrade.authentication.deleteSnapTradeUser({ userId: snaptradeUserId });
  } catch (error) {
    console.error("[delete-account] SnapTrade delete user", error);
  }
}

/** Best-effort: remove avatar objects under `avatars/{userId}/`. */
export async function purgeAvatarStorageForUser(userId: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  if (!admin) return;

  try {
    const { data: listed } = await admin.storage.from("avatars").list(userId, { limit: 100 });
    const paths = (listed ?? [])
      .map((item) => (item?.name ? `${userId}/${item.name}` : null))
      .filter((p): p is string => Boolean(p));
    if (paths.length > 0) {
      await admin.storage.from("avatars").remove(paths);
    }
  } catch (error) {
    console.error("[delete-account] avatar storage", error);
  }
}

/**
 * Full account wipe: external billing + brokers, then Auth user
 * (app tables cascade via `ON DELETE CASCADE` on `auth.users`).
 */
export async function deleteFinsepaAccount(args: {
  userId: string;
  email?: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return {
      ok: false,
      message: "Account deletion is temporarily unavailable. Try again in a few minutes.",
    };
  }

  await purgeStripeBillingForUser({ userId: args.userId, email: args.email });
  await purgeSnapTradeForUser(args.userId);
  await purgeAvatarStorageForUser(args.userId);

  const { error } = await admin.auth.admin.deleteUser(args.userId);
  if (error) {
    console.error("[delete-account] auth deleteUser", error);
    return {
      ok: false,
      message: error.message || "Could not delete account. Please try again.",
    };
  }

  return { ok: true };
}
