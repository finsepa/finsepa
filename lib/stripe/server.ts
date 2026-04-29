import "server-only";

import Stripe from "stripe";
import { pickProcessEnv, pickProcessEnvB64 } from "@/lib/env/pick-process-env";

export type StripeBillingCycle = "monthly" | "annually";

export type StripeAccountConfig = {
  key: string;
  secretKey: string;
  webhookSecret?: string;
  monthlyPaymentLink?: string;
  annualPaymentLink?: string;
  /** When set with `annualPriceId`, checkout uses Stripe Checkout (reuses `customer` from DB). */
  monthlyPriceId?: string;
  annualPriceId?: string;
  portalReturnUrl?: string;
};

function getDefaultStripeSecretKey(): string | undefined {
  return pickProcessEnv("STRIPE_SECRET_KEY") ?? pickProcessEnvB64("U1RSSVBFX1NFQ1JFVF9LRVk=");
}

function getDefaultPortalReturnUrl(): string {
  const envUrl =
    pickProcessEnv("NEXT_PUBLIC_APP_ORIGIN") ??
    pickProcessEnv("NEXT_PUBLIC_APP_URL") ??
    pickProcessEnv("APP_URL") ??
    pickProcessEnv("NEXT_PUBLIC_SITE_URL");
  if (envUrl) {
    const raw = envUrl.trim().replace(/\/+$/, "");
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return `${withScheme}/account?tab=billing`;
  }
  const vercelUrl = pickProcessEnv("VERCEL_URL");
  if (vercelUrl) return `https://${vercelUrl.replace(/\/+$/, "")}/account?tab=billing`;
  return "http://localhost:3000/account?tab=billing";
}

function parseStripeAccountsFromJson(): StripeAccountConfig[] {
  const raw = pickProcessEnv("STRIPE_ACCOUNTS_JSON");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: StripeAccountConfig[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const key = typeof row.key === "string" ? row.key.trim() : "";
      const secretKey = typeof row.secretKey === "string" ? row.secretKey.trim() : "";
      if (!key || !secretKey) continue;
      out.push({
        key,
        secretKey,
        webhookSecret: typeof row.webhookSecret === "string" ? row.webhookSecret.trim() : undefined,
        monthlyPaymentLink:
          typeof row.monthlyPaymentLink === "string" ? row.monthlyPaymentLink.trim() : undefined,
        annualPaymentLink: typeof row.annualPaymentLink === "string" ? row.annualPaymentLink.trim() : undefined,
        monthlyPriceId: typeof row.monthlyPriceId === "string" ? row.monthlyPriceId.trim() : undefined,
        annualPriceId: typeof row.annualPriceId === "string" ? row.annualPriceId.trim() : undefined,
        portalReturnUrl: typeof row.portalReturnUrl === "string" ? row.portalReturnUrl.trim() : undefined,
      });
    }
    return out;
  } catch {
    return [];
  }
}

function getDefaultStripeAccount(): StripeAccountConfig | null {
  const secretKey = getDefaultStripeSecretKey();
  if (!secretKey) return null;
  return {
    key: pickProcessEnv("STRIPE_PRIMARY_ACCOUNT_KEY") ?? "primary",
    secretKey,
    webhookSecret: pickProcessEnv("STRIPE_WEBHOOK_SECRET"),
    monthlyPaymentLink:
      pickProcessEnv("STRIPE_PAYMENT_LINK_MONTHLY") ?? "https://buy.stripe.com/eVqaEX3nf0kQ7iyduP5AQ0i",
    annualPaymentLink:
      pickProcessEnv("STRIPE_PAYMENT_LINK_ANNUAL") ?? "https://buy.stripe.com/fZu6oH9LDaZubyO4Yj5AQ0j",
    monthlyPriceId: pickProcessEnv("STRIPE_PRICE_ID_MONTHLY")?.trim(),
    annualPriceId: pickProcessEnv("STRIPE_PRICE_ID_ANNUAL")?.trim(),
    portalReturnUrl: getDefaultPortalReturnUrl(),
  };
}

export function getStripeAccounts(): StripeAccountConfig[] {
  const fromJson = parseStripeAccountsFromJson();
  if (fromJson.length > 0) return fromJson;
  const fallback = getDefaultStripeAccount();
  return fallback ? [fallback] : [];
}

export function getStripeAccountConfig(accountKey?: string | null): StripeAccountConfig | null {
  const all = getStripeAccounts();
  if (all.length === 0) return null;
  if (!accountKey) return all[0];
  return all.find((item) => item.key === accountKey) ?? null;
}

export function getStripeClient(accountKey?: string | null): Stripe | null {
  const account = getStripeAccountConfig(accountKey);
  if (!account) return null;
  return new Stripe(account.secretKey);
}

export function getStripePortalReturnUrl(accountKey?: string | null): string {
  const account = getStripeAccountConfig(accountKey);
  return account?.portalReturnUrl || getDefaultPortalReturnUrl();
}

export function getStripePaymentLink(
  cycle: StripeBillingCycle,
  accountKey?: string | null,
): string | undefined {
  const account = getStripeAccountConfig(accountKey);
  if (!account) return undefined;
  return cycle === "monthly" ? account.monthlyPaymentLink : account.annualPaymentLink;
}

export function getStripeSubscriptionPriceId(
  cycle: StripeBillingCycle,
  accountKey?: string | null,
): string | undefined {
  const account = getStripeAccountConfig(accountKey);
  if (!account) return undefined;
  const id = cycle === "monthly" ? account.monthlyPriceId : account.annualPriceId;
  return id?.trim() || undefined;
}

/** Success and cancel URLs for subscription Checkout Sessions (Stripe replaces `{CHECKOUT_SESSION_ID}`). */
export function getStripeBillingCheckoutUrls(account: StripeAccountConfig): {
  successUrl: string;
  cancelUrl: string;
} {
  const cancelUrl = (account.portalReturnUrl?.trim() || getDefaultPortalReturnUrl()).replace(/\/+$/, "");
  const join = cancelUrl.includes("?") ? "&" : "?";
  const successUrl = `${cancelUrl}${join}checkout=success&session_id={CHECKOUT_SESSION_ID}`;
  return { successUrl, cancelUrl };
}
