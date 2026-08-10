import { NextResponse } from "next/server";

import { CACHE_CONTROL_PRIVATE_EARNINGS_OVERFLOW } from "@/lib/data/cache-policy";
import { earningsDayListItems } from "@/lib/market/earnings-scope-filter";
import { sortEarningsCalendarItemsByMarketCap } from "@/lib/market/earnings-week-grid-layout";
import {
  getEarningsWeekPageData,
  mondayOfWeekUtc,
  toYmdUtc,
} from "@/lib/market/earnings-week-data";
import { AuthRequiredError, requireAuthUserFromRequest } from "@/lib/watchlist/api-auth";

function parseWeekMonday(week: string | null): Date | null {
  if (!week?.trim()) return null;
  const t = Date.parse(`${week.trim()}T12:00:00.000Z`);
  if (!Number.isFinite(t)) return null;
  return mondayOfWeekUtc(new Date(t));
}

/**
 * Full Mon–Fri earnings week for native clients (one round-trip).
 * Auth: Bearer or cookie via `requireAuthUserFromRequest` (native iOS).
 */
export async function GET(request: Request) {
  try {
    await requireAuthUserFromRequest(request);
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }

  const url = new URL(request.url);
  const monday = parseWeekMonday(url.searchParams.get("week")) ?? mondayOfWeekUtc(new Date());
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw != null ? Number(limitRaw) : 10;
  const safeLimit = Number.isFinite(limit) ? Math.min(50, Math.max(1, Math.floor(limit))) : 10;

  const pack = await getEarningsWeekPageData(monday);
  const days = pack.payload.days.map((day) => {
    const items = sortEarningsCalendarItemsByMarketCap(earningsDayListItems(day)).slice(0, safeLimit);
    return {
      date: day.date,
      weekdayLabel: day.weekdayLabel,
      dayNumber: day.dayNumber,
      items,
    };
  });

  return NextResponse.json(
    {
      weekMondayYmd: toYmdUtc(monday),
      weekLabel: pack.payload.weekLabel,
      days,
      hasAnyEvents: pack.payload.hasAnyEvents,
    },
    { headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_EARNINGS_OVERFLOW } },
  );
}
