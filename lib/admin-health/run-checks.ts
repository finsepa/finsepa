import "server-only";

import { Pool } from "pg";
import { Snaptrade } from "snaptrade-typescript-sdk";

import type { HealthCheck, HealthReport } from "@/lib/admin-health/types";
import { getAuthAppOriginFromEnv } from "@/lib/auth/app-origin";
import { isSignupDisabled, getTurnstileSecretKey } from "@/lib/auth/signup-guard";
import { getLoopsApiKey, getLoopsTransactionalSignupId } from "@/lib/env/server";
import { getSnapTradeClientId, getSnapTradeConsumerKey } from "@/lib/env/server";
import { checkStockMinuteIngestPipeline } from "@/lib/market/stock-minute-ingest-health";
import { pickProcessEnv } from "@/lib/env/pick-process-env";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveSupabaseDatabaseUrl } from "@/lib/supabase/postgres-url";
import { getStripeAccounts, getStripeClient } from "@/lib/stripe/server";

let pgPool: Pool | null = null;

function getPgPool(): Pool | null {
  const connectionString = resolveSupabaseDatabaseUrl();
  if (!connectionString) return null;
  if (!pgPool) {
    pgPool = new Pool({
      connectionString,
      max: 2,
      ssl: connectionString.includes("localhost") ? undefined : { rejectUnauthorized: false },
    });
  }
  return pgPool;
}

async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; latencyMs: number }> {
  const start = Date.now();
  const result = await fn();
  return { result, latencyMs: Date.now() - start };
}

function configCheck(args: {
  id: string;
  label: string;
  configured: boolean;
  summaryOk: string;
  summaryMissing: string;
  details?: Record<string, string | number | boolean | null>;
}): HealthCheck {
  return {
    id: args.id,
    label: args.label,
    status: args.configured ? "ok" : "error",
    summary: args.configured ? args.summaryOk : args.summaryMissing,
    details: args.details,
  };
}

