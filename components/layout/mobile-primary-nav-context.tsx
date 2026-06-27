"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import {
  mobilePrimaryNavTabFromPathname,
  mobileTopbarTitleFromPathname,
  type MobilePrimaryNavTab,
} from "@/components/layout/protected-nav-config";

type MobilePrimaryNavContextValue = {
  displayTab: MobilePrimaryNavTab;
  setDisplayTab: (tab: MobilePrimaryNavTab) => void;
  mobileTopbarTitle: string;
};

const MobilePrimaryNavContext = createContext<MobilePrimaryNavContextValue | null>(null);

export function MobilePrimaryNavProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const urlTab = useMemo(() => mobilePrimaryNavTabFromPathname(pathname), [pathname]);
  const [displayTab, setDisplayTab] = useState<MobilePrimaryNavTab>(urlTab);

  useEffect(() => {
    setDisplayTab(urlTab);
  }, [urlTab]);

  const mobileTopbarTitle = useMemo(() => {
    if (displayTab === urlTab) return mobileTopbarTitleFromPathname(pathname);
    if (displayTab === "portfolio") return "Portfolio";
    if (displayTab === "watchlist") return "Watchlist";
    if (displayTab === "more") return "More";
    return "Markets";
  }, [displayTab, urlTab, pathname]);

  const value = useMemo(
    () => ({ displayTab, setDisplayTab, mobileTopbarTitle }),
    [displayTab, mobileTopbarTitle],
  );

  return <MobilePrimaryNavContext.Provider value={value}>{children}</MobilePrimaryNavContext.Provider>;
}

export function useMobilePrimaryNav(): MobilePrimaryNavContextValue {
  const ctx = useContext(MobilePrimaryNavContext);
  if (!ctx) {
    throw new Error("useMobilePrimaryNav must be used within MobilePrimaryNavProvider");
  }
  return ctx;
}
