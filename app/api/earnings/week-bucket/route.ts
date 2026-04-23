import { NextResponse } from "next/server";

import { addDaysUtc, getEarningsTimingBucketOverflow, mondayOfWeekUtc, toYmdUtc } from "@/lib/market/earnings-week-data";
import type { EarningsTimingBucketId } from "@/lib/market/earnings-calendar-types";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { AuthRequiredError, requireAuthUser } from "@/lib/watchlist/api-auth";

const BUCKET_IDS: readonly EarningsTimingBucketId[] = ["bmo", "amc", "unknown"];

function parseWeekMonday(week: string | null): Date | null {
  if (!week?.trim()) return null;
  const t = Date.parse(`${week.trim()}T12:00:00.000Z`);
  if (!Number.isFinite(t)) return null;
  return mondayOfWeekUtc(new Date(t));
}

function isBucketId(s: string): s is EarningsTimingBucketId {
  return (BUCKET_IDS as readonly string[]).includes(s);
}

function isDayInWeek(monday: Date, dayYmd: string): boolean {
  for (let i = 0; i < 5; i++) {
    if (toYmdUtc(addDaysUtc(monday, i)) === dayYmd) return true;
  }
  return false;
}

/**
 * Lazy-loaded earnings cards for one timing bucket (same cached week package as the SSR grid).
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
  const timingRaw = url.searchParams.get("timing");

  const monday = parseWeekMonday(week);
  if (!monday || !day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return NextResponse.json({ error: "Invalid week or day" }, { status: 400 });
  }
  if (!timingRaw || !isBucketId(timingRaw)) {
    return NextResponse.json({ error: "Invalid timing" }, { status: 400 });
  }
  if (!isDayInWeek(monday, day)) {
    return NextResponse.json({ error: "Day not in week" }, { status: 400 });
  }

  const items = await getEarningsTimingBucketOverflow(monday, day, timingRaw);
  return NextResponse.json({ items });
}
