import { NextResponse } from "next/server";

import { requireAuthUserFromRequest, AuthRequiredError } from "@/lib/watchlist/api-auth";
import {
  isUserWithinWatchlistResetWindow,
  NEW_ACCOUNT_WATCHLIST_RESET_WINDOW_MS,
} from "@/lib/watchlist/new-account-reset";
import { getWatchlistSnapshot, resetWatchlistForNewAccount } from "@/lib/watchlist/operations";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const user = await requireAuthUserFromRequest(request);
    if (!isUserWithinWatchlistResetWindow(user)) {
      return NextResponse.json(
        {
          error: `Watchlist reset is only available for accounts created within ${
            NEW_ACCOUNT_WATCHLIST_RESET_WINDOW_MS / 3_600_000
          } hours.`,
        },
        { status: 403 },
      );
    }

    const supabase = await getSupabaseServerClient();
    await resetWatchlistForNewAccount(supabase, user.id);
    const snapshot = await getWatchlistSnapshot(supabase, user.id);
    return NextResponse.json(snapshot, { status: 200 });
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
