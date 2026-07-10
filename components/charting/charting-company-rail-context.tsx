"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import type { ChartingMetricId } from "@/lib/market/stock-charting-metrics";

const DESKTOP_SHELL_MQ = "(min-width: 768px)";

export type ChartingRailCompanyRow = {
  ticker: string;
  removeDisabled?: boolean;
};

export type ChartingRailMetricRow = {
  id: ChartingMetricId;
  label: string;
  color: string;
  removeDisabled?: boolean;
  showBarValues?: boolean;
};

export type ChartingCompanyRailControls = {
  openMetricPicker: () => void;
  openCompanyPicker: () => void;
  metricAddDisabled?: boolean;
  companyAddDisabled?: boolean;
  companies?: ChartingRailCompanyRow[];
  metrics?: ChartingRailMetricRow[];
  onRemoveCompany?: (ticker: string) => void;
  onRemoveMetric?: (metricId: ChartingMetricId) => void;
  onShowBarValuesChange?: (metricId: ChartingMetricId, next: boolean) => void;
};

type ChartingCompanyRailContextValue = {
  registration: ChartingCompanyRailControls | null;
  register: (controls: ChartingCompanyRailControls) => () => void;
  requestRegistrationRender: () => void;
  metricAddAnchorRef: RefObject<HTMLButtonElement | null>;
  companyAddAnchorRef: RefObject<HTMLButtonElement | null>;
};

const ChartingCompanyRailContext = createContext<ChartingCompanyRailContextValue | null>(null);

function useIsDesktopShell(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_SHELL_MQ);
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isDesktop;
}

export function ChartingCompanyRailProvider({ children }: { children: ReactNode }) {
  const [registrationVersion, setRegistrationVersion] = useState(0);
  const registrationRef = useRef<ChartingCompanyRailControls | null>(null);
  const activeRegistrationTokenRef = useRef<object | null>(null);
  const metricAddAnchorRef = useRef<HTMLButtonElement | null>(null);
  const companyAddAnchorRef = useRef<HTMLButtonElement | null>(null);

  const register = useCallback((controls: ChartingCompanyRailControls) => {
    const token = {};
    activeRegistrationTokenRef.current = token;
    registrationRef.current = controls;
    setRegistrationVersion((version) => version + 1);
    return () => {
      if (activeRegistrationTokenRef.current !== token) return;
      activeRegistrationTokenRef.current = null;
      registrationRef.current = null;
      setRegistrationVersion((version) => version + 1);
    };
  }, []);

  const requestRegistrationRender = useCallback(() => {
    if (!activeRegistrationTokenRef.current) return;
    setRegistrationVersion((version) => version + 1);
  }, []);

  const value = useMemo(
    () => ({
      registration: registrationRef.current,
      register,
      requestRegistrationRender,
      metricAddAnchorRef,
      companyAddAnchorRef,
    }),
    [registrationVersion, register, requestRegistrationRender],
  );

  return (
    <ChartingCompanyRailContext.Provider value={value}>{children}</ChartingCompanyRailContext.Provider>
  );
}

export function useChartingCompanyRail(): ChartingCompanyRailContextValue {
  const ctx = useContext(ChartingCompanyRailContext);
  if (!ctx) {
    throw new Error("useChartingCompanyRail must be used within ChartingCompanyRailProvider");
  }
  return ctx;
}

/** Desktop `/charting` — metric/company pickers anchor to the left rail + buttons. */
export function useChartingRailPickerAnchors(): {
  useRailPickers: boolean;
  metricAddAnchorRef: RefObject<HTMLButtonElement | null>;
  companyAddAnchorRef: RefObject<HTMLButtonElement | null>;
} {
  const pathname = usePathname();
  const isDesktop = useIsDesktopShell();
  const { metricAddAnchorRef, companyAddAnchorRef } = useChartingCompanyRail();
  const useRailPickers = isDesktop && pathname === "/charting";

  return { useRailPickers, metricAddAnchorRef, companyAddAnchorRef };
}

export function useRegisterChartingCompanyRail(
  controls: ChartingCompanyRailControls,
  enabled = true,
): void {
  const { register, requestRegistrationRender } = useChartingCompanyRail();
  const controlsRef = useRef(controls);
  controlsRef.current = controls;

  const stableControlsRef = useRef<ChartingCompanyRailControls | null>(null);
  if (!stableControlsRef.current) {
    stableControlsRef.current = {
      openMetricPicker: () => controlsRef.current.openMetricPicker(),
      openCompanyPicker: () => controlsRef.current.openCompanyPicker(),
      get metricAddDisabled() {
        return controlsRef.current.metricAddDisabled;
      },
      get companyAddDisabled() {
        return controlsRef.current.companyAddDisabled;
      },
      get companies() {
        return controlsRef.current.companies;
      },
      get metrics() {
        return controlsRef.current.metrics;
      },
      onRemoveCompany: (ticker) => controlsRef.current.onRemoveCompany?.(ticker),
      onRemoveMetric: (metricId) => controlsRef.current.onRemoveMetric?.(metricId),
      onShowBarValuesChange: (metricId, next) =>
        controlsRef.current.onShowBarValuesChange?.(metricId, next),
    };
  }

  useEffect(() => {
    if (!enabled) return;
    return register(stableControlsRef.current!);
  }, [register, enabled]);

  const companiesKey = JSON.stringify(controls.companies ?? []);
  const metricsKey = JSON.stringify(
    (controls.metrics ?? []).map((metric) => ({
      id: metric.id,
      label: metric.label,
      color: metric.color,
      removeDisabled: metric.removeDisabled,
      showBarValues: metric.showBarValues,
    })),
  );

  useEffect(() => {
    if (!enabled) return;
    requestRegistrationRender();
  }, [
    enabled,
    requestRegistrationRender,
    companiesKey,
    metricsKey,
    controls.metricAddDisabled,
    controls.companyAddDisabled,
  ]);
}

export { useIsDesktopShell as useChartingCompanyRailDesktopShell };
