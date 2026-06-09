"use client";

import { useCallback, useEffect, useState } from "react";

export type NotificationItem = {
  id: string;
  kind: string;
  ticker: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

type NotificationsResponse = {
  items?: NotificationItem[];
  unread?: number;
  error?: string;
};

function mapItem(raw: Record<string, unknown>): NotificationItem | null {
  if (typeof raw.id !== "string") return null;
  return {
    id: raw.id,
    kind: typeof raw.kind === "string" ? raw.kind : "earnings_released",
    ticker: typeof raw.ticker === "string" ? raw.ticker : "",
    title: typeof raw.title === "string" ? raw.title : "",
    body: typeof raw.body === "string" ? raw.body : "",
    href: typeof raw.href === "string" ? raw.href : null,
    readAt: typeof raw.read_at === "string" ? raw.read_at : null,
    createdAt: typeof raw.created_at === "string" ? raw.created_at : "",
  };
}

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
            .map((row) => mapItem(row as unknown as Record<string, unknown>))
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
    try {
      await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
        method: "POST",
        credentials: "include",
      });
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
      );
      setUnread((c) => Math.max(0, c - 1));
    } catch {
      /* best-effort */
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await fetch("/api/notifications", { method: "PATCH", credentials: "include" });
      setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
      setUnread(0);
    } catch {
      /* best-effort */
    }
  }, []);

  const clearAll = useCallback(async () => {
    try {
      await fetch("/api/notifications", { method: "DELETE", credentials: "include" });
      setItems([]);
      setUnread(0);
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
  };
}

export type NotificationsClient = ReturnType<typeof useNotificationsClient>;
