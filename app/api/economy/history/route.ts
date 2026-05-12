import { NextResponse, type NextRequest } from "next/server";

import { REVALIDATE_EARNINGS_CALENDAR } from "@/lib/data/cache-policy";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { fetchEodhdEconomicEventsAll } from "@/lib/market/eodhd-economic-events";

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

  const now = new Date();
  const toDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const fromDate = new Date(toDate);
  fromDate.setUTCFullYear(fromDate.getUTCFullYear() - 5);

  const toYmd = fmtYmd(toDate);
  const fromYmd = fmtYmd(fromDate);

  const raw = await fetchEodhdEconomicEventsAll(fromYmd, toYmd, country);

  const normalizedComparison = (comparison ?? "").toLowerCase().trim();

  const points = raw
    .filter((r) => {
      if (!r.type || r.type.trim() !== eventType) return false;
      const rc = (r.comparison ?? "").toLowerCase().trim();
      if (normalizedComparison && rc !== normalizedComparison) return false;
      if (!normalizedComparison && rc) return false;
      return r.actual != null || r.previous != null || r.estimate != null;
    })
    .map((r) => ({
      date: r.date ?? "",
      period: r.period ?? null,
      actual: r.actual ?? null,
      estimate: r.estimate ?? null,
      previous: r.previous ?? null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json(
    { eventType, country, points },
    {
      headers: {
        "Cache-Control": `public, s-maxage=${REVALIDATE_EARNINGS_CALENDAR}, stale-while-revalidate=${REVALIDATE_EARNINGS_CALENDAR * 2}`,
      },
    },
  );
}

function fmtYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
