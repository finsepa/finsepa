"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { loginAccountDeletedUrl, loginSignedOutUrl } from "@/lib/auth/routes";
import { signOutLocalSession } from "@/lib/auth/sign-out-local";
import {
  EMPTY_BILLING_SUMMARY,
  platformTrialEndsMetaLabel,
  subscriptionTitleFromBillingSummary,
  type BillingSummary,
} from "@/lib/account/billing";
import {
  invalidateBillingSummaryMenuCache,
  writeBillingSummaryMenuCache,
} from "@/lib/account/billing-summary-menu-cache";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { UserAvatar } from "@/components/user/user-avatar";
import { SpinnerLabel } from "@/components/ui/spinner";
import { ScreenerPagination } from "@/components/ui/table-pagination";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { CreditCard } from "@/lib/icons";
import { PATH_ACCOUNT_PLANS } from "@/lib/auth/routes";
import { openStripeBillingPortalWithToast } from "@/lib/account/billing-client";
import { AccountPasswordPlaceholder } from "@/components/account/account-password-placeholder";
import { ChangePasswordModal } from "@/components/account/change-password-modal";
import { DeleteAccountModal } from "@/components/account/delete-account-modal";
import {
  accentFillButtonClassName,
  invertedFillButtonClassName,
  secondaryOutlineButtonClassName,
  textInputFieldClassName,
} from "@/components/design-system";
import {
  DEFAULT_TABLE_ROW_HOVER_PAD_CLASS,
  SCREENER_TABLE_DATA_ROW_CLASS,
  SCREENER_TABLE_MOBILE_SURFACE_CLASS,
  SCREENER_TABLE_OUTER_BORDER_CLASS,
  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
  SCREENER_TABLE_STROKE_INSET_CLASS,
  TABLE_END_ALIGNED_PAD_CLASS,
  TABLE_START_ALIGNED_PAD_CLASS,
} from "@/components/screener/screener-table-scroll";
import { isEmailOtpEnabledClient } from "@/lib/auth/email-otp-public";
import { cn } from "@/lib/utils";

const EMAIL_OTP_ENABLED = isEmailOtpEnabledClient();

export type AccountPageInitial = {
  email: string | null;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  userInitials: string;
  canChangePassword: boolean;
};

/** Same field chrome as modal text inputs (`ClearableInput` / `--fs-field*`). */
const fieldClass = cn("w-full rounded-[10px] px-3 text-sm", textInputFieldClassName);

/** Non-editable account fields (email / password mask) — muted + not-allowed cursor. */
const readOnlyFieldClass = cn(
  fieldClass,
  "cursor-not-allowed opacity-60 text-fg-muted",
  "hover:outline-field-stroke focus:shadow-none focus:ring-0 dark:hover:outline-field-stroke dark:focus:ring-0",
);
type AccountTabId = "profile" | "billing";

const billingHistoryColLayout =
  "grid w-full min-w-0 grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-x-2";

const paymentHistoryTableChromeClass = cn(
  SCREENER_TABLE_MOBILE_SURFACE_CLASS,
  SCREENER_TABLE_OUTER_BORDER_CLASS,
);
const PAYMENT_HISTORY_PAGE_SIZE = 10;

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-fg">
      {children}
    </label>
  );
}

