import "server-only";

import { APPLE_PRO_ANNUAL_USD, APPLE_PRO_MONTHLY_USD, type BillingCycle } from "@/lib/account/plan-pricing";

export const APPLE_BUNDLE_ID = "com.finsepa.app";

export const APPLE_PRODUCT_MONTHLY = "finsepa.pro.monthly";
export const APPLE_PRODUCT_ANNUAL = "finsepa.pro.annually";

const APPLE_PRODUCT_IDS = new Set([APPLE_PRODUCT_MONTHLY, APPLE_PRODUCT_ANNUAL]);

export function isAppleProProductId(productId: string | null | undefined): boolean {
  return !!productId && APPLE_PRODUCT_IDS.has(productId);
}

export function appleCycleForProductId(productId: string): BillingCycle {
  return productId === APPLE_PRODUCT_ANNUAL ? "annually" : "monthly";
}

export function applePlanCodeForProductId(productId: string): "pro_monthly" | "pro_annually" {
  return appleCycleForProductId(productId) === "annually" ? "pro_annually" : "pro_monthly";
}

export function appleAmountUsdForProductId(productId: string): number {
  return appleCycleForProductId(productId) === "annually" ? APPLE_PRO_ANNUAL_USD : APPLE_PRO_MONTHLY_USD;
}

/** Apple `price` is milliunits (12990 → 12.99). Falls back to App Store list price. */
export function appleAmountUsdFromTransaction(args: {
  productId: string;
  priceMilliunits?: number | null;
  currency?: string | null;
}): number {
  const milli = args.priceMilliunits;
  if (typeof milli === "number" && Number.isFinite(milli) && milli > 0) {
    return Math.round(milli) / 1000;
  }
  return appleAmountUsdForProductId(args.productId);
}

export function appleInvoiceDescription(productId: string): string {
  return appleCycleForProductId(productId) === "annually"
    ? "Finsepa Pro — annual"
    : "Finsepa Pro — monthly";
}
