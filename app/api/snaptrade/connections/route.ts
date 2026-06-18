import { NextResponse } from "next/server";

import { requireAuthUser, AuthRequiredError } from "@/lib/watchlist/api-auth";
import {
  isSnapTradeConfigured,
  listSnapTradeConnections,
  SnapTradeNotConfiguredError,
  SnapTradeUserStoreError,
} from "@/lib/snaptrade/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    if (!isSnapTradeConfigured()) {
      return NextResponse.json({ configured: false, connections: [] });
    }

    const supabase = await getSupabaseServerClient();
    const user = await requireAuthUser(supabase);

    const connections = await listSnapTradeConnections(user.id);
    return NextResponse.json({ configured: true, connections });
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e instanceof SnapTradeNotConfiguredError) {
      return NextResponse.json({ configured: false, connections: [] });
    }
    if (e instanceof SnapTradeUserStoreError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    const message = e instanceof Error ? e.message : "Failed to list brokerage connections.";
    console.error("[snaptrade/connections GET]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
