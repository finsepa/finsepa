import { toast } from "sonner";

import type { BillingCycle } from "@/lib/account/plan-pricing";

/** Start Stripe Checkout for Pro. Throws on failure (after toast). */
export async function startStripeCheckout(cycle: BillingCycle): Promise<void> {
  const res = await fetch("/api/account/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cycle }),
  });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !data.url) {
    throw new Error(data.error || "Failed to start checkout.");
  }
  window.location.href = data.url;
}

export async function startStripeCheckoutWithToast(cycle: BillingCycle): Promise<void> {
  try {
    await startStripeCheckout(cycle);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start checkout.";
    toast.error(message);
    throw error;
  }
}

/** Open Stripe Customer Portal (manage payment method / cancel). */
export async function openStripeBillingPortal(): Promise<void> {
  const res = await fetch("/api/account/billing/portal", { method: "POST" });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !data.url) {
    throw new Error(data.error || "Unable to open subscription portal.");
  }
  window.location.href = data.url;
}

export async function openStripeBillingPortalWithToast(): Promise<void> {
  try {
    await openStripeBillingPortal();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to open subscription portal.";
    toast.error(message);
    throw error;
  }
}

/** Switch active Pro monthly ↔ annual (Stripe subscription update, prorated). */
export async function changeStripeBillingCycle(cycle: BillingCycle): Promise<void> {
  const res = await fetch("/api/account/billing/change-cycle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cycle }),
  });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Could not change billing cycle.");
  }
}

export async function changeStripeBillingCycleWithToast(cycle: BillingCycle): Promise<void> {
  try {
    await changeStripeBillingCycle(cycle);
    toast.success(
      cycle === "annually" ? "Switched to yearly billing." : "Switched to monthly billing.",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not change billing cycle.";
    toast.error(message);
    throw error;
  }
}
