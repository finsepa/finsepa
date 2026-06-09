"use client";

import { useCallback, useEffect, useState } from "react";

import { parseClientNotificationItem, type ClientNotificationItem } from "@/lib/notifications/notification-api-map";

export type NotificationItem = ClientNotificationItem;

type NotificationsResponse = {
  items?: NotificationItem[];
  unread?: number;
  error?: string;
};

export function useNotificationsClient(options?: { pollUnreadMs?: number; enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const pollUnreadMs = options?.pollUnreadMs ?? 60_000;

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (opts?: { full?: boolean }) => {
    if (!enabled) return;
    const full = opts?.full ?? false;
    if (full) setLoading(true);
    try {
      const res = await fetch(full ? "/api/notifications" : "/api/notifications?count=1", {
        credentials: "include",
      });
      const json = (await res.json()) as NotificationsResponse;
      if (!res.ok) {
        setError(json.error ?? "Failed to load notifications");
        return;
      }
      setError(null);
      if (typeof json.unread === "number") setUnread(json.unread);
      if (full && Array.isArray(json.items)) {
        setItems(
          json.items
            .map((row) => parseClientNotificationItem(row as unknown as Record<string, unknown>))
            .filter(Boolean) as NotificationItem[],
        );
      }
    } catch {
      setError("Failed to load notifications");
    } finally {
      if (full) setLoading(false);
    }
  }, [enabled]);

  const markRead = useCallback(async (id: string) => {
    let wasUnread = false;
    setItems((prev) => {
      const target = prev.find((n) => n.id === id);
      wasUnread = Boolean(target && !target.readAt);
      if (!wasUnread) return prev;
      return prev.map((n) =>
        n.id === id ? { ...n, readAt: new Date().toISOString() } : n,
      );
    });
    if (wasUnread) setUnread((c) => Math.max(0, c - 1));

    try {
      const res = await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        setItems((prev) =>
          prev.map((n) => (n.id === id ? { ...n, readAt: null } : n)),
        );
        if (wasUnread) setUnread((c) => c + 1);
      }
    } catch {
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: null } : n)),
      );
      if (wasUnread) setUnread((c) => c + 1);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { method: "PATCH", credentials: "include" });
      if (!res.ok) return;
      setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
      setUnread(0);
    } catch {
      /* best-effort */
    }
  }, []);

  const clearAll = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { method: "DELETE", credentials: "include" });
      if (!res.ok) return;
      setItems([]);
      setUnread(0);
      void refresh({ full: false });
    } catch {
      /* best-effort */
    }
  }, [refresh]);

  const removeNotification = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) return;
      setItems((prev) => {
        const target = prev.find((n) => n.id === id);
        if (target && !target.readAt) {
          setUnread((c) => Math.max(0, c - 1));
        }
        return prev.filter((n) => n.id !== id);
      });
    } catch {
      /* best-effort */
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh({ full: false });
    const id = window.setInterval(() => void refresh({ full: false }), pollUnreadMs);
    return () => window.clearInterval(id);
  }, [enabled, pollUnreadMs, refresh]);

  return {
    items,
    unread,
    loading,
    error,
    refresh,
    markRead,
    markAllRead,
    clearAll,
    removeNotification,
  };
}

export type NotificationsClient = ReturnType<typeof useNotificationsClient>;
