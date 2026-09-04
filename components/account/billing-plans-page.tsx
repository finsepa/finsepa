"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  accentFillButtonClassName,
  secondaryFillButtonClassName,
  secondaryOutlineButtonClassName,
} from "@/components/design-system/secondary-button-styles";
import { SpinnerLabel } from "@/components/ui/spinner";
import {
  changeStripeBillingCycleWithToast,
  openStripeBillingPortalWithToast,
  startStripeCheckoutWithToast,
  toastAppleManageSubscription,
} from "@/lib/account/billing-client";
import {
  FREE_PLAN_CARD_FEATURES,
  PRO_PLAN_CARD_FEATURES,
} from "@/lib/account/plan-comparison";
import {
  type BillingCycle,
  proPriceForCycle,
  proPriceSuffix,
} from "@/lib/account/plan-pricing";
import { PATH_ACCOUNT, PATH_ACCOUNT_BILLING } from "@/lib/auth/routes";
import { cn } from "@/lib/utils";

export type BillingPlansViewState = {
  /** User is on paid Pro. */
  isPro: boolean;
  /** Paid Pro (not Free). */
  isTrial: boolean;
  /** Free limited plan. */
  isFree: boolean;
  planLabel: string;
  /** Active Pro billing cycle (`null` when not paid Pro). */
  activeCycle: BillingCycle | null;
  /** Pro is billed via App Store — manage/cancel on iOS, not Stripe. */
  billedByApple?: boolean;
  /** Pro is billed via Stripe on the web — manage/cancel in Billing, not App Store. */
  billedByWeb?: boolean;
  /** Actual recurring charge when on Pro (falls back to list price in UI). */
  recurringAmountUsd?: number | null;
};

const breadcrumbLinkClass =
  "min-w-0 truncate transition-colors hover:text-fg hover:underline";

const breadcrumbSep = (
  <span className="shrink-0 select-none" aria-hidden>
    /
  </span>
);

/** Matches stock/crypto/portfolio asset breadcrumbs. */
function PlansBreadcrumbs() {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 items-center px-4 py-3 text-[14px] text-fg-muted md:border-b md:border-stroke-shell sm:px-9"
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex-nowrap">
        <Link href={PATH_ACCOUNT} className={`shrink-0 ${breadcrumbLinkClass}`}>
          Account
        </Link>
        {breadcrumbSep}
        <Link href={PATH_ACCOUNT_BILLING} className={`shrink-0 ${breadcrumbLinkClass}`}>
          Billing
        </Link>
        {breadcrumbSep}
        <span className="min-w-0 truncate font-medium text-fg" aria-current="page">
          Plans
        </span>
      </div>
    </nav>
  );
}

