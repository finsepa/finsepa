import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { toNormalizedQuote } from "@/lib/screener/screener-top10-api-shape";
import { getMockScreenerCompaniesNvdaBtcRows } from "@/lib/fixtures/screener-companies-test";

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = getMockScreenerCompaniesNvdaBtcRows();
  const quotes = rows.map(toNormalizedQuote);
  return NextResponse.json({ rows: quotes });
}
