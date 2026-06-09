"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Bell, ChevronLeft, Settings, X } from "@/lib/icons";

import { EarningsPreviewModal } from "@/components/earnings/earnings-preview-modal";
import {
  APP_PANEL_MODAL_EXIT_CLASS,
  AppPanelModalOverlay,
} from "@/components/ui/app-panel-modal-overlay";
import { AppPanelModalShell } from "@/components/ui/app-panel-modal-shell";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { EarningsNotificationCard } from "@/components/layout/earnings-notification-card";
import { Spinner } from "@/components/ui/spinner";
import {
  parseEarningsNotificationPayload,
  resolveNotificationTicker,
} from "@/lib/notifications/earnings-notification-model";
import type { NotificationItem, NotificationsClient } from "@/lib/notifications/use-notifications-client";
import { useNotificationPreferences } from "@/lib/notifications/use-notification-preferences";
import type { EarningsCalendarItem } from "@/lib/market/earnings-calendar-types";
import { readScreenerCompanyIdentity } from "@/lib/screener/screener-company-identity-storage";
import { cn } from "@/lib/utils";

type PanelView = "list" | "settings";

const PANEL_TRANSITION_MS = 400;

const panelHeaderActionButtonClass =
  "inline-flex h-7 shrink-0 items-center justify-center rounded-[10px] bg-[#F4F4F5] text-[#09090B] transition-colors hover:bg-[#EBEBEB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 disabled:cursor-not-allowed disabled:opacity-40";

const NOTIFICATION_UNREAD_DOT_CLASS = "h-2 w-2 rounded-full bg-[#DC2626]";

const notificationDismissButtonClass =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] text-[#71717A] transition-colors hover:bg-[#EBEBEB] hover:text-[#09090B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15";

function notificationToEarningsPreviewItem(item: NotificationItem): EarningsCalendarItem {
  const payload = parseEarningsNotificationPayload(item.payload);
  const displayTicker = resolveNotificationTicker(item);
  const identity = readScreenerCompanyIdentity(displayTicker);
  const reportDate =
    payload?.reportDateYmd ?? (item.createdAt ? item.createdAt.slice(0, 10) : "");
  return {
    ticker: displayTicker,
    companyName: payload?.companyName ?? identity?.name ?? displayTicker,
    logoUrl: payload?.logoUrl ?? identity?.logoUrl ?? "",
    screenerRank: null,
    reportDate,
    timing: "unknown",
    timingLabel: "",
  };
}

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
  const [previewItem, setPreviewItem] = useState<EarningsCalendarItem | null>(null);
  const [previewNotificationId, setPreviewNotificationId] = useState<string | null>(null);
  const [panelExiting, setPanelExiting] = useState(false);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { items, loading, error, refresh, markRead, markAllRead, clearAll, removeNotification, unread } =
    client;
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
    return () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, []);

  const overlayOpen = open || panelExiting || previewItem != null;
  const showPanel = open && (!previewItem || panelExiting);

  const closeEarningsPreview = useCallback(() => {
    if (previewNotificationId) void markRead(previewNotificationId);
    setPreviewItem(null);
    setPreviewNotificationId(null);
  }, [markRead, previewNotificationId]);

  const closeOverlay = useCallback(() => {
    if (previewItem) {
      closeEarningsPreview();
      return;
    }
    if (open) onClose();
  }, [closeEarningsPreview, open, onClose, previewItem]);

  const openEarningsPreview = useCallback(
    (item: NotificationItem) => {
      void markRead(item.id);
      setPreviewNotificationId(item.id);
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);

      setPanelExiting(true);
      setPreviewItem(notificationToEarningsPreviewItem(item));

      transitionTimerRef.current = setTimeout(() => {
        setPanelExiting(false);
        onClose();
        transitionTimerRef.current = null;
      }, PANEL_TRANSITION_MS);
    },
    [markRead, onClose],
  );

  useEffect(() => {
    if (view === "settings") void refreshPreferences();
  }, [view, refreshPreferences]);

  const hasUnread = unread > 0;
  const hasItems = items.length > 0;
  const inSettings = view === "settings";

  return (
    <AppPanelModalOverlay open={overlayOpen} onClose={closeOverlay} layout="layered">
      {showPanel ? (
        <div className="pointer-events-auto absolute inset-y-0 right-0 z-10 flex justify-end">
          <AppPanelModalShell
            titleId={titleId}
            title={inSettings ? "Notification settings" : "Notifications"}
            animateEnter={!panelExiting}
            className={panelExiting ? APP_PANEL_MODAL_EXIT_CLASS : undefined}
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
            bodyClassName={cn(
              "flex min-h-full flex-col",
              inSettings ? "px-5 pb-6 pt-6" : "p-2",
            )}
            headerClassName="gap-2"
            footer={
              !inSettings && hasUnread ? (
                <div className="shrink-0 border-t border-[#E4E4E7] px-2 py-3">
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
                  <div className="flex items-center justify-between gap-4 py-1">
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
                {items.map((item) => (
                  <li key={item.id}>
                    <div className="group relative rounded-[12px] p-3 transition-colors hover:bg-[#F4F4F5]">
                      <button
                        type="button"
                        onClick={() => openEarningsPreview(item)}
                        className="w-full min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2"
                      >
                        <EarningsNotificationCard item={item} />
                      </button>
                      <div className="pointer-events-none absolute right-2 top-2 flex h-7 w-7 items-center justify-center">
                        {!item.readAt ? (
                          <span
                            className={cn(
                              NOTIFICATION_UNREAD_DOT_CLASS,
                              "transition-opacity group-hover:opacity-0 group-focus-within:opacity-0",
                            )}
                            aria-hidden
                          />
                        ) : null}
                      </div>
                      <button
                        type="button"
                        aria-label="Dismiss notification"
                        onClick={() => void removeNotification(item.id)}
                        className={cn(
                          notificationDismissButtonClass,
                          "absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100",
                        )}
                      >
                        <X className="h-4 w-4" strokeWidth={2} aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </AppPanelModalShell>
        </div>
      ) : null}

      {previewItem ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-y-auto p-4">
          <div className="pointer-events-auto my-auto w-full max-w-[min(960px,calc(100vw-2rem))] shrink-0">
            <EarningsPreviewModal
              item={previewItem}
              onClose={closeEarningsPreview}
              embedded
            />
          </div>
        </div>
      ) : null}
    </AppPanelModalOverlay>
  );
}
