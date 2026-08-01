"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";

type SetAuthPreCardBanner = (banner: ReactNode) => void;

const AuthPreCardBannerContext = createContext<SetAuthPreCardBanner | null>(null);

/**
 * Provides above-card banner slot for auth pages.
 * Server `initial` shows until a child publishes via {@link useAuthPreCardBanner}.
 */
export function AuthPreCardBannerProvider({
  initial = null,
  children,
}: {
  initial?: ReactNode;
  children: (banner: ReactNode) => ReactNode;
}) {
  const [clientBanner, setClientBanner] = useState<ReactNode>(null);
  const banner = clientBanner ?? initial;

  return (
    <AuthPreCardBannerContext.Provider value={setClientBanner}>
      {children(banner)}
    </AuthPreCardBannerContext.Provider>
  );
}

/** Publish a banner above the auth card; clears on unmount or when `banner` is null. */
export function useAuthPreCardBanner(banner: ReactNode) {
  const setBanner = useContext(AuthPreCardBannerContext);

  useLayoutEffect(() => {
    if (!setBanner) return;
    setBanner(banner);
    return () => setBanner(null);
  }, [banner, setBanner]);
}
