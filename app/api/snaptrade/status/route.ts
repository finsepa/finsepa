import { NextResponse } from "next/server";

import { requireAuthUserFromRequest, AuthRequiredError } from "@/lib/watchlist/api-auth";
import {
  isSnapTradeConfigured,
  listSnapTradeConnections,
  SnapTradeUserStoreError,
} from "@/lib/snaptrade/server";

export async function GET(request: Request) {
  try {
    const configured = isSnapTradeConfigured();
    if (!configured) {
      return NextResponse.json({ configured: false, connected: false, connectionCount: 0 });
    }

    const user = await requireAuthUserFromRequest(request);

    const connections = await listSnapTradeConnections(user.id);
    return NextResponse.json({
      configured: true,
      connected: connections.length > 0,
      connectionCount: connections.length,
    });
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e instanceof SnapTradeUserStoreError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    const message = e instanceof Error ? e.message : "Failed to read SnapTrade status.";
    console.error("[snaptrade/status GET]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
