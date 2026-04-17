"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleQuestionMark, LogOut, Menu, User } from "lucide-react";

import {
  dropdownMenuPanelBodyClassName,
  dropdownMenuPlainItemClassName,
  dropdownMenuSurfaceClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { UserAvatar } from "@/components/user/user-avatar";
import { PATH_LOGIN } from "@/lib/auth/routes";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

type TopbarUserMenuProps = {
  userInitials: string;
  avatarUrl: string | null;
  /** Full name for menu header (same source as workspace listing owner). */
  userDisplayName: string;
};

export function TopbarUserMenu({ userInitials, avatarUrl, userDisplayName }: TopbarUserMenuProps) {
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
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
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

  const itemClass = cn(dropdownMenuPlainItemClassName(), "font-medium no-underline");

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 items-center gap-1.5 rounded-[10px] border border-[#E4E4E7] bg-white px-1.5 text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-all duration-100 hover:bg-[#F4F4F5] sm:h-9 sm:gap-2 sm:px-2"
      >
        <Menu className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
        <UserAvatar imageSrc={avatarUrl} initials={userInitials} size="sm" />
      </button>

      {open ? (
        <div
          role="menu"
          className={cn(
            dropdownMenuSurfaceClassName(),
            "absolute right-0 top-full z-[120] mt-1 min-w-[240px] overflow-hidden",
          )}
        >
          <div className="flex gap-3 border-b border-[#E4E4E7] px-3 py-3">
            <UserAvatar imageSrc={avatarUrl} initials={userInitials} size="menu" />
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="truncate text-sm font-semibold leading-5 text-[#09090B]">{userDisplayName}</div>
              <div className="mt-0.5 text-xs font-normal leading-4 text-[#52525B]">Free plan</div>
            </div>
          </div>

          <div className={dropdownMenuPanelBodyClassName}>
            <Link
              href="/account"
              role="menuitem"
              className={itemClass}
              onClick={() => setOpen(false)}
            >
              <User className="h-4 w-4 shrink-0 text-[#09090B]" strokeWidth={1.75} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-left">Account</span>
            </Link>
            <a
              href="mailto:hi@finsepa.com"
              role="menuitem"
              className={itemClass}
              onClick={() => setOpen(false)}
            >
              <CircleQuestionMark className="h-4 w-4 shrink-0 text-[#09090B]" strokeWidth={1.75} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-left">Help</span>
            </a>
            <button
              type="button"
              role="menuitem"
              disabled={signingOut}
              onClick={() => void handleSignOut()}
              className={cn(itemClass, "disabled:cursor-not-allowed disabled:opacity-60")}
            >
              <LogOut className="h-4 w-4 shrink-0 text-[#09090B]" strokeWidth={1.75} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-left">
                {signingOut ? "Signing out…" : "Log out"}
              </span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
