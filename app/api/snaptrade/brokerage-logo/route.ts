import { NextResponse } from "next/server";

import { requireAuthUser, AuthRequiredError } from "@/lib/watchlist/api-auth";
import {
  getSnapTradeBrokerageBrandForAuthorization,
  isSnapTradeConfigured,
  SnapTradeNotConfiguredError,
  SnapTradeUserStoreError,
} from "@/lib/snaptrade/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    if (!isSnapTradeConfigured()) {
      return NextResponse.json({ error: "SnapTrade is not configured." }, { status: 503 });
    }

    const authorizationId = new URL(request.url).searchParams.get("authorizationId")?.trim();
    if (!authorizationId) {
      return NextResponse.json({ error: "authorizationId is required." }, { status: 400 });
    }

    const supabase = await getSupabaseServerClient();
    const user = await requireAuthUser(supabase);

    const brand = await getSnapTradeBrokerageBrandForAuthorization(user.id, authorizationId);
    if (!brand) {
      return NextResponse.json({ error: "Brokerage connection not found." }, { status: 404 });
    }

    return NextResponse.json(brand);
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e instanceof SnapTradeNotConfiguredError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    if (e instanceof SnapTradeUserStoreError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    const message = e instanceof Error ? e.message : "Failed to load brokerage logo.";
    console.error("[snaptrade/brokerage-logo GET]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
