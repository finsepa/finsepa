#!/usr/bin/env node
/**
 * One-time backfill: Stripe -> public.billing_* tables.
 *
 * Required env:
 * - STRIPE_SECRET_KEY (or STRIPE_ACCOUNTS_JSON)
 * - Same DB env as migrations: pooler (`SUPABASE_POOLER_HOST` / `SUPABASE_POOLER_REGION`) or `DATABASE_URL`, etc.
 *
 * Usage:
 *   node --env-file=.env.local scripts/backfill-billing-from-stripe.mjs
 */

import dns from "node:dns";
import pg from "pg";
import Stripe from "stripe";

import { resolveSupabaseDatabaseUrl } from "./supabase-db-url.mjs";

if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

function resolveDatabaseUrl() {
  return resolveSupabaseDatabaseUrl();
}

function parseStripeAccounts() {
  const raw = process.env.STRIPE_ACCOUNTS_JSON?.trim();
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return arr
          .map((r) => ({
            key: String(r?.key || "").trim(),
            secretKey: String(r?.secretKey || "").trim(),
          }))
          .filter((r) => r.key && r.secretKey);
      }
    } catch {
      // fall through to default
    }
  }
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) return [];
  return [{ key: process.env.STRIPE_PRIMARY_ACCOUNT_KEY?.trim() || "primary", secretKey: secret }];
}

function resolvePlanCode(subscription) {
  const interval = subscription?.items?.data?.[0]?.price?.recurring?.interval;
  if (interval === "year") return "pro_annually";
  if (interval === "month") return "pro_monthly";
  return "pro";
}

function invoiceDescription(invoice) {
  const line = invoice?.lines?.data?.[0];
  const interval = line?.price?.recurring?.interval;
  if (interval === "year") return "Pro annually";
  if (interval === "month") return "Pro monthly";
  return line?.description || invoice?.description || "Pro plan";
}

async function ensureTablesExist(client) {
  const { rows } = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema='public'
      and table_name in ('billing_customers','billing_subscriptions','billing_invoices')
  `);
  const names = new Set(rows.map((r) => r.table_name));
  return (
    names.has("billing_customers") && names.has("billing_subscriptions") && names.has("billing_invoices")
  );
}

async function findUserIdByEmail(client, email) {
  if (!email) return null;
  const { rows } = await client.query(
    `select id::text as id from auth.users where lower(email)=lower($1) limit 1`,
    [email],
  );
  return rows[0]?.id ?? null;
}

async function upsertCustomer(client, { userId, accountKey, customerId, email }) {
  await client.query(
    `insert into public.billing_customers (user_id, stripe_account_key, stripe_customer_id, email, updated_at)
     values ($1,$2,$3,$4,now())
     on conflict (user_id, stripe_account_key)
     do update set stripe_customer_id=excluded.stripe_customer_id, email=excluded.email, updated_at=now()`,
    [userId, accountKey, customerId, email ?? null],
  );
}

async function upsertSubscription(client, { userId, accountKey, customerId, subscription }) {
  const price = subscription?.items?.data?.[0]?.price;
  const recurringAmount = Number((((price?.unit_amount ?? 0) / 100) || 0).toFixed(2));
  await client.query(
    `insert into public.billing_subscriptions
      (user_id, stripe_account_key, stripe_customer_id, stripe_subscription_id, stripe_price_id, recurring_amount_usd, plan_code, status, current_period_end, cancel_at_period_end, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,to_timestamp($9),$10,now())
     on conflict (user_id)
     do update set stripe_account_key=excluded.stripe_account_key,
                   stripe_customer_id=excluded.stripe_customer_id,
                   stripe_subscription_id=excluded.stripe_subscription_id,
                   stripe_price_id=excluded.stripe_price_id,
                   recurring_amount_usd=excluded.recurring_amount_usd,
                   plan_code=excluded.plan_code,
                   status=excluded.status,
                   current_period_end=excluded.current_period_end,
                   cancel_at_period_end=excluded.cancel_at_period_end,
                   updated_at=now()`,
    [
      userId,
      accountKey,
      customerId,
      subscription.id,
      price?.id ?? null,
      recurringAmount,
      resolvePlanCode(subscription),
      subscription.status,
      subscription.current_period_end ?? null,
      !!subscription.cancel_at_period_end,
    ],
  );
}

async function upsertPaidInvoice(client, { userId, accountKey, invoice }) {
  await client.query(
    `insert into public.billing_invoices
      (user_id, stripe_account_key, stripe_invoice_id, stripe_subscription_id, amount_usd, currency, paid_at, description)
     values ($1,$2,$3,$4,$5,$6,to_timestamp($7),$8)
     on conflict (stripe_account_key, stripe_invoice_id)
     do update set amount_usd=excluded.amount_usd, currency=excluded.currency, paid_at=excluded.paid_at, description=excluded.description`,
    [
      userId,
      accountKey,
      invoice.id,
      typeof invoice.subscription === "string" ? invoice.subscription : null,
      Number((((invoice.amount_paid ?? 0) / 100) || 0).toFixed(2)),
      (invoice.currency ?? "usd").toUpperCase(),
      invoice.created,
      invoiceDescription(invoice),
    ],
  );
}

async function processAccount(client, account) {
  const stripe = new Stripe(account.secretKey);
  let linkedCustomers = 0;
  let skippedCustomers = 0;

  for await (const customer of stripe.customers.list({ limit: 100 })) {
    if (customer.deleted) continue;
    const email = customer.email;
    const userId = await findUserIdByEmail(client, email);
    if (!userId) {
      skippedCustomers += 1;
      continue;
    }
    linkedCustomers += 1;
    await upsertCustomer(client, {
      userId,
      accountKey: account.key,
      customerId: customer.id,
      email,
    });

    for await (const subscription of stripe.subscriptions.list({
      customer: customer.id,
      status: "all",
      limit: 100,
      expand: ["data.items.data.price"],
    })) {
      await upsertSubscription(client, {
        userId,
        accountKey: account.key,
        customerId: customer.id,
        subscription,
      });
    }

    for await (const invoice of stripe.invoices.list({ customer: customer.id, limit: 100 })) {
      if (invoice.status !== "paid") continue;
      await upsertPaidInvoice(client, {
        userId,
        accountKey: account.key,
        invoice,
      });
    }
  }

  return { linkedCustomers, skippedCustomers };
}

async function main() {
  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("Missing DB connection env (DATABASE_URL or NEXT_PUBLIC_SUPABASE_URL + SUPABASE_DB_PASSWORD).");
  }
  const stripeAccounts = parseStripeAccounts();
  if (stripeAccounts.length === 0) {
    throw new Error("Missing Stripe env: set STRIPE_SECRET_KEY (or STRIPE_ACCOUNTS_JSON).");
  }

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const hasTables = await ensureTablesExist(client);
    if (!hasTables) {
      throw new Error("Billing tables not found. Run `npm run db:migrate` first.");
    }
    for (const account of stripeAccounts) {
      process.stdout.write(`Backfilling Stripe account "${account.key}" ... `);
      const result = await processAccount(client, account);
      console.log(`ok (linked=${result.linkedCustomers}, skipped_no_user=${result.skippedCustomers})`);
    }
    console.log("Billing backfill completed.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
