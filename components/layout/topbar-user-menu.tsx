"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleQuestionMark, CreditCard, LogOut, Menu, Sparkles, User } from "lucide-react";

import { BillingUpgradeModal } from "@/components/account/billing-upgrade-modal";
import {
  dropdownMenuPanelBodyClassName,
  dropdownMenuPlainItemClassName,
  dropdownMenuSurfaceClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { TopbarDelayedTooltip } from "@/components/layout/topbar-delayed-tooltip";
import { TopbarDropdownPortal } from "@/components/layout/topbar-dropdown-portal";
import { UserAvatar } from "@/components/user/user-avatar";
import { PATH_LOGIN } from "@/lib/auth/routes";
import {
  EMPTY_BILLING_SUMMARY,
  subscriptionTitleFromBillingSummary,
  type BillingSummary,
} from "@/lib/account/billing";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

type TopbarUserMenuProps = {
  userInitials: string;
  avatarUrl: string | null;
  /** Full name for menu header (same source as workspace listing owner). */
  userDisplayName: string;
  /** Days left in platform trial; shown after avatar on the menu trigger when &gt; 0. */
  platformTrialDaysLeft?: number | null;
};

export function TopbarUserMenu({
  userInitials,
  avatarUrl,
  userDisplayName,
  platformTrialDaysLeft = null,
}: TopbarUserMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [planLabel, setPlanLabel] = useState<string>(() =>
    subscriptionTitleFromBillingSummary(EMPTY_BILLING_SUMMARY),
  );
  const [planLoading, setPlanLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setPlanLoading(true);
      try {
        const res = await fetch("/api/account/billing/summary", { method: "GET", cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as BillingSummary;
        if (cancelled) return;
        setPlanLabel(subscriptionTitleFromBillingSummary(data));
      } catch {
        // ignore
      } finally {
        if (!cancelled) setPlanLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || menuPortalRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const showTrialCountdown =
    typeof platformTrialDaysLeft === "number" && platformTrialDaysLeft > 0;

  const showUpgradeMenuItem =
    showTrialCountdown ||
    (open && !planLoading && planLabel !== "Pro");

  const menuTriggerLabel = "Profile";

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.refresh();
      router.push(PATH_LOGIN);
    } finally {
      setSigningOut(false);
      setOpen(false);
    }
  }

  const itemClass = cn(dropdownMenuPlainItemClassName(), "font-medium no-underline");

  return (
    <div className="relative" ref={rootRef}>
      <TopbarDelayedTooltip label={menuTriggerLabel}>
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={menuTriggerLabel}
          onClick={() =>
            setOpen((v) => {
              const next = !v;
              if (next) setPlanLoading(true);
              return next;
            })
          }
          className={cn(
            // Mobile: match topbar icon buttons (Star / Plus) — icon only.
            "flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#E4E4E7] bg-white text-[#09090B]",
            "shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-all duration-100 hover:bg-[#F4F4F5]",
            // md+: keep the existing combined trigger (menu + avatar + trial text).
            "md:h-9 md:w-auto md:max-w-[min(100vw-10rem,280px)] md:min-w-0 md:justify-start md:gap-2 md:px-2",
          )}
        >
          <Menu className="h-5 w-5 shrink-0" aria-hidden />
          <span className="hidden md:inline-flex">
            <UserAvatar imageSrc={avatarUrl} initials={userInitials} size="sm" />
          </span>
          {showTrialCountdown ? (
            <span className="hidden min-w-0 shrink truncate text-xs font-semibold tabular-nums md:inline md:text-sm">
              {platformTrialDaysLeft} {platformTrialDaysLeft === 1 ? "day" : "days"} left
            </span>
          ) : null}
        </button>
      </TopbarDelayedTooltip>

      <TopbarDropdownPortal
        open={open}
        anchorRef={rootRef}
        ref={menuPortalRef}
        className="min-w-[240px] overflow-hidden"
      >
        <div role="menu" className={dropdownMenuSurfaceClassName()}>
          <div className="flex gap-3 border-b border-[#E4E4E7] px-3 py-3">
            <UserAvatar imageSrc={avatarUrl} initials={userInitials} size="menu" />
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="truncate text-sm font-semibold leading-5 text-[#09090B]">{userDisplayName}</div>
              <div className="mt-0.5 text-xs font-normal leading-4 text-[#52525B]">
                {planLoading ? (
                  <div className="h-3 w-20 animate-pulse rounded bg-[#E4E4E7]" />
                ) : (
                  planLabel
                )}
              </div>
            </div>
          </div>

          <div className={dropdownMenuPanelBodyClassName}>
            <Link
              href="/account"
              role="menuitem"
              className={itemClass}
              onClick={() => setOpen(false)}
            >
              <User className="h-4 w-4 shrink-0 text-[#09090B]" strokeWidth={1.75} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-left">Profile</span>
            </Link>
            <Link
              href="/account?tab=billing"
              role="menuitem"
              className={itemClass}
              onClick={() => setOpen(false)}
            >
              <CreditCard className="h-4 w-4 shrink-0 text-[#09090B]" strokeWidth={1.75} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-left">Billing</span>
            </Link>
            <a
              href="mailto:hi@finsepa.com"
              role="menuitem"
              className={itemClass}
              onClick={() => setOpen(false)}
            >
              <CircleQuestionMark className="h-4 w-4 shrink-0 text-[#09090B]" strokeWidth={1.75} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-left">Help</span>
            </a>
            <button
              type="button"
              role="menuitem"
              disabled={signingOut}
              onClick={() => void handleSignOut()}
              className={cn(itemClass, "disabled:cursor-not-allowed disabled:opacity-60")}
            >
              <LogOut className="h-4 w-4 shrink-0 text-[#09090B]" strokeWidth={1.75} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-left">
                {signingOut ? "Signing out…" : "Log out"}
              </span>
            </button>
          </div>
          {showUpgradeMenuItem && (
            <>
              <div className="border-t border-[#E4E4E7]" />
              <div className="px-3 py-3">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    setUpgradeModalOpen(true);
                  }}
                  className="flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] bg-[#2563EB] px-3.5 text-[13px] font-semibold text-white shadow-[0px_1px_2px_0px_rgba(37,99,235,0.2)] transition-colors hover:bg-[#1D4ED8]"
                >
                  <Sparkles className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
                  Upgrade to Pro
                </button>
              </div>
            </>
          )}
        </div>
      </TopbarDropdownPortal>

      <BillingUpgradeModal
        open={upgradeModalOpen}
        onClose={() => {
          setUpgradeModalOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
