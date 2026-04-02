import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getMacroDashboardPayloadCached } from "@/lib/market/macro-dashboard-payload";
import { isSingleAssetMode } from "@/lib/features/single-asset";

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (isSingleAssetMode()) {
    return NextResponse.json({ country: null, items: [] }, { headers: { "Cache-Control": "public, s-maxage=30" } });
  }

  const { country, items } = await getMacroDashboardPayloadCached();

  return NextResponse.json(
    { country, items },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800",
      },
    },
  );
}

