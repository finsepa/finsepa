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

import type { StockDetailTabId } from "@/lib/stock/stock-detail-tab";

export type StockDetailTabHostRegistration = {
  activeTab: StockDetailTabId;
  setActiveTab: (tab: StockDetailTabId) => void;
  isEtf: boolean;
};

type StockDetailTabHostContextValue = {
  registration: StockDetailTabHostRegistration | null;
  register: (registration: StockDetailTabHostRegistration) => () => void;
};

const StockDetailTabHostContext = createContext<StockDetailTabHostContextValue | null>(null);

export function StockDetailTabHostProvider({ children }: { children: ReactNode }) {
  const [registration, setRegistration] = useState<StockDetailTabHostRegistration | null>(null);

  const register = useCallback((next: StockDetailTabHostRegistration) => {
    setRegistration(next);
    return () => {
      setRegistration((current) => (current?.setActiveTab === next.setActiveTab ? null : current));
    };
  }, []);

  const value = useMemo(() => ({ registration, register }), [registration, register]);

  return <StockDetailTabHostContext.Provider value={value}>{children}</StockDetailTabHostContext.Provider>;
}

export function useStockDetailTabHost(): StockDetailTabHostContextValue {
  const ctx = useContext(StockDetailTabHostContext);
  if (!ctx) {
    throw new Error("useStockDetailTabHost must be used within StockDetailTabHostProvider");
  }
  return ctx;
}

export function useRegisterStockDetailTabHost(
  activeTab: StockDetailTabId,
  setActiveTab: (tab: StockDetailTabId) => void,
  isEtf: boolean,
): void {
  const { register } = useStockDetailTabHost();

  useEffect(() => register({ activeTab, setActiveTab, isEtf }), [register, activeTab, setActiveTab, isEtf]);
}
