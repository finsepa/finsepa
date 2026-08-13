import "server-only";

import { PRO_ANNUAL_USD, PRO_MONTHLY_USD, type BillingCycle } from "@/lib/account/plan-pricing";

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
  return appleCycleForProductId(productId) === "annually" ? PRO_ANNUAL_USD : PRO_MONTHLY_USD;
}

export function appleInvoiceDescription(productId: string): string {
  return appleCycleForProductId(productId) === "annually"
    ? "Finsepa Pro — annual"
    : "Finsepa Pro — monthly";
}
