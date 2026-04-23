export type UsEquityMarketSession = "pre" | "regular" | "post" | "closed";

/**
 * US equities session in America/New_York (NYSE-style hours, weekdays only).
 * Pre 4:00–9:30, regular 9:30–16:00, post 16:00–20:00; weekends and outside those windows → closed.
 */
export function getUsEquityMarketSession(now: Date): UsEquityMarketSession {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    weekday: "short",
  });
  const parts = fmt.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";

  if (weekday === "Sat" || weekday === "Sun") return "closed";

  const dayMinutes = hour * 60 + minute;
  const preStart = 4 * 60;
  const regularOpen = 9 * 60 + 30;
  const regularClose = 16 * 60;
  const postEnd = 20 * 60;

  if (dayMinutes < preStart || dayMinutes >= postEnd) return "closed";
  if (dayMinutes < regularOpen) return "pre";
  if (dayMinutes < regularClose) return "regular";
  return "post";
}
