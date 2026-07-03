"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { MarketTab } from "@/components/screener/market-tabs";

export type MarketsTabHostRegistration = {
  activeTab: MarketTab;
  setActiveTab: (tab: MarketTab) => void;
};

type MarketsTabHostContextValue = {
  registration: MarketsTabHostRegistration | null;
  register: (registration: MarketsTabHostRegistration) => () => void;
};

const MarketsTabHostContext = createContext<MarketsTabHostContextValue | null>(null);

export function MarketsTabHostProvider({ children }: { children: ReactNode }) {
  const [registration, setRegistration] = useState<MarketsTabHostRegistration | null>(null);

  const register = useCallback((next: MarketsTabHostRegistration) => {
    setRegistration(next);
    return () => {
      setRegistration((current) => (current?.setActiveTab === next.setActiveTab ? null : current));
    };
  }, []);

  const value = useMemo(() => ({ registration, register }), [registration, register]);

  return <MarketsTabHostContext.Provider value={value}>{children}</MarketsTabHostContext.Provider>;
}

export function useMarketsTabHost(): MarketsTabHostContextValue {
  const ctx = useContext(MarketsTabHostContext);
  if (!ctx) {
    throw new Error("useMarketsTabHost must be used within MarketsTabHostProvider");
  }
  return ctx;
}

export function useRegisterMarketsTabHost(activeTab: MarketTab, setActiveTab: (tab: MarketTab) => void): void {
  const { register } = useMarketsTabHost();

  useEffect(() => register({ activeTab, setActiveTab }), [register, activeTab, setActiveTab]);
}
