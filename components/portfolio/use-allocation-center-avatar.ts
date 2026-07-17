"use client";

import { useEffect, useState } from "react";

import { avatarUrlFromUser, initialsFromUser } from "@/lib/auth/user-display";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function useAllocationCenterAvatar() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [initials, setInitials] = useState("?");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase.auth.getUser();
        const u = data.user;
        if (cancelled || !u) return;
        setImageSrc(avatarUrlFromUser(u));
        setInitials(initialsFromUser(u));
      } catch {
        if (!cancelled) setImageSrc(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { imageSrc, initials };
}
