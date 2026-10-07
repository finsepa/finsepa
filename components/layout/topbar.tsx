"use client";

import { useMemo, useState, Suspense } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { TOPBAR_SHOW_NOTIFICATIONS } from "@/lib/features/topbar-flags";
import { TopbarDelayedTooltip } from "./topbar-delayed-tooltip";
import { TopbarSearch } from "./topbar-search";
import { NotificationsPanelModal } from "./notifications-panel-modal";
import { useNotificationsClient } from "@/lib/notifications/use-notifications-client";
import { TopbarAddMenu } from "./topbar-add-menu";
import { TopbarMobileAppButton } from "./topbar-mobile-app-button";
import { TopbarUpgradeButton } from "./topbar-upgrade-button";
import { TopbarUserMenu } from "./topbar-user-menu";
import { MobileAssetTopbarChrome } from "./mobile-asset-topbar-chrome";
import { MobileMarketsTopbarTabs } from "./mobile-markets-topbar-tabs";
import { MobileStockTopbarTabs } from "./mobile-stock-topbar-tabs";
import { useMobilePrimaryNav } from "@/components/layout/mobile-primary-nav-context";
import {
  isPortfolioWorkspaceRoute,
  MobilePortfolioTopbarChrome,
} from "./mobile-portfolio-topbar-chrome";
import {
  isWatchlistRoute,
  MobileWatchlistTopbarChrome,
} from "./mobile-watchlist-topbar-chrome";
import {
  mobileTopbarTitleFromPathname,
} from "@/components/layout/protected-nav-config";
import {
  topbarSquircleActiveClass,
  topbarSquircleIconClass,
} from "@/components/design-system/topbar-control-classes";
import { parseMobileAssetTopbarRoute } from "@/lib/layout/mobile-asset-topbar-route";
import { isScreenerRoute } from "@/lib/layout/is-screener-route";
import { useMobileMarketsTopbarLayout } from "@/lib/layout/use-mobile-markets-topbar-layout";
import { useMobileStockTopbarLayout } from "@/lib/layout/use-mobile-stock-topbar-layout";
import { SHELL_DESKTOP_PANEL_BG_MD_CLASS } from "@/components/design-system/card-surface-styles";
import { cn } from "@/lib/utils";

/** lottie-react markup is client-only — avoids hydration mismatch on the always-visible topbar bell. */
const TopbarNotificationsLottieIcon = dynamic(
  () =>
    import("@/components/icons/topbar-notifications-lottie-icon").then(
      (m) => m.TopbarNotificationsLottieIcon,
    ),
  {
    ssr: false,
    loading: () => <span className="inline-flex h-5 w-5 shrink-0" aria-hidden />,
  },
);

