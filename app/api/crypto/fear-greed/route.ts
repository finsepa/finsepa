import { NextResponse } from "next/server";

import { CACHE_CONTROL_PRIVATE_WARM } from "@/lib/data/cache-policy";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getCryptoFearGreedHistory } from "@/lib/market/alternative-fear-greed";

export async function GET(request: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const limitRaw = limitParam == null ? 180 : Number(limitParam);
  const limit = Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : 180;

  const points = await getCryptoFearGreedHistory(limit);
  return NextResponse.json(
    { points, limit },
    { headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_WARM } },
  );
}

