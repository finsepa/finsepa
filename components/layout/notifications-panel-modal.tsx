"use client";

import Link from "next/link";
import { useEffect, useId } from "react";
import { Bell } from "@/lib/icons";

import { AppPanelModalOverlay } from "@/components/ui/app-panel-modal-overlay";
import { AppPanelModalShell } from "@/components/ui/app-panel-modal-shell";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useNotificationsClient } from "@/lib/notifications/use-notifications-client";
import { cn } from "@/lib/utils";

function formatRelativeTime(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const diffMs = Date.now() - t;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function NotificationsPanelModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const titleId = useId();
  const { items, loading, error, refresh, markRead, markAllRead, unread } = useNotificationsClient({
    enabled: open,
  });

  useEffect(() => {
    if (open) void refresh({ full: true });
  }, [open, refresh]);

  const hasUnread = unread > 0;

  return (
    <AppPanelModalOverlay open={open} onClose={onClose}>
      <AppPanelModalShell
        titleId={titleId}
        title="Notifications"
        onClose={onClose}
        bodyClassName="flex min-h-full flex-col px-5 pb-5 pt-5"
        headerClassName="gap-2"
        footer={
          hasUnread ? (
            <div className="shrink-0 border-t border-[#E4E4E7] px-5 py-3">
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-[13px] font-medium text-[#2563EB] hover:text-[#1D4ED8]"
              >
                Mark all as read
              </button>
            </div>
          ) : null
        }
      >
        {loading && items.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[#71717A]">Loading…</p>
        ) : error && items.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[#71717A]">{error}</p>
        ) : items.length === 0 ? (
          <Empty variant="plain" className="min-h-0 flex-1 justify-center py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Bell className="h-6 w-6" strokeWidth={1.75} aria-hidden />
              </EmptyMedia>
              <EmptyTitle>No notifications yet</EmptyTitle>
              <EmptyDescription className="max-w-[260px]">
                When companies in your watchlist or portfolio report earnings, alerts will show up here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="flex min-h-0 flex-1 flex-col gap-1">
            {items.map((item) => {
              const unreadItem = !item.readAt;
              const inner = (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={cn(
                        "text-[14px] leading-5 text-[#09090B]",
                        unreadItem && "font-semibold",
                      )}
                    >
                      {item.title}
                    </p>
                    <span className="shrink-0 text-[11px] tabular-nums text-[#A1A1AA]">
                      {formatRelativeTime(item.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[13px] leading-5 text-[#71717A]">{item.body}</p>
                </>
              );

              const className = cn(
                "block rounded-xl px-3 py-2.5 transition-colors",
                unreadItem ? "bg-[#EFF6FF]" : "hover:bg-[#F4F4F5]",
              );

              if (item.href) {
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      onClick={() => {
                        if (unreadItem) void markRead(item.id);
                        onClose();
                      }}
                      className={className}
                    >
                      {inner}
                    </Link>
                  </li>
                );
              }

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => unreadItem && void markRead(item.id)}
                    className={cn(className, "w-full text-left")}
                  >
                    {inner}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </AppPanelModalShell>
    </AppPanelModalOverlay>
  );
}
