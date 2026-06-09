"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { Bell, ChevronLeft, Settings } from "@/lib/icons";

import { AppPanelModalOverlay } from "@/components/ui/app-panel-modal-overlay";
import { AppPanelModalShell } from "@/components/ui/app-panel-modal-shell";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import type { NotificationsClient } from "@/lib/notifications/use-notifications-client";
import { useNotificationPreferences } from "@/lib/notifications/use-notification-preferences";
import { cn } from "@/lib/utils";

type PanelView = "list" | "settings";

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

const panelHeaderActionButtonClass =
  "inline-flex h-7 shrink-0 items-center justify-center rounded-[10px] bg-[#F4F4F5] text-[#09090B] transition-colors hover:bg-[#EBEBEB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 disabled:cursor-not-allowed disabled:opacity-40";

function NotificationPillSwitch({
  pressed,
  onPressedChange,
  disabled,
  "aria-label": ariaLabel,
}: {
  pressed: boolean;
  onPressedChange: (next: boolean) => void;
  disabled?: boolean;
  "aria-label": string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={pressed}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15",
        pressed ? "bg-[#2563EB]" : "bg-[#E4E4E7]",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform",
          pressed && "translate-x-4",
        )}
        aria-hidden
      />
    </button>
  );
}

export function NotificationsPanelModal({
  open,
  onClose,
  client,
}: {
  open: boolean;
  onClose: () => void;
  client: NotificationsClient;
}) {
  const titleId = useId();
  const [view, setView] = useState<PanelView>("list");
  const { items, loading, error, refresh, markRead, markAllRead, clearAll, unread } = client;
  const {
    earningsResultsEnabled,
    loading: preferencesLoading,
    saving: preferencesSaving,
    setEarningsResults,
    refresh: refreshPreferences,
  } = useNotificationPreferences({ enabled: open });

  useEffect(() => {
    if (open) void refresh({ full: true });
  }, [open, refresh]);

  useEffect(() => {
    if (!open) setView("list");
  }, [open]);

  useEffect(() => {
    if (view === "settings") void refreshPreferences();
  }, [view, refreshPreferences]);

  const hasUnread = unread > 0;
  const hasItems = items.length > 0;
  const inSettings = view === "settings";

  return (
    <AppPanelModalOverlay open={open} onClose={onClose}>
      <AppPanelModalShell
        titleId={titleId}
        title={inSettings ? "Notification settings" : "Notifications"}
        headerLeading={
          inSettings ? (
            <button
              type="button"
              aria-label="Back to notifications"
              onClick={() => setView("list")}
              className={cn(panelHeaderActionButtonClass, "w-7")}
            >
              <ChevronLeft className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            </button>
          ) : null
        }
        onClose={onClose}
        headerActions={
          inSettings ? null : (
            <>
              <button
                type="button"
                onClick={() => void clearAll()}
                disabled={!hasItems}
                className={cn(panelHeaderActionButtonClass, "px-2.5 text-[13px] font-medium")}
              >
                Clear all
              </button>
              <button
                type="button"
                aria-label="Notification settings"
                onClick={() => setView("settings")}
                className={cn(panelHeaderActionButtonClass, "w-7")}
              >
                <Settings className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              </button>
            </>
          )
        }
        bodyClassName="flex min-h-full flex-col px-5 pb-5 pt-5"
        headerClassName="gap-2"
        footer={
          !inSettings && hasUnread ? (
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
        {inSettings ? (
          preferencesLoading ? (
            <div
              className="flex min-h-0 flex-1 items-center justify-center py-12"
              aria-busy="true"
              aria-label="Loading notification settings"
            >
              <Spinner className="size-6 text-[#71717A]" />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-start justify-between gap-4 py-1">
                <div className="min-w-0">
                  <p className="text-[14px] font-medium leading-5 text-[#09090B]">Earning results</p>
                  <p className="mt-0.5 text-[13px] leading-5 text-[#71717A]">
                    Earnings result for companies you follow
                  </p>
                </div>
                <NotificationPillSwitch
                  pressed={earningsResultsEnabled}
                  onPressedChange={(next) => void setEarningsResults(next)}
                  disabled={preferencesSaving}
                  aria-label="Earning results notifications"
                />
              </div>
            </div>
          )
        ) : loading && items.length === 0 ? (
          <div
            className="flex min-h-0 flex-1 items-center justify-center py-12"
            aria-busy="true"
            aria-label="Loading notifications"
          >
            <Spinner className="size-6 text-[#71717A]" />
          </div>
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
