import { NextResponse } from "next/server";
import { requireAuthUserFromRequest, AuthRequiredError } from "@/lib/watchlist/api-auth";
import {
  syncWatchlistFromClient,
  WatchlistDestructiveSyncError,
  WatchlistValidationError,
} from "@/lib/watchlist/operations";
import {
  normalizeWatchlistSections,
  normalizeTickerSections,
} from "@/lib/watchlist/sections";
import type { WatchlistSyncCollectionInput } from "@/lib/watchlist/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function parseSyncCollectionEntry(entry: unknown): WatchlistSyncCollectionInput | null {
  if (!entry || typeof entry !== "object" || !("name" in entry) || !("tickers" in entry)) {
    return null;
  }
  const name = (entry as { name: unknown }).name;
  const tickers = (entry as { tickers: unknown }).tickers;
  if (typeof name !== "string" || !Array.isArray(tickers)) return null;

  const sectionsRaw = (entry as { sections?: unknown }).sections;
  const tickerSectionsRaw = (entry as { tickerSections?: unknown }).tickerSections;
  const sections = normalizeWatchlistSections(sectionsRaw);
  const tickerSections =
    tickerSectionsRaw && typeof tickerSectionsRaw === "object"
      ? normalizeTickerSections(tickerSectionsRaw, sections)
      : {};

  return {
    name,
    tickers: tickers.filter((t): t is string => typeof t === "string"),
    sections,
    tickerSections,
  };
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthUserFromRequest(request);
    const supabase = await getSupabaseServerClient();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    if (!body || typeof body !== "object" || !("collections" in body)) {
      return NextResponse.json({ error: "Missing collections." }, { status: 400 });
    }

    const rawCollections = (body as { collections: unknown }).collections;
    if (!Array.isArray(rawCollections)) {
      return NextResponse.json({ error: "collections must be an array." }, { status: 400 });
    }

    const collections: WatchlistSyncCollectionInput[] = [];
    for (const entry of rawCollections) {
      const parsed = parseSyncCollectionEntry(entry);
      if (!parsed) {
        return NextResponse.json({ error: "Invalid collection entry." }, { status: 400 });
      }
      collections.push(parsed);
    }

    const bodyRecord = body as { collections: unknown; activeName?: unknown };
    const activeName = typeof bodyRecord.activeName === "string" ? bodyRecord.activeName : undefined;

    const snapshot = await syncWatchlistFromClient(supabase, user.id, collections, activeName);
    return NextResponse.json(snapshot, { status: 200 });
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e instanceof WatchlistValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    if (e instanceof WatchlistDestructiveSyncError) {
      return NextResponse.json(
        { error: e.message, code: "destructive_sync_blocked" as const },
        { status: 409 },
      );
    }
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
