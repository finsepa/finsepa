import { NextResponse } from "next/server";

import { requireAuthUser, AuthRequiredError } from "@/lib/watchlist/api-auth";
import {
  deleteSnapTradeConnection,
  isSnapTradeConfigured,
  SnapTradeNotConfiguredError,
  SnapTradeUserStoreError,
} from "@/lib/snaptrade/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ authorizationId: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    if (!isSnapTradeConfigured()) {
      return NextResponse.json({ error: "SnapTrade is not configured." }, { status: 503 });
    }

    const { authorizationId } = await context.params;
    const id = authorizationId?.trim();
    if (!id) {
      return NextResponse.json({ error: "Missing connection id." }, { status: 400 });
    }

    const supabase = await getSupabaseServerClient();
    const user = await requireAuthUser(supabase);

    await deleteSnapTradeConnection(user.id, id);
    return NextResponse.json({ ok: true });
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
    const message = e instanceof Error ? e.message : "Failed to disconnect brokerage.";
    console.error("[snaptrade/connections DELETE]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
