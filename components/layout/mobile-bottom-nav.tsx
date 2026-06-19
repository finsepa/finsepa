"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChartPieSlice, Globe, Star } from "@phosphor-icons/react";

import { ChevronsUpDownIcon, type ChevronsUpDownIconHandle } from "@/components/chevrons-up-down-icon";
import {
  MobileBottomNavSearchField,
  MobileBottomNavSearchResults,
} from "@/components/layout/mobile-bottom-nav-search";
import { MobileMoreNavList } from "@/components/layout/mobile-more-nav-menu";
import {
  mobilePrimaryNavTabFromPathname,
  protectedMobileMoreNavItems,
  type MobilePrimaryNavTab,
} from "@/components/layout/protected-nav-config";
import { OPEN_SEARCH_EVENT } from "@/components/search/search-modal";
import { useSearchPanel } from "@/components/search/use-search-panel";
import { HapticButton } from "@/components/haptic-button";
import { useMobileBottomNavScrollHide } from "@/lib/layout/use-mobile-bottom-nav-scroll-hide";
import { Search, X } from "@/lib/icons";
import { cn } from "@/lib/utils";

const TAB_MOTION_MS = 280;
const TAB_MOTION_DURATION = TAB_MOTION_MS / 1000;
const TAB_MOTION_EASE = [0.33, 1, 0.68, 1] as const;
/** Synced with `.mobile-bottom-nav-search-morph` width transition in `globals.css`. */
const SEARCH_MORPH_MS = 280;
/** Matches `MobileMoreNavList` row, gap, and padding geometry. */
const MORE_MENU_ROW_HEIGHT_PX = 44;
const MORE_MENU_ROW_GAP_PX = 2;
const MORE_MENU_LIST_PADDING_PX = 12;
const MORE_MENU_PILL_PADDING_PX = 4;
/** Sync with `--mobile-bottom-nav-expanded-height`. */
const MORE_MENU_TAB_ROW_PX = 52;

function moreMenuExpandedHeightPx(itemCount: number): number {
  const contentHeight =
    MORE_MENU_PILL_PADDING_PX +
    MORE_MENU_LIST_PADDING_PX +
    itemCount * MORE_MENU_ROW_HEIGHT_PX +
    Math.max(0, itemCount - 1) * MORE_MENU_ROW_GAP_PX +
    MORE_MENU_TAB_ROW_PX;
  const viewportCap = Math.max(MORE_MENU_ROW_HEIGHT_PX * 3, window.innerHeight - 120);
  return Math.min(contentHeight, viewportCap);
}

const MORPH_SPRING = { type: "spring" as const, stiffness: 360, damping: 32, mass: 0.9 };
const MORE_CLOSE_TRANSITION = { duration: TAB_MOTION_DURATION, ease: TAB_MOTION_EASE };
const SEARCH_ICON_MORPH = { duration: 0.2, ease: [0.33, 1, 0.68, 1] as const };

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

