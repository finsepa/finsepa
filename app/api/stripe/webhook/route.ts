import { NextResponse } from "next/server";
import type Stripe from "stripe";

import {
  findUserIdByStripeCustomer,
  getBillingSubscriptionStripeIdsForUser,
  recordWebhookEvent,
  setSubscriptionTrial,
  upsertBillingCustomer,
  upsertBillingSubscription,
  upsertPaidInvoice,
} from "@/lib/account/billing-db";
import { getStripeAccountConfig, getStripeClient } from "@/lib/stripe/server";

function invoiceDescription(invoice: Stripe.Invoice): string {
  const line = invoice.lines.data[0];
  // Stripe's invoice line item typing varies across API versions / expansions.
  // We only use this as a best-effort label for the UI/backfill.
  const typedLine = line as Stripe.InvoiceLineItem & {
    price?: Stripe.Price | null;
    plan?: { interval?: string | null } | null;
  };
  const interval = typedLine?.price?.recurring?.interval ?? typedLine?.plan?.interval ?? null;
  if (interval === "year") return "Pro annually";
  if (interval === "month") return "Pro monthly";
  return line?.description || invoice.description || "Pro plan";
}

function normalizeCustomerId(value: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

async function syncSubscriptionFromStripe(args: {
  stripe: Stripe;
  stripeAccountKey: string;
  subscription: Stripe.Subscription;
  fallbackUserId?: string | null;
}) {
  const customerId = normalizeCustomerId(args.subscription.customer);
  if (!customerId) return;
  const knownUserId =
    args.fallbackUserId ??
    (await findUserIdByStripeCustomer({
      stripeAccountKey: args.stripeAccountKey,
      stripeCustomerId: customerId,
    }));
  if (!knownUserId) return;

  await upsertBillingCustomer({
    userId: knownUserId,
    stripeAccountKey: args.stripeAccountKey,
    stripeCustomerId: customerId,
    email: null,
  });
  await upsertBillingSubscription({
    userId: knownUserId,
    stripeAccountKey: args.stripeAccountKey,
    stripeCustomerId: customerId,
    subscription: args.subscription,
  });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const accountKey = url.searchParams.get("account");
  const account = getStripeAccountConfig(accountKey);
  if (!account?.webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook secret is not configured." }, { status: 500 });
  }
  const stripe = getStripeClient(account.key);
  if (!stripe) {
    return NextResponse.json({ error: "Stripe account is not configured." }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const payloadText = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payloadText, signature, account.webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const isNew = await recordWebhookEvent({
      stripeAccountKey: account.key,
      stripeEventId: event.id,
      eventType: event.type,
      payload: event,
    });
    if (!isNew) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = normalizeCustomerId(session.customer);
        const userId = session.client_reference_id || null;
        if (!customerId || !userId) break;

        await upsertBillingCustomer({
          userId,
          stripeAccountKey: account.key,
          stripeCustomerId: customerId,
          email: session.customer_details?.email || null,
        });

        if (session.mode === "subscription" && typeof session.subscription === "string") {
          const newSubscriptionId = session.subscription;

          const prior = await getBillingSubscriptionStripeIdsForUser(userId);
          if (
            prior?.stripe_subscription_id &&
            prior.stripe_subscription_id !== newSubscriptionId
          ) {
            try {
              const oldSub = await stripe.subscriptions.retrieve(prior.stripe_subscription_id, {
                expand: ["items.data.price"],
              });
              if (oldSub.status === "active" || oldSub.status === "trialing") {
                await stripe.subscriptions.cancel(newSubscriptionId);
                break;
              }
            } catch {
              // prior subscription no longer exists in Stripe — allow the new one
            }
          }

          const subscription = await stripe.subscriptions.retrieve(newSubscriptionId, {
            expand: ["items.data.price"],
          });
          await upsertBillingSubscription({
            userId,
            stripeAccountKey: account.key,
            stripeCustomerId: customerId,
            subscription,
          });
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscriptionFromStripe({
          stripe,
          stripeAccountKey: account.key,
          subscription,
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = normalizeCustomerId(subscription.customer);
        if (!customerId) break;
        const userId = await findUserIdByStripeCustomer({
          stripeAccountKey: account.key,
          stripeCustomerId: customerId,
        });
        if (!userId) break;
        await setSubscriptionTrial({ userId });
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = normalizeCustomerId(invoice.customer);
        if (!customerId) break;
        const userId = await findUserIdByStripeCustomer({
          stripeAccountKey: account.key,
          stripeCustomerId: customerId,
        });
        if (!userId) break;

        await upsertPaidInvoice({
          userId,
          stripeAccountKey: account.key,
          invoice,
          description: invoiceDescription(invoice),
        });

        const invoiceSubscriptionId = (invoice as unknown as { subscription?: unknown }).subscription;
        if (typeof invoiceSubscriptionId === "string") {
          const invoiceLinePeriodEndSeconds =
            typeof invoice.lines?.data?.[0]?.period?.end === "number"
              ? invoice.lines.data[0].period.end
              : null;
          const subscription = await stripe.subscriptions.retrieve(invoiceSubscriptionId, {
            expand: ["items.data.price"],
          });
          await upsertBillingSubscription({
            userId,
            stripeAccountKey: account.key,
            stripeCustomerId: customerId,
            subscription,
            currentPeriodEndSeconds: invoiceLinePeriodEndSeconds,
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = normalizeCustomerId(invoice.customer);
        const invoiceSubscriptionId = (invoice as unknown as { subscription?: unknown }).subscription;
        if (!customerId || typeof invoiceSubscriptionId !== "string") break;
        const userId = await findUserIdByStripeCustomer({
          stripeAccountKey: account.key,
          stripeCustomerId: customerId,
        });
        if (!userId) break;
        const subscription = await stripe.subscriptions.retrieve(invoiceSubscriptionId, {
          expand: ["items.data.price"],
        });
        await upsertBillingSubscription({
          userId,
          stripeAccountKey: account.key,
          stripeCustomerId: customerId,
          subscription,
        });
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook handler failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
