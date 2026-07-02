"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChartPieSlice, Globe, Star } from "@phosphor-icons/react";

import { ChevronsUpDownIcon } from "@/components/chevrons-up-down-icon";
import {
  MOBILE_SEARCH_KEYBOARD_DELAY_MS,
  MOBILE_SEARCH_SHEET_ENTER_MS,
  MobileBottomNavSearchSheet,
} from "@/components/layout/mobile-bottom-nav-search";
import { MobileMoreNavList } from "@/components/layout/mobile-more-nav-menu";
import { useMobilePrimaryNav } from "@/components/layout/mobile-primary-nav-context";
import {
  mobilePrimaryNavTabFromPathname,
  protectedMobileMoreNavItems,
  type MobilePrimaryNavTab,
} from "@/components/layout/protected-nav-config";
import { OPEN_SEARCH_EVENT } from "@/components/search/search-modal";
import { useSearchPanel } from "@/components/search/use-search-panel";
import { HapticButton } from "@/components/haptic-button";
import { useMobileBottomNavScrollHide } from "@/lib/layout/use-mobile-bottom-nav-scroll-hide";
import { useMobileBottomNavSearchIsolation } from "@/lib/layout/use-mobile-bottom-nav-search-isolation";
import { Search } from "@/lib/icons";
import { cn } from "@/lib/utils";

const TAB_MOTION_MS = 280;
const TAB_MOTION_DURATION = TAB_MOTION_MS / 1000;
const TAB_MOTION_EASE = [0.33, 1, 0.68, 1] as const;
/** Matches `MobileMoreNavList` row, gap, and padding geometry. */
const MORE_MENU_ROW_HEIGHT_PX = 44;
const MORE_MENU_ROW_GAP_PX = 2;
const MORE_MENU_LIST_PADDING_PX = 12;
const MORE_MENU_PILL_PADDING_PX = 4;
/** Sync with `--mobile-bottom-nav-expanded-height`. */
const MORE_MENU_TAB_ROW_PX = 52;

/** Fallback when `window` is unavailable (SSR / first paint). */
const FALLBACK_VIEWPORT_HEIGHT_PX = 844;

function viewportHeightPx(): number {
  if (typeof window === "undefined") return FALLBACK_VIEWPORT_HEIGHT_PX;
  return window.innerHeight;
}

function computeMoreMenuListHeightPx(
  itemCount: number,
  viewportHeight = viewportHeightPx(),
): number {
  const contentHeight =
    MORE_MENU_PILL_PADDING_PX +
    MORE_MENU_LIST_PADDING_PX +
    itemCount * MORE_MENU_ROW_HEIGHT_PX +
    Math.max(0, itemCount - 1) * MORE_MENU_ROW_GAP_PX;
  const viewportCap =
    Math.max(MORE_MENU_ROW_HEIGHT_PX * 3, viewportHeight - 120) - MORE_MENU_TAB_ROW_PX;
  return Math.min(contentHeight, viewportCap);
}

function moreMenuExpandedHeightPx(
  itemCount: number,
  viewportHeight = viewportHeightPx(),
): number {
  return computeMoreMenuListHeightPx(itemCount, viewportHeight) + MORE_MENU_TAB_ROW_PX;
}

/** Locks tab-row size while the More sheet opens/closes so icons do not morph. */
export const MOBILE_BOTTOM_NAV_MORE_ACTIVE_CLASS = "mobile-bottom-nav-more-active";

function syncMobileBottomNavMoreActiveClass(active: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle(MOBILE_BOTTOM_NAV_MORE_ACTIVE_CLASS, active);
}

const MORPH_SPRING = { type: "spring" as const, stiffness: 360, damping: 32, mass: 0.9 };
const MORE_CLOSE_TRANSITION = { duration: TAB_MOTION_DURATION, ease: TAB_MOTION_EASE };

const pillSurfaceClass =
  "border border-[rgba(9,9,11,0.06)] bg-white/90 shadow-sm backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-white/78";

const tabHighlightClass =
  "mobile-bottom-nav-tab-highlight pointer-events-none absolute inset-[2px] z-0 rounded-full bg-[#09090B]/[0.05]";

type LinkTabConfig = {
  id: Exclude<MobilePrimaryNavTab, "more">;
  label: string;
  href: string;
  Icon: typeof Globe;
};

const LINK_TABS: LinkTabConfig[] = [
  { id: "markets", label: "Markets", href: "/screener", Icon: Globe },
  { id: "portfolio", label: "Portfolio", href: "/portfolio", Icon: ChartPieSlice },
  { id: "watchlist", label: "Watchlist", href: "/watchlist", Icon: Star },
];