export async function runAdminHealthChecks(): Promise<HealthReport> {
  const checks: HealthCheck[] = [];

  const supabaseUrl = pickProcessEnv("NEXT" + "_" + "PUBLIC" + "_" + "SUPABASE" + "_" + "URL");
  const anonKey =
    pickProcessEnv("NEXT" + "_" + "PUBLIC" + "_" + "SUPABASE" + "_" + "ANON" + "_" + "KEY") ??
    pickProcessEnv("NEXT" + "_" + "PUBLIC" + "_" + "SUPABASE" + "_" + "PUBLISHABLE" + "_" + "KEY");
  const poolerConfigured = Boolean(resolveSupabaseDatabaseUrl());
  const admin = getSupabaseAdminClient();

  checks.push(
    configCheck({
      id: "supabase-public",
      label: "Supabase (client)",
      configured: Boolean(supabaseUrl && anonKey),
      summaryOk: "Public URL and anon key are set.",
      summaryMissing: "Missing NEXT_PUBLIC_SUPABASE_URL or anon/publishable key.",
      details: {
        urlConfigured: Boolean(supabaseUrl),
        anonKeyConfigured: Boolean(anonKey),
      },
    }),
  );

  checks.push(
    configCheck({
      id: "supabase-admin",
      label: "Supabase (service role)",
      configured: Boolean(admin),
      summaryOk: "Service role client is available.",
      summaryMissing: "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
    }),
  );

  if (admin) {
    try {
      const { latencyMs } = await timed(() => admin.auth.admin.listUsers({ page: 1, perPage: 1 }));
      checks.push({
        id: "supabase-auth-api",
        label: "Supabase Auth API",
        status: "ok",
        summary: "Admin Auth API responded.",
        latencyMs,
      });
    } catch (e) {
      checks.push({
        id: "supabase-auth-api",
        label: "Supabase Auth API",
        status: "error",
        summary: "Admin Auth API call failed.",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  checks.push(
    configCheck({
      id: "postgres-pooler",
      label: "Postgres pooler",
      configured: poolerConfigured,
      summaryOk: "Database URL is configured (email login + password change).",
      summaryMissing: "Missing SUPABASE_POOLER_URL (or POSTGRES_URL). Email login will fail.",
    }),
  );

  if (poolerConfigured) {
    try {
      const db = getPgPool();
      if (!db) throw new Error("Pool unavailable.");
      const { latencyMs } = await timed(() => db.query("select 1 as ok"));
      checks.push({
        id: "postgres-live",
        label: "Postgres connection",
        status: "ok",
        summary: "SELECT 1 succeeded.",
        latencyMs,
      });
    } catch (e) {
      checks.push({
        id: "postgres-live",
        label: "Postgres connection",
        status: "error",
        summary: "Could not connect or query Postgres.",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const loopsKey = getLoopsApiKey();
  const turnstileConfigured = Boolean(getTurnstileSecretKey());
  checks.push({
    id: "signup",
    label: "Sign up",
    status: admin && loopsKey ? "ok" : "warn",
    summary:
      admin && loopsKey ?
        "Admin + Loops configured for signup confirmation."
      : "Signup may fail without service role and Loops.",
    details: {
      signupDisabled: isSignupDisabled(),
      loopsConfigured: Boolean(loopsKey),
      adminConfigured: Boolean(admin),
      turnstileConfigured,
      signupTemplateConfigured: Boolean(getLoopsTransactionalSignupId()),
    },
  });

  checks.push(
    configCheck({
      id: "auth-origin",
      label: "Auth redirect origin",
      configured: Boolean(getAuthAppOriginFromEnv()),
      summaryOk: "NEXT_PUBLIC_APP_ORIGIN is set for production redirects.",
      summaryMissing: "NEXT_PUBLIC_APP_ORIGIN unset — OAuth/signup links may use wrong origin in prod.",
      details: {
        origin: getAuthAppOriginFromEnv() ?? null,
      },
    }),
  );

  const stripeAccounts = getStripeAccounts();
  const primaryStripe = stripeAccounts[0] ?? null;
  checks.push({
    id: "stripe-config",
    label: "Stripe",
    status: primaryStripe?.secretKey && primaryStripe.webhookSecret ? "ok" : "warn",
    summary:
      primaryStripe?.secretKey ?
        primaryStripe.webhookSecret ?
          "Stripe secret + webhook secret configured."
        : "Stripe secret set but webhook secret missing."
      : "Stripe secret key not configured.",
    details: {
      accountCount: stripeAccounts.length,
      webhookSecretConfigured: Boolean(primaryStripe?.webhookSecret),
      monthlyPriceId: primaryStripe?.monthlyPriceId ?? null,
      annualPriceId: primaryStripe?.annualPriceId ?? null,
    },
  });

  const stripe = getStripeClient(primaryStripe?.key);
  if (stripe) {
    try {
      const { latencyMs } = await timed(() => stripe.balance.retrieve());
      checks.push({
        id: "stripe-live",
        label: "Stripe API",
        status: "ok",
        summary: "Stripe API responded.",
        latencyMs,
      });
    } catch (e) {
      checks.push({
        id: "stripe-live",
        label: "Stripe API",
        status: "error",
        summary: "Stripe API call failed.",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (admin) {
    try {
      const { data, error } = await admin
        .from("billing_webhook_events")
        .select("event_type, processed_at")
        .order("processed_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ event_type: string; processed_at: string }>();

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await admin
        .from("billing_webhook_events")
        .select("id", { count: "exact", head: true })
        .gte("processed_at", since);

      if (error) throw error;

      checks.push({
        id: "billing-webhooks",
        label: "Billing webhooks",
        status: data ? "ok" : "warn",
        summary: data ? `Last webhook: ${data.event_type}` : "No webhook events recorded yet.",
        details: {
          lastEventType: data?.event_type ?? null,
          lastProcessedAt: data?.processed_at ?? null,
          eventsLast24h: count ?? 0,
        },
      });
    } catch (e) {
      checks.push({
        id: "billing-webhooks",
        label: "Billing webhooks",
        status: "error",
        summary: "Could not read billing_webhook_events.",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const snapClientId = getSnapTradeClientId();
  const snapConsumerKey = getSnapTradeConsumerKey();
  checks.push({
    id: "snaptrade-config",
    label: "SnapTrade",
    status: snapClientId && snapConsumerKey ? "ok" : "warn",
    summary:
      snapClientId && snapConsumerKey ?
        "SnapTrade keys configured."
      : "SnapTrade keys missing — brokerage connect disabled.",
    details: {
      clientIdConfigured: Boolean(snapClientId),
      consumerKeyConfigured: Boolean(snapConsumerKey),
    },
  });

  if (snapClientId && snapConsumerKey) {
    try {
      const snaptrade = new Snaptrade({ clientId: snapClientId, consumerKey: snapConsumerKey });
      const { result, latencyMs } = await timed(() => snaptrade.apiStatus.check());
      const online = result.data?.online === true;
      checks.push({
        id: "snaptrade-live",
        label: "SnapTrade API",
        status: online ? "ok" : "warn",
        summary: online ? "SnapTrade API is online." : "SnapTrade API reported not online.",
        latencyMs,
        details: {
          online: online,
        },
      });
    } catch (e) {
      checks.push({
        id: "snaptrade-live",
        label: "SnapTrade API",
        status: "error",
        summary: "SnapTrade status check failed.",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (admin) {
    try {
      const { count, error } = await admin
        .from("snaptrade_users")
        .select("user_id", { count: "exact", head: true });
      if (error) throw error;

      const { data: latest } = await admin
        .from("snaptrade_users")
        .select("updated_at")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ updated_at: string }>();

      checks.push({
        id: "snaptrade-users",
        label: "SnapTrade connections (DB)",
        status: (count ?? 0) > 0 ? "ok" : "warn",
        summary:
          (count ?? 0) > 0 ?
            `${count} user(s) registered with SnapTrade.`
          : "No SnapTrade users in DB yet.",
        details: {
          registeredUsers: count ?? 0,
          lastUpdatedAt: latest?.updated_at ?? null,
        },
      });
    } catch (e) {
      checks.push({
        id: "snaptrade-users",
        label: "SnapTrade connections (DB)",
        status: "error",
        summary: "Could not read snaptrade_users.",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (admin) {
    try {
      const { latencyMs, result } = await timed(() => checkStockMinuteIngestPipeline("NVDA"));
      const session = result.marketSession;
      const workerOk = result.worker?.ok === true;
      const barsOk = result.minuteBarsToday >= 10;
      const regular = session === "regular";

      let status: HealthCheck["status"] = "ok";
      let summary = "Minute-bar pipeline healthy.";

      if (!result.configured) {
        status = regular ? "warn" : "ok";
        summary = "STOCK_MINUTE_INGEST_HEALTH_URL not set — worker health not probed.";
      } else if (regular && !workerOk && !barsOk) {
        status = "error";
        summary = "WS minute ingest down and few NVDA bars today.";
      } else if (regular && !workerOk) {
        status = "warn";
        summary = "Railway worker unhealthy during regular session.";
      } else if (regular && !barsOk) {
        status = "warn";
        summary = "Few NVDA minute bars in Supabase today.";
      }

      checks.push({
        id: "stock-minute-ingest",
        label: "Stock 1D minute ingest",
        status,
        summary,
        latencyMs,
        details: {
          healthUrlConfigured: result.configured,
          marketSession: session,
          nvdaMinuteBarsToday: result.minuteBarsToday,
          workerAuthorized: result.worker?.authorized ?? null,
          workerSubscribed: result.worker?.subscribed ?? null,
          workerLastTradeAt: result.worker?.lastTradeAt ?? null,
          workerTradeMsgCount: result.worker?.tradeMsgCount ?? null,
          workerQuoteMsgCount: result.worker?.quoteMsgCount ?? null,
          workerRestPollCount: result.worker?.restPollCount ?? null,
          workerLastRestPollAt: result.worker?.lastRestPollAt ?? null,
        },
        error: result.worker?.error,
      });
    } catch (e) {
      checks.push({
        id: "stock-minute-ingest",
        label: "Stock 1D minute ingest",
        status: "error",
        summary: "Minute-bar pipeline check failed.",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    vercelEnv: pickProcessEnv("VERCEL" + "_" + "ENV") ?? null,
    checks,
  };
}
