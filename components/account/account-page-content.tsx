"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { PATH_LOGIN } from "@/lib/auth/routes";
import { EMPTY_BILLING_SUMMARY, type BillingSummary } from "@/lib/account/billing";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { UserAvatar } from "@/components/user/user-avatar";
import { BillingUpgradeModal } from "@/components/account/billing-upgrade-modal";

export type AccountPageInitial = {
  email: string | null;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  userInitials: string;
};

const fieldClass =
  "h-10 w-full rounded-[10px] border border-[#E4E4E7] bg-[#F9FAFB] px-3 text-sm text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)] outline-none transition-all duration-100 placeholder:text-[#A1A1AA] focus:border-[#D4D4D8] focus:bg-white focus:shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06),0_0_0_4px_rgba(9,9,11,0.06)]";

const readOnlyFieldClass =
  "h-10 w-full cursor-default rounded-[10px] border border-[#E4E4E7] bg-[#F4F4F5] px-3 text-sm text-[#71717A] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)] outline-none";

type AccountTabId = "profile" | "billing";

const billingHistoryColLayout = "grid-cols-[120px_96px_minmax(0,2fr)] gap-x-2";

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-[#09090B]">
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
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [billingSummary, setBillingSummary] = useState<BillingSummary>(EMPTY_BILLING_SUMMARY);
  const [billingLoading, setBillingLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

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
      await supabase.auth.signOut();
      window.location.replace(PATH_LOGIN);
    } finally {
      setSigningOut(false);
    }
  }

  async function loadBillingSummary({ silent = false }: { silent?: boolean } = {}) {
    if (!silent) setBillingLoading(true);
    try {
      const res = await fetch("/api/account/billing/summary", { method: "GET" });
      if (!res.ok) throw new Error("Unable to load billing details.");
      const data = (await res.json()) as BillingSummary;
      setBillingSummary(data);
    } catch (error) {
      if (!silent) {
        const message = error instanceof Error ? error.message : "Unable to load billing details.";
        toast.error(message);
      }
    } finally {
      if (!silent) setBillingLoading(false);
    }
  }

  async function openManageSubscriptionPortal() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/account/billing/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Unable to open subscription portal.");
      }
      window.location.href = data.url;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to open subscription portal.";
      toast.error(message);
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

  const displayEmail = initial.email ?? "";
  const billingPlan = billingSummary.plan;
  const paymentHistory = billingSummary.paymentHistory;
  const subscriptionTitle = billingPlan === "pro" ? "Pro" : "Free Trial";
  const subscriptionMeta = billingSummary.subscriptionMeta;
  const actionLabel = billingPlan === "pro" ? "Manage Subscription" : "Upgrade to Pro";
  const recurringAmount =
    billingPlan === "pro" ? `$${billingSummary.recurringAmountUsd.toFixed(2)}` : "$0.00";
  const recurringMeta =
    billingPlan === "pro"
      ? billingSummary.recurringDueDate
        ? `Next payment on ${new Date(billingSummary.recurringDueDate).toLocaleDateString()}`
        : "Next payment date will appear soon."
      : "No upcoming payment while on free trial.";

  return (
    <div className="min-w-0 px-4 py-4 sm:px-9 sm:py-6">
      <div className="mx-auto w-full max-w-3xl">
        <div className="border-b border-[#E4E4E7]">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setActiveTab("profile")}
              className={`inline-block border-b-2 pb-3 text-sm font-semibold transition-colors ${
                activeTab === "profile"
                  ? "border-[#09090B] text-[#09090B]"
                  : "border-transparent text-[#71717A] hover:text-[#09090B]"
              }`}
            >
              Profile
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("billing")}
              className={`inline-block border-b-2 pb-3 text-sm font-semibold transition-colors ${
                activeTab === "billing"
                  ? "border-[#09090B] text-[#09090B]"
                  : "border-transparent text-[#71717A] hover:text-[#09090B]"
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
                <UserAvatar imageSrc={avatarPreview} initials={initial.userInitials} size="lg" />
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
                    className="h-10 rounded-[10px] bg-[#09090B] px-4 text-sm font-semibold text-white shadow-[0px_1px_2px_0px_rgba(10,10,10,0.12)] transition-colors hover:bg-[#18181B]"
                  >
                    Upload Image
                  </button>
                  <button
                    type="button"
                    onClick={onRemoveAvatar}
                    className="h-10 rounded-[10px] border border-[#E4E4E7] bg-white px-4 text-sm font-semibold text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-colors hover:bg-[#F4F4F5]"
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
            </section>

            <div className="flex flex-col-reverse gap-3 border-t border-[#E4E4E7] pt-8 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                disabled={signingOut}
                onClick={() => void handleSignOut()}
                className="h-10 w-full rounded-[10px] border border-[#E4E4E7] bg-white px-4 text-sm font-semibold text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-colors hover:bg-[#F4F4F5] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {signingOut ? "Logging out…" : "Log Out"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className="h-10 w-full rounded-[10px] bg-[#2563EB] px-6 text-sm font-semibold text-white shadow-[0px_1px_2px_0px_rgba(37,99,235,0.25)] transition-colors hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-8 space-y-8">
            <section className="grid gap-4 sm:grid-cols-2">
              <article className="rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]">
                <p className="text-[13px] font-medium text-[#71717A]">Your subscription</p>
                <p className="mt-2 text-[22px] font-semibold leading-7 text-[#09090B]">{subscriptionTitle}</p>
                <p className="mt-1 text-[14px] leading-5 text-[#71717A]">{subscriptionMeta}</p>
                <button
                  type="button"
                  onClick={() => {
                    if (billingPlan === "pro") {
                      void openManageSubscriptionPortal();
                      return;
                    }
                    setUpgradeModalOpen(true);
                  }}
                  disabled={portalLoading}
                  className="mt-4 h-10 rounded-[10px] bg-[#2563EB] px-4 text-sm font-semibold text-white shadow-[0px_1px_2px_0px_rgba(37,99,235,0.25)] transition-colors hover:bg-[#1D4ED8]"
                >
                  {portalLoading ? "Opening…" : actionLabel}
                </button>
              </article>

              <article className="rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]">
                <p className="text-[13px] font-medium text-[#71717A]">Payments</p>
                <p className="mt-2 text-[22px] font-semibold leading-7 text-[#09090B]">{recurringAmount}</p>
                <p className="mt-1 text-[14px] leading-5 text-[#71717A]">{recurringMeta}</p>
              </article>
            </section>

            <section className="rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]">
              <h3 className="text-[16px] font-semibold leading-6 text-[#09090B]">Payment history</h3>
              {billingLoading ? (
                <div className="mt-4 rounded-[10px] border border-dashed border-[#D4D4D8] bg-[#FAFAFA] px-4 py-8 text-center">
                  <p className="text-[14px] font-medium text-[#09090B]">Loading billing data…</p>
                </div>
              ) : paymentHistory.length === 0 ? (
                <div className="mt-4 rounded-[10px] border border-dashed border-[#D4D4D8] bg-[#FAFAFA] px-4 py-8 text-center">
                  <p className="text-[14px] font-medium text-[#09090B]">No payments yet</p>
                  <p className="mt-1 text-[13px] leading-5 text-[#71717A]">
                    Your payment history will appear here once your first charge is processed.
                  </p>
                </div>
              ) : (
                <div className="mt-4">
                  <div className="-mx-5 overflow-x-auto px-5 [-webkit-overflow-scrolling:touch]">
                    <div className="min-w-[560px] divide-y divide-[#E4E4E7] bg-white lg:min-w-0">
                      <div
                        className={`grid ${billingHistoryColLayout} min-h-[44px] items-center bg-white px-2 py-0 text-[12px] font-medium leading-5 text-[#71717A] sm:px-4 sm:text-[14px]`}
                      >
                        <div className="text-left">Date</div>
                        <div className="min-w-0 w-full text-right">Amount</div>
                        <div className="text-left">Description</div>
                      </div>

                      {paymentHistory.map((row) => (
                        <div
                          key={row.id}
                          className={`group grid ${billingHistoryColLayout} min-h-[56px] items-center bg-white px-2 transition-colors duration-75 hover:bg-neutral-50 sm:min-h-[60px] sm:px-4`}
                        >
                          <div className="whitespace-nowrap text-[14px] font-normal leading-5 text-[#09090B]">
                            {new Date(row.date).toLocaleDateString()}
                          </div>
                          <div className="min-w-0 w-full whitespace-nowrap text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-[#09090B]">
                            ${row.amountUsd.toFixed(2)}
                          </div>
                          <div className="min-w-0 truncate text-[14px] font-normal leading-5 text-[#09090B]">
                            {row.description}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
      <BillingUpgradeModal
        open={upgradeModalOpen}
        onClose={() => {
          setUpgradeModalOpen(false);
          void loadBillingSummary({ silent: true });
        }}
      />
    </div>
  );
}
