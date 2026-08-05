import "server-only";

import type Stripe from "stripe";

import type { BillingCycle } from "@/lib/account/plan-pricing";
import {
  getStripeSubscriptionPriceId,
  type StripeBillingCycle,
} from "@/lib/stripe/server";

function intervalForCycle(cycle: BillingCycle | StripeBillingCycle): "month" | "year" {
  return cycle === "annually" ? "year" : "month";
}

function productIdFromPrice(price: Stripe.Price): string | null {
  const p = price.product;
  if (typeof p === "string" && p.trim()) return p.trim();
  if (p && typeof p === "object" && "id" in p && typeof p.id === "string") return p.id;
  return null;
}

function pickRecurringPrice(
  prices: Stripe.Price[],
  interval: "month" | "year",
): string | null {
  const matches = prices.filter(
    (p) =>
      p.active !== false &&
      p.type === "recurring" &&
      p.recurring?.interval === interval &&
      (p.recurring.interval_count ?? 1) === 1,
  );
  if (matches.length === 0) return null;
  // Prefer list prices with positive unit amount; otherwise first match.
  matches.sort((a, b) => (b.unit_amount ?? 0) - (a.unit_amount ?? 0));
  return matches[0]?.id ?? null;
}

/**
 * Resolve a Stripe Price id for monthly/annual switch.
 * Order: env → same product as current subscription price → product of other env price.
 * No Payment Link parsing (buy.stripe.com cannot upgrade an existing sub).
 * Does not need extra OAuth — uses existing STRIPE_SECRET_KEY (sk_…).
 */
export async function resolveBillingPriceIdForCycle(args: {
  stripe: Stripe;
  cycle: BillingCycle | StripeBillingCycle;
  accountKey?: string | null;
  currentPriceId?: string | null;
}): Promise<string | null> {
  const fromEnv = getStripeSubscriptionPriceId(args.cycle, args.accountKey)?.trim();
  if (fromEnv) return fromEnv;

  const interval = intervalForCycle(args.cycle);
  const seedIds = [
    args.currentPriceId?.trim() || null,
    getStripeSubscriptionPriceId(
      args.cycle === "annually" ? "monthly" : "annually",
      args.accountKey,
    ) ?? null,
  ].filter((id): id is string => Boolean(id));

  for (const seed of seedIds) {
    try {
      const seedPrice = await args.stripe.prices.retrieve(seed);
      const productId = productIdFromPrice(seedPrice);
      if (!productId) continue;
      const listed = await args.stripe.prices.list({
        product: productId,
        active: true,
        type: "recurring",
        limit: 20,
      });
      const matched = pickRecurringPrice(listed.data, interval);
      if (matched) return matched;
    } catch {
      /* try next seed */
    }
  }

  return null;
}
