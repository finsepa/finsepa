"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";

export type AuthCardHeaderOverride = {
  title: string;
  subtitle?: ReactNode;
  /** Top-left control inside the card (e.g. Back). */
  leading?: ReactNode;
  /**
   * Replace the Finsepa mark above the title.
   * Pass `null` to hide; omit to keep the default logo.
   */
  brand?: ReactNode | null;
};

type SetOverride = (value: AuthCardHeaderOverride | null) => void;

const AuthCardHeaderContext = createContext<SetOverride | null>(null);
const AuthCardHeaderValueContext = createContext<AuthCardHeaderOverride | null>(null);

export function AuthCardHeaderProvider({
  children,
}: {
  children: (override: AuthCardHeaderOverride | null) => ReactNode;
}) {
  const [override, setOverride] = useState<AuthCardHeaderOverride | null>(null);
  return (
    <AuthCardHeaderContext.Provider value={setOverride}>
      <AuthCardHeaderValueContext.Provider value={override}>
        {children(override)}
      </AuthCardHeaderValueContext.Provider>
    </AuthCardHeaderContext.Provider>
  );
}

/** Replace the page auth card title/subtitle (and optional leading control) from a child form. */
export function useAuthCardHeader(override: AuthCardHeaderOverride | null) {
  const setOverride = useContext(AuthCardHeaderContext);
  useLayoutEffect(() => {
    if (!setOverride) return;
    setOverride(override);
    return () => setOverride(null);
  }, [override, setOverride]);
}