export function Topbar({
  userId,
  userInitials,
  avatarUrl,
  userDisplayName,
  platformTrialDaysLeft = null,
  isPro = false,
}: {
  userId: string;
  userInitials: string;
  avatarUrl: string | null;
  userDisplayName: string;
  /** Passed into the user menu: trial countdown after avatar; Upgrade CTA lives in the top bar on md+. */
  platformTrialDaysLeft?: number | null;
  /** Server-known paid Pro — hides Upgrade on first paint. */
  isPro?: boolean;
}) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsClient = useNotificationsClient({
    enabled: TOPBAR_SHOW_NOTIFICATIONS,
  });
  const { unread: unreadNotifications } = notificationsClient;
  const pathname = usePathname() ?? "";
  const mobileAssetRoute = parseMobileAssetTopbarRoute(pathname);
  const mobilePortfolioRoute = isPortfolioWorkspaceRoute(pathname);
  const mobileWatchlistRoute = isWatchlistRoute(pathname);
  const mobileScreenerRoute = isScreenerRoute(pathname);
  const mobileStockRoute = mobileAssetRoute?.kind === "stock";
  useMobileMarketsTopbarLayout(mobileScreenerRoute);
  useMobileStockTopbarLayout(mobileStockRoute);
  const { mobileTopbarTitle } = useMobilePrimaryNav();
  const pathnameMobileTitle = useMemo(() => mobileTopbarTitleFromPathname(pathname), [pathname]);
  const resolvedMobileTitle =
    mobilePortfolioRoute || mobileWatchlistRoute || mobileAssetRoute ?
      pathnameMobileTitle
    : mobileTopbarTitle;

  /** Route chrome for max-md / md height — kept as one string so `cn`/`twMerge` order stays stable. */
  const headerRouteChromeClass = mobileAssetRoute
    ? "max-md:min-h-[var(--mobile-topbar-height)] max-md:h-auto max-md:py-1.5 md:h-auto"
    : mobileScreenerRoute
      ? "max-md:h-[var(--mobile-markets-title-row-height)] max-md:min-h-[var(--mobile-markets-title-row-height)] max-md:items-end max-md:py-0 md:h-auto"
      : "max-md:min-h-[var(--mobile-topbar-height)] max-md:h-auto max-md:py-2 md:h-14";

  return (
    <>
      <div className="flex w-full min-w-0 flex-col">
        <header
          suppressHydrationWarning
          className={cn(
            "flex min-w-0 flex-nowrap items-center gap-2 overflow-hidden max-md:bg-transparent max-md:px-4 md:min-h-[var(--shell-chrome-header-height)] md:gap-3 md:px-4 md:py-3",
            SHELL_DESKTOP_PANEL_BG_MD_CLASS,
            headerRouteChromeClass,
          )}
        >
        {mobileAssetRoute ? (
          <div className="flex min-w-0 flex-1 items-center md:hidden">
            <MobileAssetTopbarChrome />
          </div>
        ) : mobilePortfolioRoute ? (
          <div className="flex min-w-0 flex-1 items-center md:hidden">
            <MobilePortfolioTopbarChrome />
          </div>
        ) : mobileWatchlistRoute ? (
          <div className="flex min-w-0 flex-1 items-center md:hidden">
            <MobileWatchlistTopbarChrome />
          </div>
        ) : (
          <div className="min-w-0 flex-1 md:hidden">
            <h1
              suppressHydrationWarning
              className="truncate text-[22px] font-semibold leading-7 tracking-[-0.02em] text-fg"
            >
              {resolvedMobileTitle}
            </h1>
          </div>
        )}

        <div className="hidden h-9 min-w-0 flex-1 items-center md:flex">
          <div className="min-w-0 w-full md:max-w-[360px]">
            <TopbarSearch />
          </div>
        </div>

        <div
          suppressHydrationWarning
          className={cn(
            "flex h-9 shrink-0 items-center gap-1.5 md:gap-2.5",
            mobileAssetRoute ? "hidden md:flex" : "max-md:ml-auto",
          )}
        >
          <TopbarUpgradeButton userId={userId} platformTrialDaysLeft={platformTrialDaysLeft} isPro={isPro} />

          <div className="hidden shrink-0 md:flex">
            <TopbarAddMenu />
          </div>
          {TOPBAR_SHOW_NOTIFICATIONS ? (
            <TopbarDelayedTooltip label="Notifications" className="inline-flex shrink-0" enabled={!notificationsOpen}>
              <button
                type="button"
                suppressHydrationWarning
                aria-label={
                  unreadNotifications > 0
                    ? `Notifications, ${unreadNotifications} unread`
                    : "Notifications"
                }
                aria-expanded={notificationsOpen}
                aria-haspopup="dialog"
                onClick={() => setNotificationsOpen(true)}
                className={
                  notificationsOpen
                    ? `${topbarSquircleIconClass} relative ${topbarSquircleActiveClass}`
                    : `${topbarSquircleIconClass} relative`
                }
              >
                <TopbarNotificationsLottieIcon alerting={unreadNotifications > 0} />
                {unreadNotifications > 0 ? (
                  <span
                    suppressHydrationWarning
                    className="absolute right-1 top-1 h-2 w-2 rounded-full bg-down ring-2 ring-white dark:ring-stroke-muted"
                    aria-hidden
                  />
                ) : null}
              </button>
            </TopbarDelayedTooltip>
          ) : null}

          <TopbarMobileAppButton />

          <TopbarUserMenu
            userId={userId}
            userInitials={userInitials}
            avatarUrl={avatarUrl}
            userDisplayName={userDisplayName}
            platformTrialDaysLeft={platformTrialDaysLeft}
            isPro={isPro}
          />
        </div>
        </header>
        {mobileScreenerRoute ? (
          <Suspense fallback={null}>
            <MobileMarketsTopbarTabs />
          </Suspense>
        ) : null}
        {mobileStockRoute ? (
          <Suspense fallback={null}>
            <MobileStockTopbarTabs />
          </Suspense>
        ) : null}
      </div>

      <NotificationsPanelModal
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        client={notificationsClient}
      />
    </>
  );
}
