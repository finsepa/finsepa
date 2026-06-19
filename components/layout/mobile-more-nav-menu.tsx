"use client";

import Link from "next/link";
import { motion } from "motion/react";

import {
  protectedNavItemIsActive,
  type ProtectedNavItem,
} from "@/components/layout/protected-nav-config";
import { cn } from "@/lib/utils";

const soonBadgeClass =
  "ml-auto shrink-0 rounded-md border border-[#E4E4E7] bg-[#F4F4F5] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#71717A]";

const listVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.028, delayChildren: 0.08 },
  },
};

const rowVariants = {
  hidden: { opacity: 0, y: -8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.18, ease: [0.33, 1, 0.68, 1] as const },
  },
};

function MoreNavRow({
  item,
  pathname,
  onNavigate,
}: {
  item: ProtectedNavItem;
  pathname: string;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  const active = protectedNavItemIsActive(item, pathname);
  const rowClass = cn(
    "flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-medium leading-5 transition-colors",
    item.available ? "text-[#09090B]" : "cursor-not-allowed text-[#A1A1AA]",
    item.available && (active ? "bg-[#F4F4F5]" : "active:bg-neutral-100"),
  );
  const iconClass = cn("h-5 w-5 shrink-0", item.available ? "text-[#09090B]" : "text-[#A1A1AA]");

  if (item.available) {
    return (
      <Link prefetch={false} href={item.href} className={rowClass} onClick={() => onNavigate()}>
        <Icon className={iconClass} aria-hidden />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
      </Link>
    );
  }

  return (
    <div className={rowClass} aria-disabled="true">
      <Icon className={iconClass} aria-hidden />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      <span className={soonBadgeClass}>Soon</span>
    </div>
  );
}

/** Menu list rendered inside the expanding bottom-nav pill. */
export function MobileMoreNavList({
  items,
  pathname,
  onNavigate,
}: {
  items: readonly ProtectedNavItem[];
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <motion.div
      className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden p-1.5"
      aria-label="More"
      initial="hidden"
      animate="show"
      exit="hidden"
      variants={listVariants}
    >
      {items.map((item) => (
        <motion.div key={item.label} variants={rowVariants}>
          <MoreNavRow item={item} pathname={pathname} onNavigate={onNavigate} />
        </motion.div>
      ))}
    </motion.div>
  );
}
