import { NextResponse } from "next/server";

import { getEarningsDayListSlice, mondayOfWeekUtc } from "@/lib/market/earnings-week-data";
import {
  filterEarningsCalendarItems,
  parseAllowedScopeKeysParam,
} from "@/lib/market/earnings-scope-filter";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { AuthRequiredError, requireAuthUser } from "@/lib/watchlist/api-auth";

function parseWeekMonday(week: string | null): Date | null {
  if (!week?.trim()) return null;
  const t = Date.parse(`${week.trim()}T12:00:00.000Z`);
  if (!Number.isFinite(t)) return null;
  return mondayOfWeekUtc(new Date(t));
}

/**
 * Lazy-loaded earnings list rows for one weekday (same cached week package as the SSR grid).
 */
export async function GET(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    await requireAuthUser(supabase);
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }

  const url = new URL(request.url);
  const week = url.searchParams.get("week");
  const day = url.searchParams.get("day");
  const offsetRaw = url.searchParams.get("offset");
  const limitRaw = url.searchParams.get("limit");

  const monday = parseWeekMonday(week);
  if (!monday || !day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return NextResponse.json({ error: "Invalid week or day" }, { status: 400 });
  }

  const offset = offsetRaw != null ? Number(offsetRaw) : 0;
  const limit = limitRaw != null ? Number(limitRaw) : 50;
  const safeOffset = Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0;
  const safeLimit = Number.isFinite(limit) ? Math.min(50, Math.max(1, Math.floor(limit))) : 50;

  const all = await getEarningsDayListSlice(monday, day, 0, 500);
  const allowedKeys = parseAllowedScopeKeysParam(url.searchParams.get("allowed"));
  const filtered =
    allowedKeys && allowedKeys.size === 0 ? [] : filterEarningsCalendarItems(all, allowedKeys);

  const items = filtered.slice(safeOffset, safeOffset + safeLimit);
  return NextResponse.json({ items, total: filtered.length, offset: safeOffset, limit: safeLimit });
}