export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const urlTab = useMemo(() => mobilePrimaryNavTabFromPathname(pathname), [pathname]);
  const [displayTab, setDisplayTab] = useState<MobilePrimaryNavTab>(urlTab);
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchMorphComplete, setSearchMorphComplete] = useState(false);
  const [, startTransition] = useTransition();
  const scrollCompact = useMobileBottomNavScrollHide(!moreOpen && !searchOpen);

  const searchMorphRef = useRef<HTMLDivElement>(null);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const searchPanel = useSearchPanel({ open: searchOpen, onClose: closeSearch });

  const barRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const chevronsRef = useRef<ChevronsUpDownIconHandle>(null);
  const tabRefs = useRef(new Map<MobilePrimaryNavTab, HTMLDivElement>());
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const [indicatorReady, setIndicatorReady] = useState(false);
  const [indicatorResizeLock, setIndicatorResizeLock] = useState(false);
  const [expandedHeightPx, setExpandedHeightPx] = useState(() =>
    moreMenuExpandedHeightPx(protectedMobileMoreNavItems.length),
  );

  useEffect(() => {
    if (!moreOpen) setDisplayTab(urlTab);
  }, [urlTab, moreOpen]);

  useEffect(() => {
    const updateHeight = () =>
      setExpandedHeightPx(moreMenuExpandedHeightPx(protectedMobileMoreNavItems.length));
    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  const measureIndicator = useCallback(() => {
    if (moreOpen) return;
    const nav = navRef.current;
    const cell = tabRefs.current.get(displayTab);
    if (!nav || !cell) return;
    const navRect = nav.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    const left = Math.round(cellRect.left - navRect.left);
    const width = Math.round(cellRect.width);
    if (width <= 0) return;
    setIndicator((prev) => {
      if (prev.left === left && prev.width === width) return prev;
      return { left, width };
    });
  }, [displayTab, moreOpen]);

  const measureIndicatorRef = useRef(measureIndicator);
  measureIndicatorRef.current = measureIndicator;

  useLayoutEffect(() => {
    if (searchOpen || moreOpen) return;
    measureIndicatorRef.current();
    const readyRaf = requestAnimationFrame(() => setIndicatorReady(true));

    const nav = navRef.current;
    const bar = barRef.current;
    if (!nav) {
      return () => cancelAnimationFrame(readyRaf);
    }

    const onTransitionEnd = (e: TransitionEvent) => {
      const target = e.target;
      if (target !== nav && target !== bar) return;
      if (
        e.propertyName === "height" ||
        e.propertyName === "border-radius" ||
        e.propertyName === "width"
      ) {
        if (!moreOpen) measureIndicatorRef.current();
      }
    };

    const onResize = () => measureIndicatorRef.current();
    const ro = new ResizeObserver(onResize);
    ro.observe(nav);
    bar?.addEventListener("transitionend", onTransitionEnd);
    nav.addEventListener("transitionend", onTransitionEnd);
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(readyRaf);
      ro.disconnect();
      bar?.removeEventListener("transitionend", onTransitionEnd);
      nav.removeEventListener("transitionend", onTransitionEnd);
      window.removeEventListener("resize", onResize);
    };
  }, [moreOpen, searchOpen]);

  useEffect(() => {
    if (!indicatorReady || searchOpen || moreOpen) return;
    const raf = requestAnimationFrame(() => measureIndicatorRef.current());
    return () => cancelAnimationFrame(raf);
  }, [displayTab, indicatorReady, moreOpen, searchOpen]);

  useEffect(() => {
    if (moreOpen || searchOpen) return;
    const bar = barRef.current;
    if (!bar) return;

    setIndicatorResizeLock(true);
    const ro = new ResizeObserver(() => measureIndicatorRef.current());
    ro.observe(bar);

    const unlock = () => {
      measureIndicatorRef.current();
      setIndicatorResizeLock(false);
    };

    const onTransitionEnd = (e: TransitionEvent) => {
      if (e.target !== bar) return;
      if (e.propertyName === "height" || e.propertyName === "left" || e.propertyName === "right") {
        unlock();
      }
    };

    bar.addEventListener("transitionend", onTransitionEnd);
    const timer = window.setTimeout(unlock, TAB_MOTION_MS + 48);

    return () => {
      ro.disconnect();
      bar.removeEventListener("transitionend", onTransitionEnd);
      window.clearTimeout(timer);
    };
  }, [scrollCompact, moreOpen, searchOpen]);

  useEffect(() => {
    if (!searchOpen) {
      setSearchMorphComplete(false);
      return;
    }

    const morph = searchMorphRef.current;
    const markComplete = () => setSearchMorphComplete(true);

    const onTransitionEnd = (e: TransitionEvent) => {
      if (e.target !== morph || e.propertyName !== "width") return;
      markComplete();
    };

    morph?.addEventListener("transitionend", onTransitionEnd);
    const fallback = window.setTimeout(markComplete, SEARCH_MORPH_MS + 48);

    return () => {
      morph?.removeEventListener("transitionend", onTransitionEnd);
      window.clearTimeout(fallback);
    };
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

  const selectTab = useCallback((tab: MobilePrimaryNavTab) => {
    setDisplayTab(tab);
  }, []);

  const closeMore = useCallback(() => {
    setMoreOpen(false);
  }, []);

  const toggleMore = useCallback(() => {
    setSearchOpen(false);
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

  useEffect(() => {
    if (moreOpen) {
      chevronsRef.current?.startAnimation();
    } else {
      chevronsRef.current?.stopAnimation();
    }
  }, [moreOpen]);

  const goToTab = useCallback(
    (tab: Exclude<MobilePrimaryNavTab, "more">, href: string) => {
      if (moreOpen) closeMore();
      if (searchOpen) closeSearch();
      if (displayTab === tab && urlTab === tab) return;
      selectTab(tab);
      startTransition(() => {
        router.push(href);
      });
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
      <MobileBottomNavSearchResults
        open={searchOpen && searchMorphComplete}
        panel={searchPanel}
        barRef={barRef}
        searchMorphRef={searchMorphRef}
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
          (moreOpen || searchOpen) && "mobile-bottom-nav-blur-fade--hidden",
        )}
      />

      <div
        ref={barRef}
        className={cn(
          "mobile-bottom-nav-bar md:hidden",
          (moreOpen || searchOpen) && "mobile-bottom-nav-bar--more-open",
        )}
        aria-label="Primary navigation"
      >
        <AnimatePresence initial={false}>
          {!searchOpen ? (
            <motion.nav
              key="nav-pill"
              ref={navRef}
              className={cn(
                "mobile-bottom-nav-pill relative z-[1] flex min-w-0 flex-col overflow-hidden",
                pillSurfaceClass,
                moreOpen && "mobile-bottom-nav-pill--expanded z-[44]",
              )}
              aria-label={moreOpen ? "More" : "Primary"}
              role={moreOpen ? "dialog" : undefined}
              aria-modal={moreOpen || undefined}
              initial={false}
              animate={{
                height: moreOpen ? expandedHeightPx : "var(--mobile-bottom-nav-height)",
              }}
              exit={{ opacity: 0, scale: 0.96, filter: "blur(4px)" }}
              transition={moreOpen ? MORPH_SPRING : MORE_CLOSE_TRANSITION}
              style={{ transformOrigin: "bottom center" }}
              onAnimationComplete={() => {
                if (!moreOpen && !searchOpen) {
                  measureIndicatorRef.current();
                }
              }}
            >
              <AnimatePresence initial={false}>
                {moreOpen ? (
                  <motion.div
                    key="more-list"
                    className="mobile-bottom-nav-more-list flex min-h-0 flex-col overflow-hidden"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.16, delay: 0.06 }}
                  >
                    <MobileMoreNavList
                      items={protectedMobileMoreNavItems}
                      pathname={pathname}
                      onNavigate={closeMore}
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <div className="mobile-bottom-nav-tabs relative flex w-full shrink-0 items-stretch">
                    {indicatorReady && indicator.width > 0 ? (
                      <span
                        className="mobile-bottom-nav-indicator pointer-events-none absolute top-[2px] bottom-[2px] z-0 rounded-full bg-[#09090B]/[0.05] motion-reduce:transition-none"
                        style={{
                          left: indicator.left,
                          width: indicator.width,
                          transitionProperty:
                            indicatorResizeLock || moreOpen ? "none" : "left, width",
                          transitionDuration: `${TAB_MOTION_MS}ms`,
                          transitionTimingFunction: `cubic-bezier(${TAB_MOTION_EASE.join(",")})`,
                        }}
                        aria-hidden
                      />
                    ) : null}
                    {LINK_TABS.map((tab) => {
                      const visuallyActive = moreOpen ? urlTab === tab.id : displayTab === tab.id;
                      const Icon = tab.Icon;
                      return (
                        <div
                          key={tab.id}
                          ref={(el) => {
                            if (el) tabRefs.current.set(tab.id, el);
                            else tabRefs.current.delete(tab.id);
                          }}
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

                    <div
                      ref={(el) => {
                        if (el) tabRefs.current.set("more", el);
                        else tabRefs.current.delete("more");
                      }}
                      className="relative z-[1] flex min-w-0 flex-1 flex-col items-stretch self-stretch"
                    >
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
                          <ChevronsUpDownIcon ref={chevronsRef} className="mobile-bottom-nav-tab-icon shrink-0" />
                        </span>
                      </HapticButton>
                    </div>
              </div>
            </motion.nav>
          ) : null}
        </AnimatePresence>

        <div
          ref={searchMorphRef}
          className={cn(
            "mobile-bottom-nav-search-morph z-[2] overflow-hidden",
            searchOpen && "mobile-bottom-nav-search-morph--open",
            pillSurfaceClass,
          )}
        >
          <div className="flex h-full w-full min-w-0 items-center">
            <AnimatePresence initial={false}>
              {searchOpen ? (
                <motion.div
                  key="search-field"
                  className="min-w-0 flex-1"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.18, delay: 0.04, ease: [0.33, 1, 0.68, 1] }}
                >
                  <MobileBottomNavSearchField
                    panel={searchPanel}
                    resultsVisible={searchMorphComplete}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>

            <HapticButton
              type="button"
              className={cn(
                "mobile-bottom-nav-search-pill flex shrink-0 items-center justify-center rounded-full text-[#09090B]",
                searchOpen ? "mobile-bottom-nav-search-pill--close" : "h-full w-full",
              )}
              aria-label={searchOpen ? "Close search" : "Search"}
              onClick={() => (searchOpen ? closeSearch() : openSearch())}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {searchOpen ? (
                  <motion.span
                    key="close-icon"
                    className="flex items-center justify-center"
                    initial={{ rotate: -90, scale: 0.45, opacity: 0 }}
                    animate={{ rotate: 0, scale: 1, opacity: 1 }}
                    exit={{ rotate: 90, scale: 0.45, opacity: 0 }}
                    transition={SEARCH_ICON_MORPH}
                  >
                    <X className="mobile-bottom-nav-search-icon" strokeWidth={2} aria-hidden />
                  </motion.span>
                ) : (
                  <motion.span
                    key="search-icon"
                    className="flex items-center justify-center"
                    initial={{ rotate: 90, scale: 0.45, opacity: 0 }}
                    animate={{ rotate: 0, scale: 1, opacity: 1 }}
                    exit={{ rotate: -90, scale: 0.45, opacity: 0 }}
                    transition={SEARCH_ICON_MORPH}
                  >
                    <Search className="mobile-bottom-nav-search-icon" strokeWidth={2} aria-hidden />
                  </motion.span>
                )}
              </AnimatePresence>
            </HapticButton>
          </div>
        </div>
      </div>
    </>
  );
}
