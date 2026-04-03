"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, ChevronDown, Folder, Search, SquarePlus, Star } from "lucide-react";
import {
  TOPBAR_SHOW_NOTIFICATIONS,
  TOPBAR_SHOW_PORTFOLIO_BLOCK,
  TOPBAR_SHOW_QUICK_ADD,
} from "@/lib/features/topbar-flags";
import { OPEN_SEARCH_EVENT, SearchModal } from "./search-modal";
import { TopbarUserMenu } from "./topbar-user-menu";

function IconButton({ children }: { children: React.ReactNode }) {
  return (
    <button className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#E4E4E7] bg-white text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-all duration-100 hover:bg-[#F4F4F5]">
      {children}
    </button>
  );
}

export function Topbar({
  userInitials,
  avatarUrl,
}: {
  userInitials: string;
  avatarUrl: string | null;
}) {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "s" && e.key !== "S") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, [contenteditable=true], [role=textbox]")) return;
      e.preventDefault();
      setSearchOpen(true);
    }
    function onOpenSearch() {
      setSearchOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SEARCH_EVENT, onOpenSearch);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_SEARCH_EVENT, onOpenSearch);
    };
  }, []);

  return (
    <>
      <header className="flex h-[60px] items-center justify-between px-4 py-3">
        {/* Search */}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label="Search (shortcut S)"
          className="flex h-9 w-[300px] cursor-pointer items-center gap-2 rounded-lg bg-[#F4F4F5] px-4 text-left transition-all duration-100 hover:bg-[#EBEBEB]"
        >
          <Search className="h-5 w-5 shrink-0 text-[#09090B]" aria-hidden />
          <span className="flex-1 text-sm leading-5 text-[#A1A1AA]">Search...</span>
          <kbd
            className="pointer-events-none rounded border border-neutral-200 bg-white px-1.5 py-0.5 font-sans text-[10px] font-medium text-[#A1A1AA]"
            aria-hidden
          >
            S
          </kbd>
        </button>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {TOPBAR_SHOW_NOTIFICATIONS ? (
            <IconButton>
              <Bell className="h-5 w-5" />
            </IconButton>
          ) : null}

          <Link href="/watchlist">
            <IconButton>
              <Star className="h-5 w-5" />
            </IconButton>
          </Link>

          {TOPBAR_SHOW_QUICK_ADD ? (
            <IconButton>
              <SquarePlus className="h-5 w-5" />
            </IconButton>
          ) : null}

          {TOPBAR_SHOW_PORTFOLIO_BLOCK ? (
            <>
              <div className="h-5 w-px bg-[#E4E4E7]" />
              {/* Balance pill */}
              <div className="flex h-9 items-center overflow-hidden rounded-[10px] border border-[#E4E4E7] bg-white shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-all duration-100 hover:bg-[#F4F4F5]">
                <div className="flex items-center gap-2 border-r border-[#E4E4E7] px-3 text-sm font-medium text-[#09090B]">
                  <Folder className="h-5 w-5 shrink-0 text-[#09090B]" />
                  <span>—</span>
                </div>
                <button
                  type="button"
                  className="flex h-full items-center justify-center px-2 text-[#09090B] transition-all duration-100 hover:bg-[#F4F4F5]"
                >
                  <ChevronDown className="h-5 w-5" />
                </button>
              </div>
            </>
          ) : null}

          <TopbarUserMenu userInitials={userInitials} avatarUrl={avatarUrl} />
        </div>
      </header>

      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
    </>
  );
}
