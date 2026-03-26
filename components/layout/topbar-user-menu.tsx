"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { PATH_LOGIN } from "@/lib/auth/routes";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { UserAvatar } from "@/components/user/user-avatar";

type TopbarUserMenuProps = {
  userInitials: string;
  avatarUrl: string | null;
};

export function TopbarUserMenu({ userInitials, avatarUrl }: TopbarUserMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.refresh();
      router.push(PATH_LOGIN);
    } finally {
      setSigningOut(false);
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 items-center gap-2 rounded-[10px] border border-[#E4E4E7] bg-white px-2 text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-all duration-100 hover:bg-[#F4F4F5]"
      >
        <Menu className="h-5 w-5 shrink-0" />
        <UserAvatar imageSrc={avatarUrl} initials={userInitials} size="sm" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 min-w-[160px] rounded-[10px] border border-[#E4E4E7] bg-white py-1 shadow-[0px_4px_12px_0px_rgba(10,10,10,0.08)]"
        >
          <Link
            href="/account"
            role="menuitem"
            className="block px-3 py-2 text-sm font-medium text-[#09090B] transition-colors hover:bg-[#F4F4F5]"
            onClick={() => setOpen(false)}
          >
            Account
          </Link>
          <button
            type="button"
            role="menuitem"
            disabled={signingOut}
            onClick={() => void handleSignOut()}
            className="w-full px-3 py-2 text-left text-sm font-medium text-[#09090B] transition-colors hover:bg-[#F4F4F5] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {signingOut ? "Signing out…" : "Log out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
