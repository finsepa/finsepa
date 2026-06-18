import { NextResponse } from "next/server";

import { requireAuthUser, AuthRequiredError } from "@/lib/watchlist/api-auth";
import {
  isSnapTradeConfigured,
  SnapTradeNotConfiguredError,
  SnapTradeUserStoreError,
} from "@/lib/snaptrade/server";
import {
  latestSnapTradeAuthorizationId,
  syncSnapTradeAuthorization,
} from "@/lib/snaptrade/sync-brokerage";
import { normalizePortfolioSnaptradeSyncSettings } from "@/lib/snaptrade/sync-settings";
import { normalizeSnaptradeUpdateFromYmd } from "@/lib/snaptrade/sync-update-from";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    if (!isSnapTradeConfigured()) {
      return NextResponse.json({ error: "SnapTrade is not configured." }, { status: 503 });
    }

    const supabase = await getSupabaseServerClient();
    const user = await requireAuthUser(supabase);

    let body: { authorizationId?: unknown; syncSettings?: unknown; updateFromYmd?: unknown } = {};
    try {
      body = (await request.json()) as {
        authorizationId?: unknown;
        syncSettings?: unknown;
        updateFromYmd?: unknown;
      };
    } catch {
      /* empty body ok */
    }

    const syncSettings = normalizePortfolioSnaptradeSyncSettings(body.syncSettings);
    const updateFromYmd = normalizeSnaptradeUpdateFromYmd(body.updateFromYmd);

    let authorizationId =
      typeof body.authorizationId === "string" && body.authorizationId.trim()
        ? body.authorizationId.trim()
        : null;

    if (!authorizationId) {
      authorizationId = await latestSnapTradeAuthorizationId(user.id);
    }
    if (!authorizationId) {
      return NextResponse.json({ error: "No brokerage connection found to sync." }, { status: 404 });
    }

    const result = await syncSnapTradeAuthorization(
      user.id,
      authorizationId,
      syncSettings,
      updateFromYmd,
    );
    return NextResponse.json(result);
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
    const message = e instanceof Error ? e.message : "Failed to sync brokerage.";
    console.error("[snaptrade/sync POST]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