export function AccountPageContent({ initial }: { initial: AccountPageInitial }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<AccountTabId>("profile");
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initial.avatarUrl);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
  const [deleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false);
  const [billingSummary, setBillingSummary] = useState<BillingSummary>(EMPTY_BILLING_SUMMARY);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingHydrated, setBillingHydrated] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [paymentHistoryPage, setPaymentHistoryPage] = useState(1);
  const stripeCheckoutSuccessToastRef = useRef(false);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout !== "success") return;

    const sessionId = searchParams.get("session_id");

    const params = new URLSearchParams(searchParams.toString());
    params.delete("checkout");
    params.delete("session_id");
    const qs = params.toString();
    router.replace(qs ? `/account?${qs}` : "/account", { scroll: false });

    let shouldToast = false;
    if (sessionId) {
      const key = `finsepa_stripe_checkout_success:${sessionId}`;
      if (typeof window !== "undefined" && !sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        shouldToast = true;
      }
    } else if (!stripeCheckoutSuccessToastRef.current) {
      stripeCheckoutSuccessToastRef.current = true;
      shouldToast = true;
    }

    if (shouldToast) {
      toast.success("Congratulations! Your Pro access was activated.");
    }

    void (async () => {
      const { data } = await getSupabaseBrowserClient().auth.getUser();
      if (data.user) invalidateBillingSummaryMenuCache(data.user.id);
    })();
  }, [searchParams, router]);

  useEffect(() => {
    const tab = (searchParams.get("tab") ?? "").trim().toLowerCase();
    if (tab === "billing") {
      setActiveTab("billing");
      return;
    }
    if (tab === "profile") {
      setActiveTab("profile");
    }
  }, [searchParams]);

  useEffect(() => {
    setFirstName(initial.firstName);
    setLastName(initial.lastName);
    setAvatarPreview((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return initial.avatarUrl;
    });
    setAvatarFile(null);
    setAvatarRemoved(false);
    if (fileRef.current) fileRef.current.value = "";
  }, [initial.firstName, initial.lastName, initial.avatarUrl]);

  useEffect(() => {
    return () => {
      if (avatarPreview && avatarPreview.startsWith("blob:")) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  function onPickFile(f: File | null) {
    if (!f || !f.type.startsWith("image/")) return;
    setAvatarFile(f);
    setAvatarRemoved(false);
    setAvatarPreview((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
  }

  function onRemoveAvatar() {
    setAvatarFile(null);
    setAvatarRemoved(true);
    setAvatarPreview((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSave() {
    setSaving(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in.");

      const meta: Record<string, unknown> = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      };

      let photoNote: string | null = null;
      if (avatarRemoved) {
        meta.avatar_url = null;
      } else if (avatarFile) {
        const ext = avatarFile.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "jpg";
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("avatars").upload(path, avatarFile, {
          upsert: true,
        });
        if (!upErr) {
          const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
          meta.avatar_url = pub.publicUrl;
        } else {
          photoNote =
            "Profile saved, but the photo could not be uploaded (create a public “avatars” bucket in Supabase Storage).";
        }
      }

      const { error: metaErr } = await supabase.auth.updateUser({ data: meta });
      if (metaErr) throw metaErr;

      setAvatarFile(null);
      if (fileRef.current) fileRef.current.value = "";
      if (photoNote) {
        toast.warning("Profile saved", { description: photoNote });
      } else {
        toast.success("Changes saved.");
      }
      router.refresh();
    } catch (e: unknown) {
      const text = e instanceof Error ? e.message : "Something went wrong.";
      toast.error(text);
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await signOutLocalSession(supabase);
      window.location.replace(loginSignedOutUrl());
    } finally {
      setSigningOut(false);
    }
  }

  async function handleAccountDeleted() {
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.id) invalidateBillingSummaryMenuCache(user.id);
      await signOutLocalSession(supabase);
    } catch {
      /* session may already be invalid after server-side delete */
    }
    window.location.replace(loginAccountDeletedUrl());
  }

  async function loadBillingSummary({ silent = false }: { silent?: boolean } = {}) {
    if (!silent) setBillingLoading(true);
    try {
      const res = await fetch("/api/account/billing/summary", { method: "GET", cache: "no-store" });
      if (!res.ok) throw new Error("Unable to load billing details.");
      const data = (await res.json()) as BillingSummary;
      setBillingSummary(data);
      const { data: auth } = await getSupabaseBrowserClient().auth.getUser();
      if (auth.user) writeBillingSummaryMenuCache(auth.user.id, data);
    } catch (error) {
      if (!silent) {
        const message = error instanceof Error ? error.message : "Unable to load billing details.";
        toast.error(message);
      }
    } finally {
      if (!silent) setBillingLoading(false);
      setBillingHydrated(true);
    }
  }

  async function openManageSubscriptionPortal() {
    if (billingSummary.billingProvider === "apple") {
      toast.message("This Pro plan is billed through Apple. Manage or cancel it in iOS Settings → Apple ID → Subscriptions.");
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

  useEffect(() => {
    if (activeTab !== "billing") return;
    void loadBillingSummary();
    const timer = window.setInterval(() => {
      void loadBillingSummary({ silent: true });
    }, 15000);
    return () => window.clearInterval(timer);
  }, [activeTab]);

  const showBillingSkeleton = activeTab === "billing" && !billingHydrated;
  const displayEmail = initial.email ?? "";
  const billingPlan = billingSummary.plan;
  const billingAccessState = billingSummary.accessState;
  const paymentHistory = billingSummary.paymentHistory;
  const paymentHistoryTotalPages = Math.max(
    1,
    Math.ceil(paymentHistory.length / PAYMENT_HISTORY_PAGE_SIZE),
  );
  const safePaymentHistoryPage = Math.min(Math.max(1, paymentHistoryPage), paymentHistoryTotalPages);
  const pagedPaymentHistory = paymentHistory.slice(
    (safePaymentHistoryPage - 1) * PAYMENT_HISTORY_PAGE_SIZE,
    safePaymentHistoryPage * PAYMENT_HISTORY_PAGE_SIZE,
  );
  const subscriptionTitle = subscriptionTitleFromBillingSummary(billingSummary);
  const subscriptionMeta = billingSummary.subscriptionMeta;
  const isProScheduledCancellation =
    billingPlan === "pro" &&
    billingAccessState !== "paused" &&
    (billingAccessState === "canceled" ||
      billingSummary.cancelAtPeriodEnd ||
      subscriptionMeta === "Cancellation scheduled" ||
      subscriptionMeta === "Subscription ending");
  /** End of paid access: prefer API accessEndsAt; fall back to recurringDueDate when cancel is set but end ISO was missing. */
  const effectivePeriodEndIso =
    billingSummary.accessEndsAt && Number.isFinite(new Date(billingSummary.accessEndsAt).getTime())
      ? billingSummary.accessEndsAt
      : isProScheduledCancellation &&
          billingSummary.recurringDueDate &&
          Number.isFinite(new Date(billingSummary.recurringDueDate).getTime())
        ? billingSummary.recurringDueDate
        : null;
  const periodEndLabel =
    effectivePeriodEndIso && Number.isFinite(new Date(effectivePeriodEndIso).getTime())
      ? new Date(effectivePeriodEndIso).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null;
  const trialEndsLabel = platformTrialEndsMetaLabel(billingSummary.platformTrialEndsAt);
  const subscriptionStatusBelowTitle =
    isProScheduledCancellation && periodEndLabel
      ? `Active until ${periodEndLabel}`
      : billingAccessState === "trial" && trialEndsLabel
        ? trialEndsLabel
        : subscriptionMeta;
  const actionLabel = billingPlan === "pro" ? "Manage Subscription" : "Upgrade to Pro";
  const showManageOnPaymentCard = billingPlan === "pro";
  const showUpgradeOnPaymentCard = billingPlan !== "pro";
  const recurringAmount =
    billingPlan === "pro"
      ? billingAccessState === "paused"
        ? "$0.00"
        : `$${billingSummary.recurringAmountUsd.toFixed(2)}`
      : "$0.00";

  const billingResumeLabel =
    billingSummary.billingResumeAt && Number.isFinite(new Date(billingSummary.billingResumeAt).getTime())
      ? new Date(billingSummary.billingResumeAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null;

  const isEndingAfterPeriod =
    billingPlan === "pro" &&
    billingAccessState !== "paused" &&
    (billingAccessState === "canceled" ||
      billingSummary.cancelAtPeriodEnd ||
      subscriptionMeta === "Cancellation scheduled" ||
      subscriptionMeta === "Subscription ending");

  const recurringMeta =
    billingPlan === "pro"
      ? billingAccessState === "paused"
        ? billingResumeLabel
          ? `Billing is paused — no payment is due. Invoicing is scheduled to resume on ${billingResumeLabel}.`
          : "Billing is paused — no upcoming payment is scheduled."
        : isEndingAfterPeriod && periodEndLabel
          ? `You'll be switched to Free plan after ${periodEndLabel}.`
          : isEndingAfterPeriod
              ? "You'll be switched to Free plan after the current period — no further payment is scheduled."
              : billingSummary.recurringDueDate
                ? `Next payment on ${new Date(billingSummary.recurringDueDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}`
                : "Next payment date will appear soon."
      : billingAccessState === "trial_expired"
        ? "Your free trial has ended. Choose a plan to restore full access."
        : "No upcoming payment while on free trial.";

  return (
    <div className="min-w-0 px-4 py-4 sm:px-9 sm:py-6">
      <div className="mx-auto w-full max-w-3xl">
        <div className="border-b border-stroke">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setActiveTab("profile")}
              className={`inline-block border-b-2 pb-3 text-sm font-semibold transition-colors ${
                activeTab === "profile"
                  ? "border-fg text-fg"
                  : "border-transparent text-fg-muted hover:text-fg"
              }`}
            >
              Profile
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("billing")}
              className={`inline-block border-b-2 pb-3 text-sm font-semibold transition-colors ${
                activeTab === "billing"
                  ? "border-fg text-fg"
                  : "border-transparent text-fg-muted hover:text-fg"
              }`}
            >
              Billing
            </button>
          </div>
        </div>

        {activeTab === "profile" ? (
          <div className="mt-8 space-y-10">
            <section>
              <FieldLabel>Profile picture</FieldLabel>
              <div className="mt-2 flex flex-wrap items-center gap-4">
                <UserAvatar
                  imageSrc={avatarPreview}
                  initials={initial.userInitials}
                  size="lg"
                  showProBadge={billingPlan === "pro"}
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className={invertedFillButtonClassName}
                  >
                    Upload Image
                  </button>
                  <button
                    type="button"
                    onClick={onRemoveAvatar}
                    className={secondaryOutlineButtonClassName}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </section>

            <section className="grid gap-5 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="acct-first">First name</FieldLabel>
                <input
                  id="acct-first"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={fieldClass}
                  autoComplete="given-name"
                />
              </div>
              <div>
                <FieldLabel htmlFor="acct-last">Last name</FieldLabel>
                <input
                  id="acct-last"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={fieldClass}
                  autoComplete="family-name"
                />
              </div>
              <div className="sm:col-span-2">
                <FieldLabel htmlFor="acct-email">Email</FieldLabel>
                <input
                  id="acct-email"
                  type="email"
                  value={displayEmail}
                  readOnly
                  aria-readonly="true"
                  className={readOnlyFieldClass}
                  autoComplete="email"
                />
              </div>
              {!EMAIL_OTP_ENABLED ? (
                <div className="sm:col-span-2">
                  <FieldLabel htmlFor="acct-password">Password</FieldLabel>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <AccountPasswordPlaceholder id="acct-password" />
                    {initial.canChangePassword ? (
                      <button
                        type="button"
                        onClick={() => setChangePasswordModalOpen(true)}
                        className={cn(secondaryOutlineButtonClassName, "shrink-0 sm:w-auto")}
                      >
                        Change Password
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </section>

            <section className="rounded-xl border border-stroke bg-surface p-5 shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-06))]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-semibold leading-5 text-fg">Delete account</div>
                  <p className="mt-1 text-sm leading-5 text-fg-muted">
                    Permanently remove your account, portfolios, watchlists, and billing.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteAccountModalOpen(true)}
                  className={cn(
                    secondaryOutlineButtonClassName,
                    "w-full shrink-0 text-down hover:bg-down-soft hover:text-down sm:w-auto",
                  )}
                >
                  Delete account
                </button>
              </div>
            </section>

            <div className="flex flex-col-reverse gap-3 border-t border-stroke pt-8 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                disabled={signingOut}
                onClick={() => void handleSignOut()}
                className={cn(
                  secondaryOutlineButtonClassName,
                  "w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto",
                )}
              >
                {signingOut ? "Logging out…" : "Log Out"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className={cn(accentFillButtonClassName, "w-full sm:w-auto")}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            {(billingAccessState === "canceled" ||
              billingSummary.cancelAtPeriodEnd ||
              subscriptionMeta === "Cancellation scheduled" ||
              subscriptionMeta === "Subscription ending") &&
            periodEndLabel ? (
              <div className="rounded-xl border border-[#FDBA74] bg-[#FFF7ED] px-4 py-3 text-[#9A3412] shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-04))]">
                <div className="text-[14px] font-semibold leading-5">Pro subscription canceled</div>
                <div className="mt-1 text-[13px] leading-5">
                  You&apos;ve canceled your Pro subscription. You&apos;ll be switched to Free after{" "}
                  <span className="font-semibold">{periodEndLabel}</span>.
                </div>
              </div>
            ) : null}

            {billingAccessState === "paused" ? (
              <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 text-[#1E40AF] shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-04))]">
                <div className="text-[14px] font-semibold leading-5">Billing paused in Stripe</div>
                <div className="mt-1 text-[13px] leading-5">
                  Invoice collection is paused on your subscription, so no payment will be taken until billing resumes.
                  {billingResumeLabel ? (
                    <>
                      {" "}
                      Stripe is set to resume invoicing on{" "}
                      <span className="font-semibold">{billingResumeLabel}</span>.
                    </>
                  ) : null}{" "}
                  You can resume or change this anytime from Manage subscription.
                </div>
              </div>
            ) : null}

            {billingAccessState === "expired" ? (
              <section className="rounded-xl border border-stroke bg-surface p-5 shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-06))]">
                <div className="rounded-xl bg-surface-muted px-6 py-10 text-center">
                  <p className="text-[12px] font-medium leading-5 text-fg-muted">Join early access</p>
                  <div className="mx-auto mt-6 w-full max-w-[360px] rounded-2xl border border-stroke bg-surface p-6 shadow-[0px_10px_16px_-3px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-08)),0px_4px_6px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-03))]">
                    <div className="text-[18px] font-semibold leading-6 text-fg">Finsepa Pro</div>
                    <div className="mt-1 text-[13px] leading-5 text-fg-muted">
                      Your Pro access has ended. Upgrade to continue using Finsepa.
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push(PATH_ACCOUNT_PLANS)}
                      className="mt-6 h-10 w-full rounded-[10px] bg-fg px-6 text-sm font-semibold text-surface transition-colors hover:bg-[#18181B]"
                    >
                      Buy Pro
                    </button>
                  </div>
                </div>
              </section>
            ) : (
            <section className="grid gap-4 sm:grid-cols-2">
              {showBillingSkeleton ? (
                <>
                  <article className="rounded-xl border border-stroke bg-surface p-5 shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-06))]">
                    <div className="animate-pulse">
                      <div className="h-4 w-32 rounded bg-stroke" />
                      <div className="mt-3 h-7 w-24 rounded bg-stroke" />
                      <div className="mt-2 h-5 w-40 rounded bg-stroke" />
                      <div className="mt-4 h-10 w-44 rounded-[10px] bg-stroke" />
                    </div>
                  </article>
                  <article className="rounded-xl border border-stroke bg-surface p-5 shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-06))]">
                    <div className="animate-pulse">
                      <div className="h-4 w-20 rounded bg-stroke" />
                      <div className="mt-3 h-7 w-24 rounded bg-stroke" />
                      <div className="mt-2 h-5 w-56 rounded bg-stroke" />
                    </div>
                  </article>
                </>
              ) : (
                <>
                  <article className="rounded-xl border border-stroke bg-surface p-5 shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-06))]">
                    <p className="text-[13px] font-medium text-fg-muted">{subscriptionStatusBelowTitle}</p>
                    <p className="mt-2 text-[22px] font-semibold leading-7 text-fg">{subscriptionTitle}</p>
                    <button
                      type="button"
                      onClick={() => router.push(PATH_ACCOUNT_PLANS)}
                      className="mt-4 h-10 rounded-[10px] border border-stroke bg-surface px-4 text-sm font-semibold text-fg transition-colors hover:bg-surface-muted"
                    >
                      View plans
                    </button>
                  </article>

                  <article className="rounded-xl border border-stroke bg-surface p-5 shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-06))]">
                    <p className="text-[13px] font-medium text-fg-muted">{recurringMeta}</p>
                    <p className="mt-2 text-[22px] font-semibold leading-7 text-fg">{recurringAmount}</p>
                    {showManageOnPaymentCard ? (
                      <button
                        type="button"
                        onClick={() => void openManageSubscriptionPortal()}
                        disabled={portalLoading}
                        className="mt-4 h-10 rounded-[10px] bg-accent px-4 text-sm font-semibold text-white shadow-[0px_1px_2px_0px_rgba(37,99,235,0.25)] transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {portalLoading ? <SpinnerLabel>Opening…</SpinnerLabel> : "Manage Subscription"}
                      </button>
                    ) : null}
                    {showUpgradeOnPaymentCard ? (
                      <button
                        type="button"
                        onClick={() => router.push(PATH_ACCOUNT_PLANS)}
                        className="mt-4 h-10 rounded-[10px] bg-accent px-4 text-sm font-semibold text-white shadow-[0px_1px_2px_0px_rgba(37,99,235,0.25)] transition-colors hover:bg-accent-hover"
                      >
                        {actionLabel}
                      </button>
                    ) : null}
                  </article>
                </>
              )}
            </section>
            )}

            {billingAccessState === "expired" ? null : (
            <section>
              <h3 className="text-[16px] font-semibold leading-6 text-fg">Payment history</h3>
              {showBillingSkeleton || billingLoading ? (
                <div className={cn(paymentHistoryTableChromeClass, "mt-5")}>
                  <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
                    <div className="min-w-[560px] bg-surface lg:min-w-0">
                      <div className="bg-surface">
                        <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
                          <div
                            className={cn(
                              billingHistoryColLayout,
                              "min-h-[44px] text-[14px] font-medium leading-5 text-fg-muted",
                            )}
                          >
                            <div className={cn("text-left", TABLE_START_ALIGNED_PAD_CLASS)}>Date</div>
                            <div className={cn("min-w-0 w-full text-right", TABLE_END_ALIGNED_PAD_CLASS)}>
                              Amount
                            </div>
                            <div className={cn("text-right", TABLE_END_ALIGNED_PAD_CLASS)}>Plan</div>
                          </div>
                        </div>
                        <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
                      </div>

                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className={SCREENER_TABLE_DATA_ROW_CLASS}>
                          <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
                            <div
                              className={cn(
                                SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
                                billingHistoryColLayout,
                                "min-h-[56px] sm:min-h-[60px]",
                              )}
                            >
                              <div className={cn("animate-pulse", TABLE_START_ALIGNED_PAD_CLASS)}>
                                <div className="h-4 w-24 rounded bg-stroke" />
                              </div>
                              <div
                                className={cn(
                                  "flex justify-end animate-pulse",
                                  TABLE_END_ALIGNED_PAD_CLASS,
                                )}
                              >
                                <div className="h-4 w-16 rounded bg-stroke" />
                              </div>
                              <div
                                className={cn(
                                  "flex justify-end animate-pulse",
                                  TABLE_END_ALIGNED_PAD_CLASS,
                                )}
                              >
                                <div className="h-4 w-40 rounded bg-stroke" />
                              </div>
                            </div>
                          </div>
                          {i < 4 ? <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden /> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : paymentHistory.length === 0 ? (
                <div className={cn(paymentHistoryTableChromeClass, "mt-5")}>
                  <Empty variant="plain" className="min-h-0 py-8">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <CreditCard className="h-6 w-6" strokeWidth={1.75} aria-hidden />
                      </EmptyMedia>
                      <EmptyTitle>No payments yet</EmptyTitle>
                      <EmptyDescription>
                        Your payment history will appear here once your first charge is processed.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </div>
              ) : (
                <div className="mt-5">
                  <div className={paymentHistoryTableChromeClass}>
                    <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
                      <div className="min-w-[560px] bg-surface lg:min-w-0">
                        <div className="bg-surface">
                          <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
                            <div
                              className={cn(
                                billingHistoryColLayout,
                                "min-h-[44px] text-[14px] font-medium leading-5 text-fg-muted",
                              )}
                            >
                              <div className={cn("text-left", TABLE_START_ALIGNED_PAD_CLASS)}>Date</div>
                              <div className={cn("min-w-0 w-full text-right", TABLE_END_ALIGNED_PAD_CLASS)}>
                                Amount
                              </div>
                              <div className={cn("text-right", TABLE_END_ALIGNED_PAD_CLASS)}>Plan</div>
                            </div>
                          </div>
                          <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
                        </div>

                        {pagedPaymentHistory.map((row, i) => (
                          <div key={row.id} className={SCREENER_TABLE_DATA_ROW_CLASS}>
                            <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
                              <div
                                className={cn(
                                  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
                                  billingHistoryColLayout,
                                  "min-h-[56px] sm:min-h-[60px]",
                                )}
                              >
                                <div
                                  className={cn(
                                    "whitespace-nowrap text-[14px] font-normal leading-5 text-fg",
                                    TABLE_START_ALIGNED_PAD_CLASS,
                                  )}
                                >
                                  {new Date(row.date).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </div>
                                <div
                                  className={cn(
                                    "min-w-0 w-full whitespace-nowrap text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-fg",
                                    TABLE_END_ALIGNED_PAD_CLASS,
                                  )}
                                >
                                  ${row.amountUsd.toFixed(2)}
                                </div>
                                <div
                                  className={cn(
                                    "min-w-0 truncate text-right text-[14px] font-normal leading-5 text-fg",
                                    TABLE_END_ALIGNED_PAD_CLASS,
                                  )}
                                >
                                  Finsepa Pro
                                </div>
                              </div>
                            </div>
                            {i < pagedPaymentHistory.length - 1 ? (
                              <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <ScreenerPagination
                    page={safePaymentHistoryPage}
                    totalPages={paymentHistoryTotalPages}
                    onPageChange={setPaymentHistoryPage}
                    aria-label="Payment history page navigation"
                  />
                </div>
              )}
            </section>
            )}
          </div>
        )}
      </div>
      {!EMAIL_OTP_ENABLED ? (
        <ChangePasswordModal
          open={changePasswordModalOpen}
          onClose={() => setChangePasswordModalOpen(false)}
        />
      ) : null}
      <DeleteAccountModal
        open={deleteAccountModalOpen}
        onClose={() => setDeleteAccountModalOpen(false)}
        onDeleted={() => void handleAccountDeleted()}
      />
    </div>
  );
}
