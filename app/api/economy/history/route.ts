import { NextResponse, type NextRequest } from "next/server";

import { REVALIDATE_EARNINGS_CALENDAR } from "@/lib/data/cache-policy";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { fetchEconomyEventHistoryPoints } from "@/lib/market/economy-event-history-data";

export async function GET(req: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const eventType = sp.get("type")?.trim();
  const country = (sp.get("country") ?? "US").trim().toUpperCase();
  const comparison = sp.get("comparison") ?? null;

  if (!eventType) {
    return NextResponse.json({ error: "Missing `type` param" }, { status: 400 });
  }

  const points = await fetchEconomyEventHistoryPoints(eventType, country, comparison);

  return NextResponse.json(
    { eventType, country, points },
    {
      headers: {
        "Cache-Control": `public, s-maxage=${REVALIDATE_EARNINGS_CALENDAR}, stale-while-revalidate=${REVALIDATE_EARNINGS_CALENDAR * 2}`,
      },
    },
  );
}
