"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, ChevronDown, Folder, Search, SquarePlus, Star } from "lucide-react";
import { SearchModal } from "./search-modal";
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

  return (
    <>
      <header className="flex h-[60px] items-center justify-between px-4 py-3">
        {/* Search */}
        <button
          onClick={() => setSearchOpen(true)}
          className="flex h-9 w-[300px] cursor-text items-center gap-2 rounded-lg bg-[#F4F4F5] px-4 transition-all duration-100 hover:bg-[#EBEBEB]"
        >
          <Search className="h-5 w-5 shrink-0 text-[#09090B]" />
          <span className="flex-1 text-left text-sm leading-5 text-[#A1A1AA]">Search...</span>
          <kbd className="rounded border border-neutral-200 bg-white px-1.5 py-0.5 font-sans text-[10px] font-medium text-[#A1A1AA]">
            S
          </kbd>
        </button>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <IconButton>
            <Bell className="h-5 w-5" />
          </IconButton>

          <Link href="/watchlist">
            <IconButton>
              <Star className="h-5 w-5" />
            </IconButton>
          </Link>

          <IconButton>
            <SquarePlus className="h-5 w-5" />
          </IconButton>

          <div className="h-5 w-px bg-[#E4E4E7]" />

          {/* Balance pill */}
          <div className="flex h-9 items-center overflow-hidden rounded-[10px] border border-[#E4E4E7] bg-white shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-all duration-100 hover:bg-[#F4F4F5]">
            <div className="flex items-center gap-2 border-r border-[#E4E4E7] px-3 text-sm font-medium text-[#09090B]">
              <Folder className="h-5 w-5 shrink-0 text-[#09090B]" />
              <span>$274,36.40</span>
            </div>
            <button className="flex h-full items-center justify-center px-2 text-[#09090B] transition-all duration-100 hover:bg-[#F4F4F5]">
              <ChevronDown className="h-5 w-5" />
            </button>
          </div>

          <TopbarUserMenu userInitials={userInitials} avatarUrl={avatarUrl} />
        </div>
      </header>

      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
    </>
  );
}
