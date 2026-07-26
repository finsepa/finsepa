/** Derive a short chat title from the first user message (no LLM call). */
export function deriveAgentThreadTitle(message: string): string {
  let t = message.replace(/\s+/g, " ").trim();
  if (!t) return "New chat";

  // Drop common lead-ins
  t = t.replace(/^(can you|could you|please|hey|hi|hello)[,:]?\s+/i, "");
  t = t.replace(/^(show me|tell me|give me|what(?:'s| is)|how)\s+/i, "");

  // Capitalize first letter
  t = t.charAt(0).toUpperCase() + t.slice(1);

  // Trim length at word boundary
  const max = 48;
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  const base = (lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trim();
  return `${base}…`;
}

export function relativeThreadTimeLabel(iso: string, now = new Date()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const diffMs = Math.max(0, now.getTime() - t);
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1d";
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  return `${Math.floor(days / 30)}mo`;
}

export type ThreadTimeGroup = "Today" | "Yesterday" | "Last week" | "Older";

export function threadTimeGroup(iso: string, now = new Date()): ThreadTimeGroup {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "Older";
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startYesterday.getDate() - 1);
  const startWeek = new Date(startToday);
  startWeek.setDate(startWeek.getDate() - 7);

  if (t >= startToday.getTime()) return "Today";
  if (t >= startYesterday.getTime()) return "Yesterday";
  if (t >= startWeek.getTime()) return "Last week";
  return "Older";
}
