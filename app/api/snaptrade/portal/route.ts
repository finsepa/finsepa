import { NextResponse } from "next/server";

import { brokerageProRequiredError } from "@/lib/account/brokerage-plan-gate";
import { requireAuthUserFromRequest, AuthRequiredError } from "@/lib/watchlist/api-auth";
import {
  createSnapTradePortalLink,
  isSnapTradeConfigured,
  SnapTradeNotConfiguredError,
  SnapTradeUserStoreError,
} from "@/lib/snaptrade/server";
import { getSupabaseClientForRequest } from "@/lib/supabase/request-client";

export async function POST(request: Request) {
  try {
    if (!isSnapTradeConfigured()) {
      return NextResponse.json({ error: "SnapTrade is not configured." }, { status: 503 });
    }

    const user = await requireAuthUserFromRequest(request);
    const supabase = await getSupabaseClientForRequest(request);

    const blocked = await brokerageProRequiredError(supabase, user.id);
    if (blocked) {
      return NextResponse.json(blocked, { status: 403 });
    }

    let reconnectAuthorizationId: string | null = null;
    let darkMode = false;
    try {
      const body = (await request.json()) as {
        reconnectAuthorizationId?: unknown;
        darkMode?: unknown;
      };
      if (typeof body.reconnectAuthorizationId === "string" && body.reconnectAuthorizationId.trim()) {
        reconnectAuthorizationId = body.reconnectAuthorizationId.trim();
      }
      darkMode = body.darkMode === true;
    } catch {
      // Empty body is fine for a fresh connection.
    }

    const redirectUri = await createSnapTradePortalLink(user.id, {
      reconnectAuthorizationId,
      darkMode,
    });
    return NextResponse.json({ redirectUri });
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
    const message = e instanceof Error ? e.message : "Failed to open SnapTrade portal.";
    console.error("[snaptrade/portal POST]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
