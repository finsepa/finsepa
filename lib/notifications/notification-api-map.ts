import type { UserNotificationRow } from "@/lib/notifications/earnings-notify-types";

export type ClientNotificationItem = {
  id: string;
  kind: string;
  ticker: string;
  title: string;
  body: string;
  href: string | null;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

export function toClientNotificationItem(row: UserNotificationRow): ClientNotificationItem {
  return {
    id: row.id,
    kind: row.kind,
    ticker: row.ticker,
    title: row.title,
    body: row.body,
    href: row.href,
    payload: row.payload ?? {},
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

/** Accept API rows in snake_case or camelCase. */
export function parseClientNotificationItem(raw: Record<string, unknown>): ClientNotificationItem | null {
  if (typeof raw.id !== "string") return null;

  const readAtRaw = raw.readAt ?? raw.read_at;
  const readAt =
    typeof readAtRaw === "string" && readAtRaw.trim() ? readAtRaw : null;

  const createdAtRaw = raw.createdAt ?? raw.created_at;
  const createdAt = typeof createdAtRaw === "string" ? createdAtRaw : "";

  return {
    id: raw.id,
    kind: typeof raw.kind === "string" ? raw.kind : "earnings_released",
    ticker: typeof raw.ticker === "string" ? raw.ticker : "",
    title: typeof raw.title === "string" ? raw.title : "",
    body: typeof raw.body === "string" ? raw.body : "",
    href: typeof raw.href === "string" ? raw.href : null,
    payload:
      raw.payload && typeof raw.payload === "object" && !Array.isArray(raw.payload)
        ? (raw.payload as Record<string, unknown>)
        : {},
    readAt,
    createdAt,
  };
}
