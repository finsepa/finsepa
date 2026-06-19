"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

export type MobileAssetTopbarSubtitle = {
  line1: string;
  line2: string | null;
  line2Loading?: boolean;
  /** Structured listing line — preferred over plain `line2` when set. */
  line2Exchange?: string | null;
  line2CountryFlag?: string | null;
};

function subtitlesEqual(
  a: MobileAssetTopbarSubtitle | null,
  b: MobileAssetTopbarSubtitle | null,
): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  return (
    a.line1 === b.line1 &&
    a.line2 === b.line2 &&
    Boolean(a.line2Loading) === Boolean(b.line2Loading) &&
    (a.line2Exchange ?? null) === (b.line2Exchange ?? null) &&
    (a.line2CountryFlag ?? null) === (b.line2CountryFlag ?? null)
  );
}

type MobileAssetTopbarContextValue = {
  subtitle: MobileAssetTopbarSubtitle | null;
  setSubtitle: (subtitle: MobileAssetTopbarSubtitle | null) => void;
};

const MobileAssetTopbarContext = createContext<MobileAssetTopbarContextValue | null>(null);

export function MobileAssetTopbarProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [subtitle, setSubtitleState] = useState<MobileAssetTopbarSubtitle | null>(null);

  useEffect(() => {
    setSubtitleState(null);
  }, [pathname]);

  const setSubtitle = useCallback((next: MobileAssetTopbarSubtitle | null) => {
    setSubtitleState((prev) => (subtitlesEqual(prev, next) ? prev : next));
  }, []);

  const value = useMemo(() => ({ subtitle, setSubtitle }), [subtitle, setSubtitle]);

  return <MobileAssetTopbarContext.Provider value={value}>{children}</MobileAssetTopbarContext.Provider>;
}

export function useMobileAssetTopbarSubtitle(): MobileAssetTopbarSubtitle | null {
  return useContext(MobileAssetTopbarContext)?.subtitle ?? null;
}

/** Stock / crypto headers publish listing lines for the mobile asset top bar. */
export function useSetMobileAssetTopbarSubtitle(subtitle: MobileAssetTopbarSubtitle | null) {
  const setSubtitle = useContext(MobileAssetTopbarContext)?.setSubtitle;
  const line1 = subtitle?.line1 ?? "";
  const line2 = subtitle?.line2 ?? "";
  const line2Loading = subtitle?.line2Loading ?? false;
  const line2Exchange = subtitle?.line2Exchange ?? "";
  const line2CountryFlag = subtitle?.line2CountryFlag ?? "";

  useLayoutEffect(() => {
    if (!setSubtitle) return;
    if (!line1) {
      setSubtitle(null);
      return;
    }
    setSubtitle({
      line1,
      line2: line2 || null,
      line2Loading,
      line2Exchange: line2Exchange || null,
      line2CountryFlag: line2CountryFlag || null,
    });
  }, [setSubtitle, line1, line2, line2Loading, line2Exchange, line2CountryFlag]);
}
