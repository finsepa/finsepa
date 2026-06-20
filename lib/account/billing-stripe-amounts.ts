import "server-only";

import type Stripe from "stripe";

function couponFromDiscount(discount: Stripe.Discount | string | null | undefined): Stripe.Coupon | null {
  if (!discount || typeof discount === "string") return null;
  const coupon = discount.source?.coupon;
  if (!coupon || typeof coupon === "string") return null;
  return coupon;
}

function applyCouponToCents(amountCents: number, coupon: Stripe.Coupon): number {
  if (coupon.percent_off != null && Number.isFinite(coupon.percent_off)) {
    return Math.max(0, Math.round(amountCents * (1 - coupon.percent_off / 100)));
  }
  if (coupon.amount_off != null && Number.isFinite(coupon.amount_off)) {
    return Math.max(0, amountCents - coupon.amount_off);
  }
  return amountCents;
}

function discountsFromSubscription(subscription: Stripe.Subscription): Stripe.Discount[] {
  const discounts: Stripe.Discount[] = [];
  if (Array.isArray(subscription.discounts)) {
    for (const entry of subscription.discounts) {
      if (entry && typeof entry !== "string" && couponFromDiscount(entry)) {
        discounts.push(entry);
      }
    }
  }
  return discounts;
}

/** List price for the primary subscription item after subscription-level coupon(s). */
export function subscriptionUnitAmountCentsAfterDiscounts(subscription: Stripe.Subscription): number {
  const baseCents = subscription.items.data[0]?.price?.unit_amount ?? 0;
  if (!baseCents) return 0;

  let cents = baseCents;
  for (const discount of discountsFromSubscription(subscription)) {
    const coupon = couponFromDiscount(discount);
    if (coupon) cents = applyCouponToCents(cents, coupon);
  }
  return cents;
}

export function subscriptionUnitAmountUsdAfterDiscounts(subscription: Stripe.Subscription): number {
  return Number((subscriptionUnitAmountCentsAfterDiscounts(subscription) / 100).toFixed(2));
}

/**
 * Amount the customer will be charged on the next invoice (promos included).
 * Falls back to discounted list price when Stripe has no upcoming invoice yet.
 */
export async function resolveNextRecurringChargeUsd(args: {
  stripe: Stripe;
  customerId: string;
  subscriptionId: string;
  subscription?: Stripe.Subscription | null;
  fallbackUsd?: number;
}): Promise<number | null> {
  try {
    const upcoming = await (
      args.stripe.invoices as unknown as {
        retrieveUpcoming: (params: {
          customer: string;
          subscription: string;
        }) => Promise<{ amount_due?: number; total?: number }>;
      }
    ).retrieveUpcoming({
      customer: args.customerId,
      subscription: args.subscriptionId,
    });
    const amountDue =
      typeof upcoming.amount_due === "number"
        ? upcoming.amount_due
        : typeof upcoming.total === "number"
          ? upcoming.total
          : null;
    if (amountDue != null) {
      return Number((amountDue / 100).toFixed(2));
    }
  } catch {
    /* no upcoming invoice — fall through */
  }

  if (args.subscription) {
    return subscriptionUnitAmountUsdAfterDiscounts(args.subscription);
  }

  if (typeof args.fallbackUsd === "number" && Number.isFinite(args.fallbackUsd)) {
    return args.fallbackUsd;
  }

  return null;
}
