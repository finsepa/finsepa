import { NextResponse } from "next/server";

import { resolveAuthUserFromRequest } from "@/lib/auth/resolve-auth-user";
import { CACHE_CONTROL_PRIVATE_WARM } from "@/lib/data/cache-policy";
import { getEtfProfile } from "@/lib/market/etf-profile";

type Ctx = { params: Promise<{ ticker: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const user = await resolveAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ticker } = await params;
  const routeTicker = decodeURIComponent(ticker).trim().toUpperCase();
  if (!/^[A-Z0-9.-]{1,12}$/.test(routeTicker)) {
    return NextResponse.json({ error: "Invalid ticker." }, { status: 400 });
  }

  const profile = await getEtfProfile(routeTicker);
  return NextResponse.json(
    { ticker: routeTicker, profile },
    { headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_WARM } },
  );
}
