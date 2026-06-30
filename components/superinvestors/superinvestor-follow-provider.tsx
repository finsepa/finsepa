"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { toast } from "sonner";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { readSupabaseSession } from "@/lib/supabase/safe-auth";
import { superinvestorDisplayNameFromProfilePath } from "@/lib/superinvestors/superinvestor-display-names";
import {
  normalizeSuperinvestorFollowHref,
  readSuperinvestorFollowLocal,
  writeSuperinvestorFollowLocal,
} from "@/lib/superinvestors/superinvestor-follow-storage";

const GUEST_STORAGE_KEY = "finsepa.superinvestor-follow.v1.guest";

function mergeGuestFollowsIntoUser(userId: string): string[] {
  const guest = readSuperinvestorFollowLocal(null);
  const user = readSuperinvestorFollowLocal(userId);
  const merged = [...new Set([...guest, ...user])];
  if (guest.length > 0) {
    writeSuperinvestorFollowLocal(merged, userId, { notify: false });
    try {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(GUEST_STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
  }
  return merged;
}

export type SuperinvestorFollowContextValue = {
  followed: Set<string>;
  hydrated: boolean;
  loaded: boolean;
  isFollowing: (href: string) => boolean;
  toggleFollow: (href: string, opts?: { displayName?: string }) => void;
};

const SuperinvestorFollowContext = createContext<SuperinvestorFollowContextValue | null>(null);

export function SuperinvestorFollowProvider({ children }: { children: ReactNode }) {
  const [followed, setFollowed] = useState<Set<string>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<string[]>([]);

  const userIdRef = useRef<string | null>(null);
  userIdRef.current = userId;
  const pendingRemovalRef = useRef<string[]>([]);
  pendingRemovalRef.current = pendingRemoval;
  const followedRef = useRef(followed);
  followedRef.current = followed;

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    void (async () => {
      try {
        const session = await readSupabaseSession(supabase);
        const uid = session?.user?.id ?? null;
        setUserId(uid);
        if (uid) {
          const paths = mergeGuestFollowsIntoUser(uid);
          setFollowed(new Set(paths));
        } else {
          setFollowed(new Set(readSuperinvestorFollowLocal(null)));
        }
        setHydrated(true);
      } catch {
        setFollowed(new Set(readSuperinvestorFollowLocal(null)));
        setHydrated(true);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      if (event === "SIGNED_IN" && uid) {
        const paths = mergeGuestFollowsIntoUser(uid);
        setFollowed((prev) => new Set([...paths, ...prev]));
      } else if (event === "SIGNED_OUT") {
        setFollowed(new Set(readSuperinvestorFollowLocal(null)));
        setPendingRemoval([]);
      } else if (uid) {
        setFollowed(new Set(readSuperinvestorFollowLocal(uid)));
      } else {
        setFollowed(new Set(readSuperinvestorFollowLocal(null)));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!userId) {
      setLoaded(true);
      return;
    }
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch("/api/superinvestor-follows", { credentials: "include" });
        if (cancelled) return;
        if (!res.ok) {
          if (!cancelled) setLoaded(true);
          return;
        }
        const data = (await res.json()) as { items?: { profile_path: string }[] };
        const items = Array.isArray(data.items) ? data.items : [];
        const server = new Set(
          items.map((i) => normalizeSuperinvestorFollowHref(i.profile_path)).filter(Boolean),
        );
        setFollowed((prev) => {
          const merged = new Set(prev);
          const pending = new Set(pendingRemovalRef.current.map(normalizeSuperinvestorFollowHref));
          for (const p of server) {
            if (!pending.has(p)) merged.add(p);
          }
          return merged;
        });
      } catch {
        /* local follows still work */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, userId]);

  useEffect(() => {
    if (!hydrated) return;
    writeSuperinvestorFollowLocal([...followed], userId, { notify: false });
  }, [followed, hydrated, userId]);

  const isFollowing = useCallback(
    (href: string) => {
      const key = normalizeSuperinvestorFollowHref(href);
      return key.length > 0 && followed.has(key);
    },
    [followed],
  );

  const toggleFollow = useCallback((href: string, opts?: { displayName?: string }) => {
    const key = normalizeSuperinvestorFollowHref(href);
    if (!key) return;
    const removing = followedRef.current.has(key);
    const name = superinvestorDisplayNameFromProfilePath(key, opts?.displayName);

    if (removing) {
      setPendingRemoval((prev) => [...new Set([...prev, key])]);
    } else {
      setPendingRemoval((prev) => prev.filter((p) => p !== key));
    }

    setFollowed((prev) => {
      const next = new Set(prev);
      if (removing) next.delete(key);
      else next.add(key);
      return next;
    });

    toast.success(removing ? `Unfollowed ${name}.` : `Following ${name}.`);

    void (async () => {
      try {
        if (removing) {
          const res = await fetch(
            `/api/superinvestor-follows?profilePath=${encodeURIComponent(key)}`,
            { method: "DELETE", credentials: "include", cache: "no-store" },
          );
          if (res.ok) {
            setPendingRemoval((prev) => prev.filter((p) => p !== key));
          } else if (userIdRef.current != null) {
            setPendingRemoval((prev) => prev.filter((p) => p !== key));
            setFollowed((prev) => {
              const next = new Set(prev);
              next.add(key);
              return next;
            });
            toast.error(`Could not unfollow ${name}. Please try again.`);
          }
        } else {
          const res = await fetch("/api/superinvestor-follows", {
            method: "POST",
            credentials: "include",
            cache: "no-store",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ profilePath: key }),
          });
          if (!res.ok && userIdRef.current != null) {
            setFollowed((prev) => {
              const next = new Set(prev);
              next.delete(key);
              return next;
            });
            toast.error(`Could not follow ${name}. Please try again.`);
          }
        }
      } catch {
        if (removing) {
          setPendingRemoval((prev) => prev.filter((p) => p !== key));
          setFollowed((prev) => {
            const next = new Set(prev);
            next.add(key);
            return next;
          });
          toast.error(`Could not unfollow ${name}. Please try again.`);
        } else {
          setFollowed((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
          toast.error(`Could not follow ${name}. Please try again.`);
        }
      }
    })();
  }, []);

  const value = useMemo(
    () => ({ followed, hydrated, loaded, isFollowing, toggleFollow }),
    [followed, hydrated, loaded, isFollowing, toggleFollow],
  );

  return (
    <SuperinvestorFollowContext.Provider value={value}>{children}</SuperinvestorFollowContext.Provider>
  );
}

export function useSuperinvestorFollow(): SuperinvestorFollowContextValue {
  const ctx = useContext(SuperinvestorFollowContext);
  if (!ctx) {
    throw new Error("useSuperinvestorFollow must be used within SuperinvestorFollowProvider");
  }
  return ctx;
}