function FeatureList({ features }: { features: readonly string[] }) {
  return (
    <ul className="mt-6 flex flex-col gap-3">
      {features.map((item) => (
        <li key={item} className="flex min-h-5 items-center gap-2.5">
          <Image
            src="/icons/finsepa-pro-check.svg"
            alt=""
            width={20}
            height={20}
            className="h-5 w-5 shrink-0"
            aria-hidden
          />
          <span
            className={cn(
              "text-[14px] leading-5 text-fg",
              item === "All Free features +" && "font-semibold",
            )}
          >
            {item}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Pill switch + label — Linear-style “Billed yearly” control. */
function BilledYearlyToggle({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label="Billed yearly"
      onClick={() => onCheckedChange(!checked)}
      className="group flex min-h-[22px] items-center gap-2.5 text-left"
    >
      <span
        className={cn(
          "relative h-[22px] w-[40px] shrink-0 rounded-full transition-colors duration-150",
          checked ? "bg-accent" : "bg-stroke",
        )}
      >
        <span
          className={cn(
            "absolute top-[3px] left-[3px] size-4 rounded-full bg-white shadow-sm transition-transform duration-150",
            checked && "translate-x-[18px]",
          )}
        />
      </span>
      <span className="text-[14px] leading-5 text-fg-muted">Billed yearly</span>
    </button>
  );
}

type ProPrimaryAction = "current" | "upgrade-cycle" | "downgrade-cycle" | "checkout";

export function BillingPlansPageClient({ plan }: { plan: BillingPlansViewState }) {
  const router = useRouter();
  const initialCycle: BillingCycle = plan.activeCycle ?? "monthly";
  const [cycle, setCycle] = useState<BillingCycle>(initialCycle);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [changeCycleLoading, setChangeCycleLoading] = useState(false);

  // After a cycle switch (router.refresh), re-sync toggle to the paid interval.
  useEffect(() => {
    if (plan.activeCycle) setCycle(plan.activeCycle);
  }, [plan.activeCycle]);

  const showWebBilledProManage = plan.isPro && plan.billedByWeb;

  const priceText = useMemo(() => {
    const listed = proPriceForCycle(cycle);
    const onActiveCycle = !plan.activeCycle || plan.activeCycle === cycle;
    const amount =
      showWebBilledProManage &&
      onActiveCycle &&
      typeof plan.recurringAmountUsd === "number" &&
      plan.recurringAmountUsd > 0
        ? plan.recurringAmountUsd
        : listed;
    return `$${amount.toFixed(2)}`;
  }, [cycle, plan.activeCycle, plan.recurringAmountUsd, showWebBilledProManage]);
  const suffixText = proPriceSuffix(cycle);
  const billedYearly = cycle === "annually";

  const proPrimaryAction: ProPrimaryAction = useMemo(() => {
    if (!plan.isPro) return "checkout";
    if (plan.billedByApple) return "current";
    const active = plan.activeCycle;
    if (!active || active === cycle) return "current";
    if (active === "monthly" && cycle === "annually") return "upgrade-cycle";
    if (active === "annually" && cycle === "monthly") return "downgrade-cycle";
    return "current";
  }, [plan.isPro, plan.billedByApple, plan.activeCycle, cycle]);

  const proPrimaryLabel =
    proPrimaryAction === "upgrade-cycle"
      ? plan.isPro
        ? "Switch to yearly"
        : "Get Pro"
      : proPrimaryAction === "downgrade-cycle"
        ? "Switch to monthly"
        : proPrimaryAction === "current"
          ? "Current plan"
          : "Get Pro";

  async function onUpgradeCheckout() {
    setCheckoutLoading(true);
    try {
      await startStripeCheckoutWithToast(cycle);
    } catch {
      /* toasted */
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function onManage() {
    if (plan.billedByApple) {
      toastAppleManageSubscription();
      return;
    }
    setPortalLoading(true);
    try {
      await openStripeBillingPortalWithToast();
    } catch {
      /* toasted */
    } finally {
      setPortalLoading(false);
    }
  }

  async function onChangeCycle() {
    setChangeCycleLoading(true);
    try {
      await changeStripeBillingCycleWithToast(cycle);
      router.refresh();
    } catch {
      /* toasted */
    } finally {
      setChangeCycleLoading(false);
    }
  }

  async function onProPrimary() {
    if (proPrimaryAction === "current") return;
    if (proPrimaryAction === "upgrade-cycle" || proPrimaryAction === "downgrade-cycle") {
      await onChangeCycle();
      return;
    }
    await onUpgradeCheckout();
  }

  const cycleActionBusy =
    (proPrimaryAction === "upgrade-cycle" || proPrimaryAction === "downgrade-cycle") &&
    changeCycleLoading;

  return (
    <div className="relative min-w-0">
      <PlansBreadcrumbs />
      <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-5 sm:px-9 sm:pt-6">
      <div className="grid gap-4 md:grid-cols-2 md:items-stretch">
        {/* Free */}
        <article
          className={cn(
            "flex h-full flex-col rounded-2xl border border-stroke bg-surface p-6 shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-06))]",
            plan.isFree && !plan.isPro ? "ring-1 ring-stroke" : "",
          )}
        >
          <p className="text-[15px] font-semibold text-fg">Free</p>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-[28px] font-bold leading-none tracking-tight text-fg sm:text-[32px]">
              $0
            </span>
            <span className="text-[14px] text-fg-muted">/ month</span>
          </div>

          <div className="mt-5 border-t border-stroke pt-4">
            <p className="flex min-h-[22px] items-center text-[14px] leading-5 text-fg-muted">
              Free for everyone
            </p>
          </div>

          <FeatureList features={FREE_PLAN_CARD_FEATURES} />

          <div className="mt-auto flex flex-col pt-8">
            {plan.isFree && !plan.isPro ? (
              <button
                type="button"
                disabled
                className={cn(
                  secondaryFillButtonClassName,
                  "w-full cursor-default pointer-events-none text-[13px] font-semibold leading-none text-fg-muted disabled:opacity-100",
                )}
              >
                Current plan
              </button>
            ) : plan.isPro ? (
              <button
                type="button"
                disabled={portalLoading}
                onClick={() => void onManage()}
                className={cn(secondaryOutlineButtonClassName, "w-full")}
              >
                {portalLoading ? <SpinnerLabel>Opening…</SpinnerLabel> : "Downgrade to Free"}
              </button>
            ) : (
              <Link
                href={PATH_ACCOUNT_BILLING}
                className={cn(secondaryOutlineButtonClassName, "flex w-full items-center justify-center")}
              >
                View billing
              </Link>
            )}
          </div>
        </article>

        {/* Pro */}
        <article
          className={cn(
            "relative flex h-full flex-col overflow-hidden rounded-2xl border border-stroke bg-surface p-6 shadow-[0px_8px_24px_-8px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-12))]",
          )}
        >
          {/* Traveling accent border — spun conic rim (visible over card edge). */}
          <span className="plan-card-border-trace rounded-2xl" aria-hidden />

          <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[15px] font-semibold text-fg">Pro</p>
              {plan.isPro ? (
                <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-semibold text-accent">
                  Current plan
                </span>
              ) : plan.isTrial ? (
                <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-[11px] font-semibold text-fg-muted">
                  Trial
                </span>
              ) : null}
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-[28px] font-bold leading-none tracking-tight text-fg sm:text-[32px]">
                {priceText}
              </span>
              <span className="text-[14px] text-fg-muted">{suffixText}</span>
            </div>

            <div className="mt-5 border-t border-stroke pt-4">
              <BilledYearlyToggle
                checked={billedYearly}
                onCheckedChange={(yearly) => setCycle(yearly ? "annually" : "monthly")}
              />
            </div>

            <FeatureList features={PRO_PLAN_CARD_FEATURES} />

            <div className="mt-auto flex flex-col gap-2 pt-8">
              {plan.isPro ? (
                showWebBilledProManage && proPrimaryAction === "current" ? (
                  <Link
                    href={PATH_ACCOUNT_BILLING}
                    className={cn(accentFillButtonClassName, "flex w-full items-center justify-center")}
                  >
                    Manage
                  </Link>
                ) : proPrimaryAction === "current" ? (
                  <button
                    type="button"
                    disabled
                    className={cn(
                      secondaryFillButtonClassName,
                      "w-full cursor-default pointer-events-none text-[13px] font-semibold leading-none text-fg-muted disabled:opacity-100",
                    )}
                  >
                    Current plan
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={cycleActionBusy}
                    onClick={() => void onProPrimary()}
                    className={cn(accentFillButtonClassName, "w-full")}
                  >
                    {cycleActionBusy ? <SpinnerLabel>Updating…</SpinnerLabel> : proPrimaryLabel}
                  </button>
                )
              ) : (
                <button
                  type="button"
                  disabled={checkoutLoading}
                  onClick={() => void onUpgradeCheckout()}
                  className={cn(accentFillButtonClassName, "w-full")}
                >
                  {checkoutLoading ? (
                    <SpinnerLabel>Redirecting…</SpinnerLabel>
                  ) : (
                    "Get Pro"
                  )}
                </button>
              )}
            </div>
          </div>
        </article>
      </div>

      <p className="mx-auto mt-10 max-w-xl text-center text-[14px] leading-6 text-fg-muted">
        Need help?{" "}
        <a
          href="mailto:hi@finsepa.com"
          className="font-medium text-fg underline-offset-2 hover:underline"
        >
          Contact us
        </a>
      </p>
      </div>
    </div>
  );
}
