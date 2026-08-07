"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Check, ChevronRight, Menu, Sparkles, User } from "@/lib/icons";

import { DropdownMenuLottieIcon } from "@/components/icons/dropdown-menu-lottie-icon";
import { HelpFeedbackModal } from "@/components/layout/help-feedback-modal";
import {
  dropdownMenuPanelBodyClassName,
  dropdownMenuPlainItemClassName,
  dropdownMenuPlainItemRowClassName,
  dropdownMenuSurfaceClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { topbarSquircleActiveClass, topbarSquircleIconClass } from "@/components/design-system/topbar-control-classes";
import { TopbarDelayedTooltip } from "@/components/layout/topbar-delayed-tooltip";
import { TopbarDropdownPortal } from "@/components/layout/topbar-dropdown-portal";
import { UserAvatar } from "@/components/user/user-avatar";
import {
  appearanceMenuIconAnimation,
  billingMenuIconAnimation,
  emailMenuIconAnimation,
  helpMenuIconAnimation,
  logoutMenuIconAnimation,
  profileMenuIconAnimation,
  telegramMenuIconAnimation,
  themeDarkMenuIconAnimation,
  themeLightMenuIconAnimation,
  themeSystemMenuIconAnimation,
  whatsappMenuIconAnimation,
} from "@/lib/lottie/menu-icon-animations";
import { toastProUpgrade } from "@/lib/account/toast-pro-upgrade";
import { ProFeatureBadge } from "@/components/account/pro-feature-badge";
import { loginSignedOutUrl, PATH_ACCOUNT_PLANS } from "@/lib/auth/routes";
import { signOutLocalSession } from "@/lib/auth/sign-out-local";
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
import { useMobileSheet } from "@/lib/layout/use-mobile-sheet";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

type ThemeChoice = "light" | "dark" | "system";

const THEME_OPTIONS: {
  value: ThemeChoice;
  label: string;
  animationData: unknown;
}[] = [
  { value: "light", label: "Light", animationData: themeLightMenuIconAnimation },
  { value: "dark", label: "Dark", animationData: themeDarkMenuIconAnimation },
  { value: "system", label: "System", animationData: themeSystemMenuIconAnimation },
];

function themeChoiceLabel(theme: string | undefined): string {
  if (theme === "light") return "Light";
  if (theme === "dark") return "Dark";
  return "System";
}

/** Support WhatsApp (international, no + in wa.me path). */
const HELP_WHATSAPP_E164 = "447568222195";
const HELP_WHATSAPP_URL = `https://wa.me/${HELP_WHATSAPP_E164}`;
const HELP_TELEGRAM_URL = "https://t.me/finsepa_support";

type TopbarUserMenuProps = {
  userId: string;
  userInitials: string;
  avatarUrl: string | null;
  /** Full name for menu header (same source as workspace listing owner). */
  userDisplayName: string;
  /** Days left in platform trial; shown after avatar on the menu trigger when &gt; 0. */
  platformTrialDaysLeft?: number | null;
  /** Server-known paid Pro — correct badge / plan label on first paint. */
  isPro?: boolean;
  triggerClassName?: string;
};

export function TopbarUserMenu({
  userId,
  userInitials,
  avatarUrl,
  userDisplayName,
  platformTrialDaysLeft = null,
  isPro: isProFromServer = false,
  triggerClassName,
}: TopbarUserMenuProps) {
  const router = useRouter();
  const isMobileSheet = useMobileSheet();
  const { theme, setTheme } = useTheme();
  const [themeReady, setThemeReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [planLabel, setPlanLabel] = useState<string>(() =>
    isProFromServer ? "Pro" : subscriptionTitleFromBillingSummary(EMPTY_BILLING_SUMMARY),
  );
  const [billingPlan, setBillingPlan] = useState<BillingSummary["plan"]>(() =>
    isProFromServer ? "pro" : EMPTY_BILLING_SUMMARY.plan,
  );
  const [isPro, setIsPro] = useState(isProFromServer);
  const [profileIconPlaying, setProfileIconPlaying] = useState(false);
  const [billingIconPlaying, setBillingIconPlaying] = useState(false);
  const [helpIconPlaying, setHelpIconPlaying] = useState(false);
  const [appearanceIconPlaying, setAppearanceIconPlaying] = useState(false);
  const [hoveredTheme, setHoveredTheme] = useState<ThemeChoice | null>(null);
  const [hoveredHelpOption, setHoveredHelpOption] = useState<"whatsapp" | "telegram" | "email" | null>(
    null,
  );
  const [logoutIconPlaying, setLogoutIconPlaying] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);
  const appearanceTriggerRef = useRef<HTMLButtonElement>(null);
  const appearancePortalRef = useRef<HTMLDivElement>(null);
  const appearanceLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [appearancePos, setAppearancePos] = useState<{ top: number; right: number } | null>(null);
  const helpTriggerRef = useRef<HTMLButtonElement>(null);
  const helpPortalRef = useRef<HTMLDivElement>(null);
  const helpLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [helpPos, setHelpPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    setThemeReady(true);
  }, []);

  const applyBillingSummary = useCallback((summary: BillingSummary) => {
    setBillingPlan(summary.plan);
    setPlanLabel(subscriptionTitleFromBillingSummary(summary));
    // Never let a stale "trial" cache clear a server-known Pro badge.
    setIsPro((prev) => isProFromServer || prev || summary.plan === "pro");
    if (summary.plan === "pro") setPlanLabel("Pro");
  }, [isProFromServer]);

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
    setIsPro(isProFromServer);
    if (isProFromServer) {
      setPlanLabel("Pro");
      setBillingPlan("pro");
    }
  }, [isProFromServer]);

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
      setAppearanceIconPlaying(false);
      setLogoutIconPlaying(false);
      setHoveredHelpOption(null);
      setAppearanceOpen(false);
      setHelpOpen(false);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (appearanceLeaveTimerRef.current) clearTimeout(appearanceLeaveTimerRef.current);
      if (helpLeaveTimerRef.current) clearTimeout(helpLeaveTimerRef.current);
    };
  }, []);

  useLayoutEffect(() => {
    if (!appearanceOpen || isMobileSheet) {
      setAppearancePos(null);
      return;
    }
    function updatePos() {
      const el = appearanceTriggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setAppearancePos({
        top: rect.top,
        right: window.innerWidth - rect.left + 4,
      });
    }
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [appearanceOpen, isMobileSheet]);

  useLayoutEffect(() => {
    if (!helpOpen || isMobileSheet) {
      setHelpPos(null);
      return;
    }
    function updatePos() {
      const el = helpTriggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setHelpPos({
        top: rect.top,
        right: window.innerWidth - rect.left + 4,
      });
    }
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [helpOpen, isMobileSheet]);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: globalThis.MouseEvent) {
      const t = e.target as Node;
      if (
        rootRef.current?.contains(t) ||
        menuPortalRef.current?.contains(t) ||
        appearancePortalRef.current?.contains(t) ||
        helpPortalRef.current?.contains(t)
      ) {
        return;
      }
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (helpOpen) {
          setHelpOpen(false);
          return;
        }
        if (appearanceOpen) {
          setAppearanceOpen(false);
          return;
        }
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, appearanceOpen, helpOpen]);

  const showTrialCountdown =
    !isProFromServer &&
    !isPro &&
    typeof platformTrialDaysLeft === "number" &&
    platformTrialDaysLeft > 0;

  const showUpgradeMenuItem =
    !isProFromServer &&
    !isPro &&
    planLabel !== "Pro" &&
    (showTrialCountdown || (open && !planLoading));

  /** Live chat: Pro + Trial. Free only sees Pro badge + upgrade gate. */
  const canUseLiveChat =
    isProFromServer ||
    isPro ||
    billingPlan === "pro" ||
    billingPlan === "trial" ||
    showTrialCountdown;
  const showLiveChatProBadge = !canUseLiveChat;

  const menuTriggerLabel = "Profile";
  const activeTheme = (themeReady ? theme : "system") as ThemeChoice | undefined;
  const appearanceValueLabel = themeChoiceLabel(activeTheme);

  // Stable class string (no `cn`/`twMerge`) — topbar chrome mismatches SSR vs client otherwise.
  const triggerChrome = triggerClassName ?? topbarSquircleIconClass;
  const triggerResponsive = triggerClassName
    ? ""
    : " md:h-9 md:w-auto md:max-w-[min(100vw-10rem,280px)] md:min-w-0 md:justify-start md:gap-2 md:px-2";
  const triggerClassNameResolved = open
    ? `${triggerChrome}${triggerResponsive} ${topbarSquircleActiveClass}`
    : `${triggerChrome}${triggerResponsive}`;

  function clearAppearanceLeaveTimer() {
    if (appearanceLeaveTimerRef.current) {
      clearTimeout(appearanceLeaveTimerRef.current);
      appearanceLeaveTimerRef.current = null;
    }
  }

  function clearHelpLeaveTimer() {
    if (helpLeaveTimerRef.current) {
      clearTimeout(helpLeaveTimerRef.current);
      helpLeaveTimerRef.current = null;
    }
  }

  function openAppearanceSubmenu() {
    clearAppearanceLeaveTimer();
    clearHelpLeaveTimer();
    setHelpOpen(false);
    setAppearanceOpen(true);
  }

  function scheduleCloseAppearanceSubmenu() {
    clearAppearanceLeaveTimer();
    appearanceLeaveTimerRef.current = setTimeout(() => setAppearanceOpen(false), 120);
  }

  function openHelpSubmenu() {
    clearHelpLeaveTimer();
    clearAppearanceLeaveTimer();
    setAppearanceOpen(false);
    setHelpOpen(true);
  }

  function scheduleCloseHelpSubmenu() {
    clearHelpLeaveTimer();
    helpLeaveTimerRef.current = setTimeout(() => setHelpOpen(false), 120);
  }

  function selectTheme(next: ThemeChoice) {
    setTheme(next);
    setAppearanceOpen(false);
  }

  function openHelpEmail() {
    setHelpOpen(false);
    setOpen(false);
    setHelpModalOpen(true);
  }

  function gateLiveChatOrAllow(e: ReactMouseEvent, channel: "WhatsApp" | "Telegram") {
    if (canUseLiveChat) {
      setHelpOpen(false);
      setOpen(false);
      return;
    }
    e.preventDefault();
    setHelpOpen(false);
    setOpen(false);
    toastProUpgrade({
      title: "Pro feature",
      description: `${channel} chat support is available on Pro only.`,
      onUpgrade: () => router.push(PATH_ACCOUNT_PLANS),
    });
  }

  const proMenuBadge = <ProFeatureBadge label="Available on Pro only" />;

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await signOutLocalSession(supabase);
      window.location.replace(loginSignedOutUrl());
    } finally {
      setSigningOut(false);
      setOpen(false);
    }
  }

  const itemClass = cn(dropdownMenuPlainItemClassName(), "font-medium no-underline");

  const themeOptionButtons = (
    <>
      {THEME_OPTIONS.map((opt) => {
        const selected = (activeTheme ?? "system") === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="menuitemradio"
            aria-checked={selected}
            className={cn(dropdownMenuPlainItemRowClassName({ selected }), "font-medium")}
            onMouseEnter={() => setHoveredTheme(opt.value)}
            onMouseLeave={() => setHoveredTheme(null)}
            onFocus={() => setHoveredTheme(opt.value)}
            onBlur={() => setHoveredTheme(null)}
            onClick={() => selectTheme(opt.value)}
          >
            <span className="flex min-w-0 items-center gap-2">
              <DropdownMenuLottieIcon
                animationData={opt.animationData}
                playing={hoveredTheme === opt.value}
              />
              <span className="min-w-0 truncate text-left">{opt.label}</span>
            </span>
            {selected ? <Check className="size-4 shrink-0 text-fg" strokeWidth={2} aria-hidden /> : <span className="size-4" />}
          </button>
        );
      })}
    </>
  );

  const helpOptionButtons = (
    <>
      <a
        href={canUseLiveChat ? HELP_WHATSAPP_URL : undefined}
        target={canUseLiveChat ? "_blank" : undefined}
        rel={canUseLiveChat ? "noopener noreferrer" : undefined}
        role="menuitem"
        aria-label={
          canUseLiveChat
            ? "Chat on WhatsApp"
            : "Chat on WhatsApp (Pro)"
        }
        className={cn(itemClass, "no-underline", showLiveChatProBadge && "opacity-40")}
        onMouseEnter={() => setHoveredHelpOption("whatsapp")}
        onMouseLeave={() => setHoveredHelpOption(null)}
        onFocus={() => setHoveredHelpOption("whatsapp")}
        onBlur={() => setHoveredHelpOption(null)}
        onClick={(e) => gateLiveChatOrAllow(e, "WhatsApp")}
      >
        <DropdownMenuLottieIcon
          animationData={whatsappMenuIconAnimation}
          playing={hoveredHelpOption === "whatsapp"}
        />
        <span className="min-w-0 flex-1 truncate text-left">Chat on WhatsApp</span>
        {showLiveChatProBadge ? proMenuBadge : null}
      </a>
      <a
        href={canUseLiveChat ? HELP_TELEGRAM_URL : undefined}
        target={canUseLiveChat ? "_blank" : undefined}
        rel={canUseLiveChat ? "noopener noreferrer" : undefined}
        role="menuitem"
        aria-label={
          canUseLiveChat
            ? "Chat on Telegram"
            : "Chat on Telegram (Pro)"
        }
        className={cn(itemClass, "no-underline", showLiveChatProBadge && "opacity-40")}
        onMouseEnter={() => setHoveredHelpOption("telegram")}
        onMouseLeave={() => setHoveredHelpOption(null)}
        onFocus={() => setHoveredHelpOption("telegram")}
        onBlur={() => setHoveredHelpOption(null)}
        onClick={(e) => gateLiveChatOrAllow(e, "Telegram")}
      >
        <DropdownMenuLottieIcon
          animationData={telegramMenuIconAnimation}
          playing={hoveredHelpOption === "telegram"}
        />
        <span className="min-w-0 flex-1 truncate text-left">Chat on Telegram</span>
        {showLiveChatProBadge ? proMenuBadge : null}
      </a>
      <button
        type="button"
        role="menuitem"
        className={itemClass}
        onMouseEnter={() => setHoveredHelpOption("email")}
        onMouseLeave={() => setHoveredHelpOption(null)}
        onFocus={() => setHoveredHelpOption("email")}
        onBlur={() => setHoveredHelpOption(null)}
        onClick={openHelpEmail}
      >
        <DropdownMenuLottieIcon
          animationData={emailMenuIconAnimation}
          playing={hoveredHelpOption === "email"}
        />
        <span className="min-w-0 flex-1 truncate text-left">Send Email</span>
      </button>
    </>
  );

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <TopbarDelayedTooltip label={menuTriggerLabel}>
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={menuTriggerLabel}
          suppressHydrationWarning
          onClick={() => setOpen((v) => !v)}
          className={triggerClassNameResolved}
        >
          <Menu className="hidden h-5 w-5 shrink-0 md:block" aria-hidden />
          <User className="h-5 w-5 shrink-0 md:hidden" strokeWidth={1.75} aria-hidden />
          <span className="hidden md:inline-flex">
            <UserAvatar
              imageSrc={avatarUrl}
              initials={userInitials}
              size="sm"
              showProBadge={isProFromServer || isPro}
            />
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
        className={cn(dropdownMenuSurfaceClassName(), "min-w-[240px] overflow-visible")}
      >
        <div role="menu">
          <div className="flex gap-3 border-b border-dropdown-divider px-3 py-3">
            <UserAvatar
              imageSrc={avatarUrl}
              initials={userInitials}
              size="menu"
              showProBadge={isProFromServer || isPro}
            />
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="truncate text-sm font-semibold leading-5 text-fg">{userDisplayName}</div>
              <div className="mt-0.5 text-xs font-normal leading-4 text-fg-muted">
                {planLoading && !(isProFromServer || isPro) ? (
                  <div className="h-3 w-20 animate-pulse rounded bg-stroke" />
                ) : (
                  isProFromServer || isPro ? "Pro" : planLabel
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
            <div
              className="relative"
              onMouseEnter={() => {
                if (!isMobileSheet) openHelpSubmenu();
              }}
              onMouseLeave={() => {
                if (!isMobileSheet) scheduleCloseHelpSubmenu();
              }}
            >
              <button
                ref={helpTriggerRef}
                type="button"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={helpOpen}
                className={cn(itemClass, helpOpen && "bg-dropdown-item-hover")}
                onMouseEnter={() => setHelpIconPlaying(true)}
                onMouseLeave={() => setHelpIconPlaying(false)}
                onFocus={() => setHelpIconPlaying(true)}
                onBlur={() => setHelpIconPlaying(false)}
                onClick={() => {
                  if (isMobileSheet) {
                    setAppearanceOpen(false);
                    setHelpOpen((v) => !v);
                    return;
                  }
                  openHelpSubmenu();
                }}
              >
                <DropdownMenuLottieIcon
                  animationData={helpMenuIconAnimation}
                  playing={helpIconPlaying || helpOpen}
                />
                <span className="min-w-0 flex-1 truncate text-left">Help</span>
                <ChevronRight className="size-4 shrink-0 text-fg-muted" strokeWidth={2} aria-hidden />
              </button>

              {helpOpen && isMobileSheet ? (
                <div role="group" aria-label="Help" className="flex flex-col gap-1 pb-1 pl-2">
                  {helpOptionButtons}
                </div>
              ) : null}
            </div>

            <div
              className="relative"
              onMouseEnter={() => {
                if (!isMobileSheet) openAppearanceSubmenu();
              }}
              onMouseLeave={() => {
                if (!isMobileSheet) scheduleCloseAppearanceSubmenu();
              }}
            >
              <button
                ref={appearanceTriggerRef}
                type="button"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={appearanceOpen}
                className={cn(itemClass, appearanceOpen && "bg-dropdown-item-hover")}
                onMouseEnter={() => setAppearanceIconPlaying(true)}
                onMouseLeave={() => setAppearanceIconPlaying(false)}
                onFocus={() => setAppearanceIconPlaying(true)}
                onBlur={() => setAppearanceIconPlaying(false)}
                onClick={() => {
                  if (isMobileSheet) {
                    setHelpOpen(false);
                    setAppearanceOpen((v) => !v);
                    return;
                  }
                  openAppearanceSubmenu();
                }}
              >
                <DropdownMenuLottieIcon
                  animationData={appearanceMenuIconAnimation}
                  playing={appearanceIconPlaying || appearanceOpen}
                />
                <span className="min-w-0 flex-1 truncate text-left">Appearance</span>
                <span className="shrink-0 text-sm font-normal text-fg-muted">{appearanceValueLabel}</span>
                <ChevronRight className="size-4 shrink-0 text-fg-muted" strokeWidth={2} aria-hidden />
              </button>

              {appearanceOpen && isMobileSheet ? (
                <div role="group" aria-label="Appearance" className="flex flex-col gap-1 pb-1 pl-2">
                  {themeOptionButtons}
                </div>
              ) : null}
            </div>

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
              <div className="border-t border-dropdown-divider md:hidden" />
              <div className="px-3 py-3 md:hidden">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    router.push(PATH_ACCOUNT_PLANS);
                  }}
                  className="flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] bg-accent px-3.5 text-[13px] font-semibold text-white shadow-[0px_1px_2px_0px_rgba(37,99,235,0.2)] transition-colors hover:bg-accent-hover"
                >
                  <Sparkles className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
                  Upgrade
                </button>
              </div>
            </>
          )}
        </div>
      </TopbarDropdownPortal>

      {appearanceOpen && !isMobileSheet && appearancePos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={appearancePortalRef}
              role="menu"
              aria-label="Appearance"
              className={cn(
                dropdownMenuSurfaceClassName(),
                dropdownMenuPanelBodyClassName,
                "fixed z-[221] w-[168px]",
              )}
              style={{ top: appearancePos.top, right: appearancePos.right }}
              onMouseEnter={openAppearanceSubmenu}
              onMouseLeave={scheduleCloseAppearanceSubmenu}
            >
              {themeOptionButtons}
            </div>,
            document.body,
          )
        : null}

      {helpOpen && !isMobileSheet && helpPos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={helpPortalRef}
              role="menu"
              aria-label="Help"
              className={cn(
                dropdownMenuSurfaceClassName(),
                dropdownMenuPanelBodyClassName,
                "fixed z-[221] w-[min(calc(100vw-24px),280px)]",
              )}
              style={{ top: helpPos.top, right: helpPos.right }}
              onMouseEnter={openHelpSubmenu}
              onMouseLeave={scheduleCloseHelpSubmenu}
            >
              {helpOptionButtons}
            </div>,
            document.body,
          )
        : null}

      <HelpFeedbackModal open={helpModalOpen} onClose={() => setHelpModalOpen(false)} />
    </div>
  );
}