/** Equal-width tab row — used for %-based active highlight (tracks bar resize smoothly). */
const MOBILE_BOTTOM_NAV_TAB_ORDER: MobilePrimaryNavTab[] = [
  "markets",
  "portfolio",
  "watchlist",
  "more",
];

function mobileBottomNavHighlightIndex(tab: MobilePrimaryNavTab): number {
  const index = MOBILE_BOTTOM_NAV_TAB_ORDER.indexOf(tab);
  return index >= 0 ? index : 0;
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const urlTab = useMemo(() => mobilePrimaryNavTabFromPathname(pathname), [pathname]);
  const { displayTab, setDisplayTab } = useMobilePrimaryNav();
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreMenuAnimating, setMoreMenuAnimating] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInteractive, setSearchInteractive] = useState(false);
  const navFrozen = moreOpen || moreMenuAnimating;
  useMobileBottomNavScrollHide(!searchOpen && !navFrozen);
  useMobileBottomNavSearchIsolation(searchOpen);

  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const searchPanel = useSearchPanel({
    open: searchOpen,
    focusWhen: searchInteractive,
    onClose: closeSearch,
  });

  const barRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const moreOpenRef = useRef(moreOpen);
  moreOpenRef.current = moreOpen;
  const [expandedHeightPx, setExpandedHeightPx] = useState(() =>
    moreMenuExpandedHeightPx(protectedMobileMoreNavItems.length, FALLBACK_VIEWPORT_HEIGHT_PX),
  );

  const highlightTab = moreOpen ? urlTab : displayTab;
  const highlightIndex = mobileBottomNavHighlightIndex(highlightTab);
  const highlightTabCount = MOBILE_BOTTOM_NAV_TAB_ORDER.length;

  useLayoutEffect(() => {
    syncMobileBottomNavMoreActiveClass(navFrozen);
    return () => syncMobileBottomNavMoreActiveClass(false);
  }, [navFrozen]);

  useLayoutEffect(() => {
    const updateHeight = () => {
      setExpandedHeightPx(moreMenuExpandedHeightPx(protectedMobileMoreNavItems.length));
    };
    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  useEffect(() => {
    if (!searchOpen) {
      setSearchInteractive(false);
      return;
    }

    const timer = window.setTimeout(
      () => setSearchInteractive(true),
      MOBILE_SEARCH_SHEET_ENTER_MS + MOBILE_SEARCH_KEYBOARD_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [searchOpen]);

  useEffect(() => {
    setMoreOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  const openSearch = useCallback(() => {
    setMoreOpen(false);
    setSearchOpen(true);
  }, []);

  useEffect(() => {
    const onOpenSearch = () => openSearch();
    window.addEventListener(OPEN_SEARCH_EVENT, onOpenSearch);
    return () => window.removeEventListener(OPEN_SEARCH_EVENT, onOpenSearch);
  }, [openSearch]);

  const selectTab = useCallback(
    (tab: MobilePrimaryNavTab) => {
      setDisplayTab(tab);
    },
    [setDisplayTab],
  );

  const closeMore = useCallback(() => {
    if (!moreOpenRef.current) return;
    setMoreMenuAnimating(true);
    setMoreOpen(false);
  }, []);

  const toggleMore = useCallback(() => {
    setSearchOpen(false);
    setMoreMenuAnimating(true);
    setMoreOpen((open) => !open);
  }, []);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMore();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [moreOpen, closeMore]);

  const goToTab = useCallback(
    (tab: Exclude<MobilePrimaryNavTab, "more">, href: string) => {
      if (moreOpen) closeMore();
      if (searchOpen) closeSearch();
      if (displayTab === tab && urlTab === tab) return;
      selectTab(tab);
      router.push(href);
    },
    [moreOpen, searchOpen, closeMore, closeSearch, displayTab, urlTab, router, selectTab],
  );

  useEffect(() => {
    if (!searchOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSearch();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [searchOpen, closeSearch]);

  return (
    <>
      <MobileBottomNavSearchSheet
        open={searchOpen}
        interactive={searchInteractive}
        panel={searchPanel}
        onClose={closeSearch}
      />

      <AnimatePresence>
        {moreOpen ? (
          <motion.button
            type="button"
            key="more-backdrop"
            className="fixed inset-0 z-[41] bg-transparent md:hidden"
            aria-label="Close menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={closeMore}
          />
        ) : null}
      </AnimatePresence>

      <div
        aria-hidden
        className={cn(
          "mobile-bottom-nav-blur-fade md:hidden",
          searchOpen && "mobile-bottom-nav-blur-fade--hidden",
        )}
      />

      <div
        ref={barRef}
        className={cn(
          "mobile-bottom-nav-bar md:hidden",
          (navFrozen || searchOpen) && "mobile-bottom-nav-bar--more-open",
        )}
        aria-label="Primary navigation"
      >
        <motion.nav
          ref={navRef}
          className={cn(
            "mobile-bottom-nav-pill relative z-[1] flex min-w-0 origin-bottom flex-col overflow-hidden",
            pillSurfaceClass,
            navFrozen && "mobile-bottom-nav-pill--expanded z-[44]",
          )}
          aria-label={moreOpen ? "More" : "Primary"}
          role={moreOpen ? "dialog" : undefined}
          aria-modal={moreOpen || undefined}
          initial={false}
          animate={{
            height: moreOpen ? expandedHeightPx : "var(--mobile-bottom-nav-height)",
          }}
          transition={moreOpen ? MORPH_SPRING : MORE_CLOSE_TRANSITION}
          onAnimationComplete={() => {
            if (moreOpen) {
              setMoreMenuAnimating(false);
              return;
            }
            setMoreMenuAnimating(false);
          }}
        >
              <AnimatePresence initial={false}>
                {moreOpen ? (
                  <motion.div
                    key="more-list"
                    className="mobile-bottom-nav-more-list flex min-h-0 flex-col overflow-hidden"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, transition: { duration: 0.16, delay: 0.06 } }}
                    exit={{ opacity: 0, transition: { duration: 0.12, delay: 0 } }}
                  >
                    <MobileMoreNavList
                      items={protectedMobileMoreNavItems}
                      pathname={pathname}
                      onNavigate={closeMore}
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <div
                className="mobile-bottom-nav-tabs relative flex w-full shrink-0 items-stretch"
                style={
                  {
                    "--mobile-bottom-nav-highlight-index": highlightIndex,
                    "--mobile-bottom-nav-highlight-count": highlightTabCount,
                  } as React.CSSProperties
                }
              >
                    {LINK_TABS.map((tab) => {
                      const visuallyActive = moreOpen ? urlTab === tab.id : displayTab === tab.id;
                      const Icon = tab.Icon;
                      return (
                        <div
                          key={tab.id}
                          className="relative z-[1] flex min-w-0 flex-1 flex-col items-stretch self-stretch"
                        >
                          <HapticButton
                            className={cn(
                              "mobile-bottom-nav-tab-button flex h-full w-full items-center justify-center rounded-full",
                              visuallyActive ? "text-[#09090B] opacity-100" : "text-[#A1A1AA] opacity-80 active:opacity-100",
                            )}
                            aria-label={tab.label}
                            onClick={() => goToTab(tab.id, tab.href)}
                          >
                            <span className="mobile-bottom-nav-tab-icon-slot" aria-hidden>
                              <Icon className="mobile-bottom-nav-tab-icon" weight={visuallyActive ? "fill" : "regular"} />
                            </span>
                          </HapticButton>
                        </div>
                      );
                    })}

                    <div className="relative z-[1] flex min-w-0 flex-1 flex-col items-stretch self-stretch">
                      {moreOpen && urlTab !== "more" ? (
                        <span className={tabHighlightClass} aria-hidden />
                      ) : null}
                      <HapticButton
                        className={cn(
                          "mobile-bottom-nav-tab-button flex h-full w-full items-center justify-center rounded-full",
                          moreOpen || urlTab === "more"
                            ? "text-[#09090B] opacity-100"
                            : "text-[#A1A1AA] opacity-80 active:opacity-100",
                        )}
                        aria-label="More"
                        aria-expanded={moreOpen}
                        aria-haspopup="dialog"
                        onClick={toggleMore}
                      >
                        <span className="mobile-bottom-nav-tab-icon-slot" aria-hidden>
                          <ChevronsUpDownIcon className="mobile-bottom-nav-tab-icon shrink-0" />
                        </span>
                      </HapticButton>
                    </div>
              </div>
        </motion.nav>

        <div
          className={cn(
            "mobile-bottom-nav-search-morph z-[2] overflow-hidden",
            pillSurfaceClass,
          )}
        >
          <HapticButton
            type="button"
            className="mobile-bottom-nav-search-pill flex h-full w-full shrink-0 items-center justify-center rounded-full text-[#09090B]"
            aria-label="Search"
            aria-expanded={searchOpen}
            onClick={openSearch}
          >
            <Search className="mobile-bottom-nav-search-icon" strokeWidth={2} aria-hidden />
          </HapticButton>
        </div>
      </div>
    </>
  );
}
