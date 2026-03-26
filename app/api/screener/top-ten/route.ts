import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getTop10ScreenerRows } from "@/lib/screener/top10-quotes";
import { toNormalizedQuote } from "@/lib/screener/screener-top10-api-shape";

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await getTop10ScreenerRows();
  const quotes = rows.map(toNormalizedQuote);
  return NextResponse.json({ rows: quotes });
}
