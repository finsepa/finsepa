"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, Sparkles, User } from "@/lib/icons";

import { BillingUpgradeModal } from "@/components/account/billing-upgrade-modal";
import { DropdownMenuLottieIcon } from "@/components/icons/dropdown-menu-lottie-icon";
import { HelpFeedbackModal } from "@/components/layout/help-feedback-modal";
import {
  dropdownMenuPanelBodyClassName,
  dropdownMenuPlainItemClassName,
  dropdownMenuSurfaceClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { topbarSquircleActiveClass, topbarSquircleIconClass } from "@/components/design-system/topbar-control-classes";
import { TopbarDelayedTooltip } from "@/components/layout/topbar-delayed-tooltip";
import { TopbarDropdownPortal } from "@/components/layout/topbar-dropdown-portal";
import { UserAvatar } from "@/components/user/user-avatar";
import {
  billingMenuIconAnimation,
  helpMenuIconAnimation,
  logoutMenuIconAnimation,
  profileMenuIconAnimation,
} from "@/lib/lottie/menu-icon-animations";
import { PATH_APP_ENTRY, loginSignedOutUrl } from "@/lib/auth/routes";
import {
  EMPTY_BILLING_SUMMARY,
  subscriptionTitleFromBillingSummary,
  type BillingSummary,
} from "@/lib/account/billing";
import {
  invalidateBillingSummaryMenuCache,
  isBillingSummaryMenuCacheFresh,
  readBillingSummaryMenuCache,
  writeBillingSummaryMenuCache,
} from "@/lib/account/billing-summary-menu-cache";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

type TopbarUserMenuProps = {
  userId: string;
  userInitials: string;
  avatarUrl: string | null;
  /** Full name for menu header (same source as workspace listing owner). */
  userDisplayName: string;
  /** Days left in platform trial; shown after avatar on the menu trigger when &gt; 0. */
  platformTrialDaysLeft?: number | null;
  triggerClassName?: string;
};

export function TopbarUserMenu({
  userId,
  userInitials,
  avatarUrl,
  userDisplayName,
  platformTrialDaysLeft = null,
  triggerClassName,
}: TopbarUserMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [planLabel, setPlanLabel] = useState<string>(() =>
    subscriptionTitleFromBillingSummary(EMPTY_BILLING_SUMMARY),
  );
  const [isPro, setIsPro] = useState(false);
  const [profileIconPlaying, setProfileIconPlaying] = useState(false);
  const [billingIconPlaying, setBillingIconPlaying] = useState(false);
  const [helpIconPlaying, setHelpIconPlaying] = useState(false);
  const [logoutIconPlaying, setLogoutIconPlaying] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);

  const applyBillingSummary = useCallback((summary: BillingSummary) => {
    setPlanLabel(subscriptionTitleFromBillingSummary(summary));
    setIsPro(summary.plan === "pro");
  }, []);

  const fetchBillingSummaryForMenu = useCallback(
    async (opts: { showSkeleton: boolean }) => {
      if (opts.showSkeleton) setPlanLoading(true);
      try {
        const res = await fetch("/api/account/billing/summary", { method: "GET", cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as BillingSummary;
        writeBillingSummaryMenuCache(userId, data);
        applyBillingSummary(data);
      } catch {
        // ignore
      } finally {
        if (opts.showSkeleton) setPlanLoading(false);
      }
    },
    [userId, applyBillingSummary],
  );

  /** Warm label + Pro badge from local cache so the menu rarely flashes a skeleton on open. */
  useEffect(() => {
    const hit = readBillingSummaryMenuCache(userId);
    if (hit) applyBillingSummary(hit.summary);
  }, [userId, applyBillingSummary]);

  useEffect(() => {
    const cached = readBillingSummaryMenuCache(userId);
    if (cached && isBillingSummaryMenuCacheFresh(cached.fetchedAt)) return;
    if (cached) {
      void fetchBillingSummaryForMenu({ showSkeleton: false });
      return;
    }
    void fetchBillingSummaryForMenu({ showSkeleton: false });
  }, [userId, fetchBillingSummaryForMenu]);

  useEffect(() => {
    if (!open) return;

    const cached = readBillingSummaryMenuCache(userId);

    if (cached && isBillingSummaryMenuCacheFresh(cached.fetchedAt)) {
      applyBillingSummary(cached.summary);
      return;
    }

    if (cached) {
      applyBillingSummary(cached.summary);
      void fetchBillingSummaryForMenu({ showSkeleton: false });
      return;
    }

    void fetchBillingSummaryForMenu({ showSkeleton: true });
  }, [open, userId, fetchBillingSummaryForMenu, applyBillingSummary]);

  useEffect(() => {
    if (!open) {
      setProfileIconPlaying(false);
      setBillingIconPlaying(false);
      setHelpIconPlaying(false);
      setLogoutIconPlaying(false);
    }
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
      window.location.replace(loginSignedOutUrl());
    } finally {
      setSigningOut(false);
      setOpen(false);
    }
  }

  const itemClass = cn(dropdownMenuPlainItemClassName(), "font-medium no-underline");

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <TopbarDelayedTooltip label={menuTriggerLabel}>
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={menuTriggerLabel}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            triggerClassName ?? topbarSquircleIconClass,
            open && topbarSquircleActiveClass,
            // md+: menu icon + avatar + trial text; mobile: user icon in squircle.
            !triggerClassName &&
              "md:h-9 md:w-auto md:max-w-[min(100vw-10rem,280px)] md:min-w-0 md:justify-start md:gap-2 md:px-2",
          )}
        >
          <Menu className="hidden h-5 w-5 shrink-0 md:block" aria-hidden />
          <User className="h-5 w-5 shrink-0 md:hidden" strokeWidth={1.75} aria-hidden />
          <span className="hidden md:inline-flex">
            <UserAvatar imageSrc={avatarUrl} initials={userInitials} size="sm" showProBadge={isPro} />
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
        onRequestClose={() => setOpen(false)}
        className={cn(dropdownMenuSurfaceClassName(), "min-w-[240px] overflow-hidden max-md:!border-0 max-md:!shadow-none")}
      >
        <div role="menu">
          <div className="flex gap-3 border-b border-[#E4E4E7] px-3 py-3 max-md:border-b-0">
            <UserAvatar imageSrc={avatarUrl} initials={userInitials} size="menu" showProBadge={isPro} />
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
              onMouseEnter={() => setProfileIconPlaying(true)}
              onMouseLeave={() => setProfileIconPlaying(false)}
              onFocus={() => setProfileIconPlaying(true)}
              onBlur={() => setProfileIconPlaying(false)}
            >
              <DropdownMenuLottieIcon
                animationData={profileMenuIconAnimation}
                playing={profileIconPlaying}
              />
              <span className="min-w-0 flex-1 truncate text-left">Profile</span>
            </Link>
            <Link
              href="/account?tab=billing"
              role="menuitem"
              className={itemClass}
              onClick={() => setOpen(false)}
              onMouseEnter={() => setBillingIconPlaying(true)}
              onMouseLeave={() => setBillingIconPlaying(false)}
              onFocus={() => setBillingIconPlaying(true)}
              onBlur={() => setBillingIconPlaying(false)}
            >
              <DropdownMenuLottieIcon
                animationData={billingMenuIconAnimation}
                playing={billingIconPlaying}
              />
              <span className="min-w-0 flex-1 truncate text-left">Billing</span>
            </Link>
            <button
              type="button"
              role="menuitem"
              className={itemClass}
              onMouseEnter={() => setHelpIconPlaying(true)}
              onMouseLeave={() => setHelpIconPlaying(false)}
              onFocus={() => setHelpIconPlaying(true)}
              onBlur={() => setHelpIconPlaying(false)}
              onClick={() => {
                setOpen(false);
                setHelpModalOpen(true);
              }}
            >
              <DropdownMenuLottieIcon animationData={helpMenuIconAnimation} playing={helpIconPlaying} />
              <span className="min-w-0 flex-1 truncate text-left">Help</span>
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={signingOut}
              onMouseEnter={() => setLogoutIconPlaying(true)}
              onMouseLeave={() => setLogoutIconPlaying(false)}
              onFocus={() => setLogoutIconPlaying(true)}
              onBlur={() => setLogoutIconPlaying(false)}
              onClick={() => void handleSignOut()}
              className={cn(itemClass, "disabled:cursor-not-allowed disabled:opacity-60")}
            >
              <DropdownMenuLottieIcon
                animationData={logoutMenuIconAnimation}
                playing={logoutIconPlaying}
              />
              <span className="min-w-0 flex-1 truncate text-left">
                {signingOut ? "Signing out…" : "Log out"}
              </span>
            </button>
          </div>
          {showUpgradeMenuItem && (
            <>
              <div className="border-t border-[#E4E4E7] md:hidden" />
              <div className="px-3 py-3 md:hidden">
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
                  Upgrade
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
          invalidateBillingSummaryMenuCache(userId);
          void fetchBillingSummaryForMenu({ showSkeleton: false });
          router.refresh();
        }}
      />

      <HelpFeedbackModal open={helpModalOpen} onClose={() => setHelpModalOpen(false)} />
    </div>
  );
}
